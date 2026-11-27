import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clubEntryPath,
  findClub,
  listedClubs,
  parseBackend,
  parseClubRegistry,
  searchClubs,
  validatePublicKey,
} from '../src/clubos/registry.ts'
import { parsePublicClubSite } from '../src/utils/publicClubSite.ts'

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

const REF_A = 'aaaaaaaaaaaaaaaaaaaa'
const REF_B = 'bbbbbbbbbbbbbbbbbbbb'
const backendA = { supabaseUrl: `https://${REF_A}.supabase.co`, anonKey: jwt({ role: 'anon', ref: REF_A }) }
const backendB = { supabaseUrl: `https://${REF_B}.supabase.co`, anonKey: jwt({ role: 'anon', ref: REF_B }) }

const clubA = {
  code: 'ambassadors-fc',
  name: 'Ambassadors FC',
  location: { town: 'Lurgan', region: 'County Armagh', country: 'Northern Ireland' },
  branding: { primaryColor: '#17466E', badgeUrl: 'https://cdn.example.org/badge.png' },
  origin: 'https://crm.ambassadors.example',
  website: 'https://ambassadors.example',
  backend: backendA,
  plan: 'complete',
}
const clubB = { code: 'test-rovers', name: 'Test Rovers', location: { town: 'Belfast' }, backend: backendB }
const registry = (...clubs: unknown[]) => JSON.stringify(clubs)

test('valid registry entries are normalised with safe defaults', () => {
  const [a, b] = parseClubRegistry(registry(clubA, clubB))
  assert.equal(a.sport, 'football')
  assert.equal(a.status, 'active')
  assert.equal(a.branding?.primaryColor, '#17466e')
  assert.equal(a.origin, 'https://crm.ambassadors.example')
  assert.deepEqual(a.backend, backendA)
  assert.equal(b.origin, undefined)
  assert.deepEqual(parseClubRegistry(undefined), [])
  assert.deepEqual(parseClubRegistry('  '), [])
})

test('entries from the first multi-club directory format are still accepted', () => {
  const [club] = parseClubRegistry(registry({ code: 'test-club', name: 'Test Club', origin: 'https://club.example', website: 'https://club.example/club-website' }))
  assert.equal(club.origin, 'https://club.example')
  assert.equal(new URL(clubEntryPath('register'), club.origin).href, 'https://club.example/register')
})

test('service-role and secret keys are rejected so RLS can never be bypassed from the app', () => {
  assert.throws(() => validatePublicKey(jwt({ role: 'service_role', ref: REF_A }), REF_A), /anon/)
  assert.throws(() => validatePublicKey('sb_secret_abcdefghijklmnop', REF_A), /Secret/)
  assert.throws(() => validatePublicKey('not-a-key', REF_A))
  assert.equal(validatePublicKey('sb_publishable_abcdefghijklmnop', REF_A), 'sb_publishable_abcdefghijklmnop')
  assert.throws(() => parseClubRegistry(registry({ ...clubB, backend: { ...backendB, anonKey: jwt({ role: 'service_role', ref: REF_B }) } })))
})

test('a key from another club project cannot be paired with this club URL', () => {
  assert.throws(() => parseBackend({ supabaseUrl: backendA.supabaseUrl, anonKey: backendB.anonKey }), /different Supabase project/)
})

test('backend URLs must be Supabase projects or operator-approved hosts', () => {
  for (const supabaseUrl of [
    'http://aaaaaaaaaaaaaaaaaaaa.supabase.co',
    'https://evil.example',
    'https://aaaaaaaaaaaaaaaaaaaa.supabase.co.evil.example',
    'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/path',
    'https://aaaaaaaaaaaaaaaaaaaa.supabase.co?x=1',
    'https://user:pass@aaaaaaaaaaaaaaaaaaaa.supabase.co',
    'javascript:alert(1)',
    'http://127.0.0.1:54321',
  ]) {
    assert.throws(() => parseBackend({ supabaseUrl, anonKey: jwt({ role: 'anon' }) }), undefined, supabaseUrl)
  }
  const custom = parseBackend({ supabaseUrl: 'https://api.club.example', anonKey: jwt({ role: 'anon' }) }, { allowedBackendHosts: ['api.club.example'] })
  assert.equal(custom.supabaseUrl, 'https://api.club.example')
  const local = parseBackend({ supabaseUrl: 'http://127.0.0.1:54321', anonKey: jwt({ role: 'anon' }) }, { allowLocalBackends: true })
  assert.equal(local.supabaseUrl, 'http://127.0.0.1:54321')
})

test('clubs may not share a code, app origin or backend', () => {
  assert.throws(() => parseClubRegistry(registry(clubA, { ...clubB, code: clubA.code })), /Duplicate club code/)
  assert.throws(() => parseClubRegistry(registry(clubA, { ...clubB, origin: clubA.origin })), /Duplicate club origin/)
  assert.throws(() => parseClubRegistry(registry(clubA, { ...clubB, backend: backendA })), /share a backend/)
})

test('malformed entries reject the whole registry', () => {
  for (const bad of [
    { ...clubB, code: 'Bad Code' },
    { ...clubB, name: '' },
    { ...clubB, status: 'deleted' },
    { ...clubB, sport: 'Football!' },
    { ...clubB, branding: { primaryColor: 'url(x)' } },
    { ...clubB, branding: { primaryColor: '#123456', badgeUrl: 'javascript:alert(1)' } },
    { ...clubB, website: 'http://insecure.example' },
    { ...clubB, features: { websiteBuilder: 'yes' } },
    { code: 'no-destination', name: 'Nowhere FC' },
  ]) {
    assert.throws(() => parseClubRegistry(registry(clubA, bad)), undefined, JSON.stringify(bad))
  }
  assert.throws(() => parseClubRegistry('{"not":"an array"}'))
  assert.throws(() => parseClubRegistry('not json'))
})

test('search covers name, code and town, ignores accents, and hides unlisted clubs', () => {
  const clubs = parseClubRegistry(registry(clubA, clubB, { ...clubB, code: 'suspended-fc', name: 'Suspended FC', status: 'suspended', backend: undefined, origin: 'https://s.example' }))
  assert.equal(listedClubs(clubs).length, 2)
  assert.deepEqual(searchClubs(clubs, 'ambassadors').map((c) => c.code), ['ambassadors-fc'])
  assert.deepEqual(searchClubs(clubs, 'TEST-ROVERS').map((c) => c.code), ['test-rovers'])
  assert.deepEqual(searchClubs(clubs, 'lúrgan').map((c) => c.code), ['ambassadors-fc'])
  assert.deepEqual(searchClubs(clubs, 'suspended'), [])
  assert.equal(findClub(clubs, 'suspended-fc'), null)
  assert.equal(findClub(clubs, '../etc'), null)
  assert.equal(findClub(clubs, 'test-rovers')?.name, 'Test Rovers')
})

test('public website starter remains opt-in and validates public content', () => {
  const site = { name: 'Test Club', introduction: 'Welcome', about: 'About the club', programmes: ['Youth football'], primaryColor: '#123456', contactEmail: 'info@club.example' }
  assert.equal(parsePublicClubSite(undefined), null)
  assert.deepEqual(parsePublicClubSite(JSON.stringify(site)), site)
  assert.throws(() => parsePublicClubSite(JSON.stringify({ ...site, contactEmail: 'bad@example.com?body=spam' })))
  assert.throws(() => parsePublicClubSite(JSON.stringify({ ...site, primaryColor: 'url(bad)' })))
})
