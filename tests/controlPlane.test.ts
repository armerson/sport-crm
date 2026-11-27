import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  controlPlaneConfig,
  DIRECTORY_CACHE_KEY,
  loadClubDirectory,
  registryJsonFromDirectory,
  registryOptionsFromEnv,
} from '../src/clubos/controlPlane.ts'

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

const CP_REF = 'cccccccccccccccccccc'
const CLUB_REF = 'aaaaaaaaaaaaaaaaaaaa'
const controlPlane = { supabaseUrl: `https://${CP_REF}.supabase.co`, anonKey: jwt({ role: 'anon', ref: CP_REF }) }
const club = {
  code: 'test-rovers',
  name: 'Test Rovers',
  status: 'active',
  backend: { supabaseUrl: `https://${CLUB_REF}.supabase.co`, anonKey: jwt({ role: 'anon', ref: CLUB_REF }) },
}
const rows = [{ entry: club }]

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

function respond(status: number, body: unknown): typeof fetch {
  return (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof fetch
}

const quiet = () => {
  const warn = console.warn
  console.warn = () => undefined
  return () => (console.warn = warn)
}

test('standalone builds and builds without a control plane never fetch a directory', () => {
  const env = { VITE_CLUBOS_CONTROL_PLANE_URL: controlPlane.supabaseUrl, VITE_CLUBOS_CONTROL_PLANE_ANON_KEY: controlPlane.anonKey }
  assert.equal(controlPlaneConfig(env), null)
  assert.equal(controlPlaneConfig({ ...env, VITE_CLUBOS_MODE: 'standalone' }), null)
  assert.equal(controlPlaneConfig({ VITE_CLUBOS_MODE: 'multi' }), null)
  assert.deepEqual(controlPlaneConfig({ ...env, VITE_CLUBOS_MODE: 'multi' }), controlPlane)
})

test('control plane settings must be a public HTTPS backend with a public key', () => {
  const multi = { VITE_CLUBOS_MODE: 'multi' }
  assert.throws(() => controlPlaneConfig({ ...multi, VITE_CLUBOS_CONTROL_PLANE_URL: controlPlane.supabaseUrl, VITE_CLUBOS_CONTROL_PLANE_ANON_KEY: 'sb_secret_abcdefghijk' }))
  assert.throws(() => controlPlaneConfig({ ...multi, VITE_CLUBOS_CONTROL_PLANE_URL: controlPlane.supabaseUrl, VITE_CLUBOS_CONTROL_PLANE_ANON_KEY: jwt({ role: 'service_role', ref: CP_REF }) }))
  assert.throws(() => controlPlaneConfig({ ...multi, VITE_CLUBOS_CONTROL_PLANE_URL: 'http://evil.example', VITE_CLUBOS_CONTROL_PLANE_ANON_KEY: controlPlane.anonKey }))
  assert.throws(() => controlPlaneConfig({ ...multi, VITE_CLUBOS_CONTROL_PLANE_URL: controlPlane.supabaseUrl }))
})

test('registry options allow local backends only in development', () => {
  assert.deepEqual(registryOptionsFromEnv({ DEV: false, VITE_CLUBOS_BACKEND_HOSTS: ' api.club.example, ,db.example ' }), {
    allowLocalBackends: false,
    allowedBackendHosts: ['api.club.example', 'db.example'],
  })
  assert.equal(registryOptionsFromEnv({ DEV: true }).allowLocalBackends, true)
})

test('directory rows become registry JSON, and any invalid entry rejects the whole directory', () => {
  assert.deepEqual(JSON.parse(registryJsonFromDirectory(rows)), [club])
  assert.throws(() => registryJsonFromDirectory({ entry: club }))
  assert.throws(() => registryJsonFromDirectory([{ notEntry: club }]))
  const leaked = { ...club, code: 'leaky', backend: { supabaseUrl: `https://${CLUB_REF}.supabase.co`, anonKey: 'sb_secret_abcdefghijk' } }
  assert.throws(() => registryJsonFromDirectory([...rows, { entry: leaked }]))
  assert.throws(() => registryJsonFromDirectory([{ entry: club }, { entry: { ...club, name: 'Twin' } }]))
})

test('a fresh directory is used and remembered on this device', async () => {
  const cache = memoryStorage()
  let requested = ''
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requested = url
    assert.equal((init.headers as Record<string, string>).apikey, controlPlane.anonKey)
    assert.equal(init.credentials, 'omit')
    return new Response(JSON.stringify(rows), { status: 200 })
  }) as unknown as typeof fetch
  const result = await loadClubDirectory(controlPlane, {}, cache, fetchImpl)
  assert.equal(result.source, 'control-plane')
  assert.equal(requested, `${controlPlane.supabaseUrl}/rest/v1/clubs_public?select=entry&order=code`)
  assert.equal(cache.map.get(DIRECTORY_CACHE_KEY), result.json)
})

test('when the control plane fails, the last good copy is used, then the bundled registry', async () => {
  const restore = quiet()
  try {
    const good = registryJsonFromDirectory(rows)
    const cached = await loadClubDirectory(controlPlane, {}, memoryStorage({ [DIRECTORY_CACHE_KEY]: good }), respond(503, 'down'))
    assert.deepEqual(cached, { json: good, source: 'cache' })
    const thrown = await loadClubDirectory(controlPlane, {}, memoryStorage(), (async () => {
      throw new Error('offline')
    }) as typeof fetch)
    assert.deepEqual(thrown, { json: null, source: 'bundled' })
  } finally {
    restore()
  }
})

test('an invalid directory is never used or cached, and a tampered cache is discarded', async () => {
  const restore = quiet()
  try {
    const leaked = [{ entry: { ...club, backend: { ...club.backend, anonKey: jwt({ role: 'service_role', ref: CLUB_REF }) } } }]
    const cache = memoryStorage()
    assert.deepEqual(await loadClubDirectory(controlPlane, {}, cache, respond(200, leaked)), { json: null, source: 'bundled' })
    assert.equal(cache.map.has(DIRECTORY_CACHE_KEY), false)

    const tampered = memoryStorage({ [DIRECTORY_CACHE_KEY]: JSON.stringify(leaked.map((row) => row.entry)) })
    assert.deepEqual(await loadClubDirectory(controlPlane, {}, tampered, respond(500, '')), { json: null, source: 'bundled' })
    assert.equal(tampered.map.has(DIRECTORY_CACHE_KEY), false)

    assert.deepEqual(await loadClubDirectory(controlPlane, {}, memoryStorage(), respond(200, 'x'.repeat(600 * 1024))), { json: null, source: 'bundled' })
  } finally {
    restore()
  }
})
