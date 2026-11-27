import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseClubRegistry } from '../src/clubos/registry.ts'
import {
  SELECTED_CLUB_KEY,
  clubAuthStorageKey,
  clubSharePath,
  parseClubEntryPath,
  readSelectedClub,
  rememberSelectedClub,
  resolveActiveBackend,
  resolveMode,
  safeEntryPath,
  scopedStorage,
  selectClubFromPath,
  type KeyValueStorage,
} from '../src/clubos/session.ts'
import { DEFAULT_PLANS, FEATURES, hasFeature, resolveFeatures } from '../src/clubos/plans.ts'

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.sig`
}

const REF_A = 'aaaaaaaaaaaaaaaaaaaa'
const REF_B = 'bbbbbbbbbbbbbbbbbbbb'
const registry = parseClubRegistry(JSON.stringify([
  { code: 'club-a', name: 'Club A', backend: { supabaseUrl: `https://${REF_A}.supabase.co`, anonKey: jwt({ role: 'anon', ref: REF_A }) }, plan: 'starter' },
  { code: 'club-b', name: 'Club B', backend: { supabaseUrl: `https://${REF_B}.supabase.co`, anonKey: jwt({ role: 'anon', ref: REF_B }) }, plan: 'complete', features: { mediaStudio: false } },
  { code: 'linked-only', name: 'Linked Only', origin: 'https://linked.example' },
  { code: 'paused-fc', name: 'Paused FC', status: 'suspended', backend: { supabaseUrl: 'https://cccccccccccccccccccc.supabase.co', anonKey: jwt({ role: 'anon' }) } },
]))
const [clubA, clubB, linkedOnly, paused] = registry
const MULTI = { VITE_CLUBOS_MODE: 'multi' }

test('mode defaults to standalone so existing club deployments are unchanged', () => {
  assert.equal(resolveMode({}), 'standalone')
  assert.equal(resolveMode({ VITE_CLUBOS_MODE: 'nonsense' }), 'standalone')
  assert.equal(resolveMode({ VITE_CLUB_DIRECTORY_ONLY: 'true' }), 'directory')
  assert.equal(resolveMode(MULTI), 'multi')
})

test('standalone mode uses the build backend with the default auth storage key', () => {
  const active = resolveActiveBackend({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'key' }, registry, new MemoryStorage())
  assert.deepEqual(active, { mode: 'standalone', club: null, backend: { supabaseUrl: 'https://x.supabase.co', anonKey: 'key' }, authStorageKey: null })
})

test('directory mode never connects to a backend, even when one is configured', () => {
  const active = resolveActiveBackend({ VITE_CLUBOS_MODE: 'directory', VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'key' }, registry, new MemoryStorage())
  assert.equal(active.backend, null)
})

test('multi mode ignores build env and connects only to the selected registry club', () => {
  const storage = new MemoryStorage()
  const env = { ...MULTI, VITE_SUPABASE_URL: 'https://ambient.supabase.co', VITE_SUPABASE_ANON_KEY: 'ambient' }
  assert.equal(resolveActiveBackend(env, registry, storage).backend, null)
  rememberSelectedClub(storage, clubB)
  const active = resolveActiveBackend(env, registry, storage)
  assert.equal(active.club?.code, 'club-b')
  assert.equal(active.backend?.supabaseUrl, `https://${REF_B}.supabase.co`)
  assert.equal(active.authStorageKey, clubAuthStorageKey('club-b'))
})

test('each club gets its own auth storage key', () => {
  assert.notEqual(clubAuthStorageKey('club-a'), clubAuthStorageKey('club-b'))
})

test('a tampered, unknown, suspended or app-less club selection is discarded', () => {
  for (const value of ['unknown-fc', '../club-a', 'https://evil.example', paused.code, linkedOnly.code]) {
    const storage = new MemoryStorage()
    storage.setItem(SELECTED_CLUB_KEY, value)
    assert.equal(readSelectedClub(storage, registry), null, value)
    assert.equal(storage.getItem(SELECTED_CLUB_KEY), null, value)
  }
  assert.throws(() => rememberSelectedClub(new MemoryStorage(), linkedOnly))
})

test('club-scoped storage cannot read or overwrite another club state', () => {
  const raw = new MemoryStorage()
  const a = scopedStorage(raw, clubA.code)
  const b = scopedStorage(raw, clubB.code)
  a.setItem('crm_profile_cache', 'club-a-profile')
  a.setItem('pending_invite_code', 'INVITEA')
  assert.equal(b.getItem('crm_profile_cache'), null)
  assert.equal(b.getItem('pending_invite_code'), null)
  b.setItem('crm_profile_cache', 'club-b-profile')
  b.removeItem('pending_invite_code')
  assert.equal(a.getItem('crm_profile_cache'), 'club-a-profile')
  assert.equal(a.getItem('pending_invite_code'), 'INVITEA')
  // Standalone deployments keep their existing, unprefixed keys.
  raw.setItem('clubos_settings', 'legacy')
  assert.equal(scopedStorage(raw, null).getItem('clubos_settings'), 'legacy')
})

test('club links select their own club before the backend client is created', () => {
  const storage = new MemoryStorage()
  rememberSelectedClub(storage, clubA)
  assert.equal(selectClubFromPath(MULTI, '/clubs/club-b/join/ABCD1234', registry, storage)?.code, 'club-b')
  assert.equal(readSelectedClub(storage, registry)?.code, 'club-b')
  // Unknown, suspended or link-only clubs never replace the selection.
  for (const path of ['/clubs/unknown-fc/login', '/clubs/paused-fc/login', '/clubs/linked-only/login', '/login']) {
    assert.equal(selectClubFromPath(MULTI, path, registry, storage), null, path)
    assert.equal(readSelectedClub(storage, registry)?.code, 'club-b', path)
  }
  // Standalone deployments never switch backend from a URL.
  assert.equal(selectClubFromPath({}, '/clubs/club-a/login', registry, storage), null)
})

test('club entry links only open allow-listed public routes', () => {
  for (const [input, expected] of [
    [undefined, '/login'], ['/', '/login'], ['/login', '/login'], ['/register/', '/register'], ['/register/parent', '/register/parent'],
    ['/register/u12-trials', '/register/u12-trials'], ['/join/ABC123', '/join/ABC123'], ['/join/club/ABC123', '/join/club/ABC123'],
    ['/pay/camp/success', '/pay/camp/success'], ['/reset-password', '/reset-password'],
  ] as const) assert.equal(safeEntryPath(input), expected, String(input))
  for (const input of ['/?view=admin', '//evil.example', '/settings', '/join/../admin', '/register/../../x', '/https://evil.example', '/join/a']) {
    assert.equal(safeEntryPath(input), null, input)
  }
  assert.deepEqual(parseClubEntryPath('/clubs/club-a/join/ABC123'), { code: 'club-a', path: '/join/ABC123' })
  assert.deepEqual(parseClubEntryPath('/clubs/club-a'), { code: 'club-a', path: '/login' })
  assert.equal(parseClubEntryPath('/clubs/Club_A/login'), null)
  assert.equal(parseClubEntryPath('/login'), null)
})

test('shared links carry the club in multi mode and are unchanged in standalone mode', () => {
  assert.equal(clubSharePath(null, '/join/ABC123'), '/join/ABC123')
  assert.equal(clubSharePath('club-a', '/join/ABC123'), '/clubs/club-a/join/ABC123')
  assert.equal(clubSharePath('club-a', '/register'), '/clubs/club-a/register')
  assert.equal(clubSharePath('club-a', '/?view=admin'), '/clubs/club-a')
})

test('features come from configurable plans with operator overrides', () => {
  assert.equal(resolveFeatures(null).size, FEATURES.length, 'standalone deployments keep every feature')
  assert.equal(hasFeature(clubA, 'basicPayments'), true)
  assert.equal(hasFeature(clubA, 'websiteBuilder'), false)
  assert.equal(hasFeature(clubB, 'websiteBuilder'), true)
  assert.equal(hasFeature(clubB, 'mediaStudio'), false, 'override removes a plan feature')
  assert.equal(hasFeature({ ...clubA, plan: 'unknown-plan' }, 'advancedFinance'), false, 'unknown plans fall back to core only')
  const repriced = DEFAULT_PLANS.map((plan) => (plan.id === 'starter' ? { ...plan, features: [...plan.features, 'mediaStudio' as const] } : plan))
  assert.equal(hasFeature(clubA, 'mediaStudio', repriced), true, 'allocations are data, not code')
})
