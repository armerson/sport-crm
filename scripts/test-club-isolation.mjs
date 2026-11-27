// Proves a club backend accepts only sessions it issued itself.
//
// Each club has its own Supabase project, so club A's session token is signed
// with keys club B's backend does not have. This script signs in a throwaway
// user on the LOCAL stack (standing in for club B), then replays the same
// session claims signed with other keys (standing in for club A) and checks
// that the API, auth and storage all refuse them.
//
// Never touches a hosted project: it refuses any API URL that is not local.
// Needs the local stack: supabase start (see scripts/test-db.sh).
import { execFileSync } from 'node:child_process'
import { createHmac, generateKeyPairSync, randomBytes, sign } from 'node:crypto'

const env = Object.fromEntries(
  execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
)
const api = env.API_URL
if (!api || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api)) {
  console.error(`Refusing to run: ${api || 'no local API'} is not a local Supabase stack.`)
  process.exit(1)
}
const anonKey = env.ANON_KEY
const serviceKey = env.SERVICE_ROLE_KEY

const b64url = (value) => Buffer.from(value).toString('base64url')
const decode = (token) => token.split('.').slice(0, 2).map((part) => JSON.parse(Buffer.from(part, 'base64url')))

function signHs256(header, payload, secret) {
  const body = `${b64url(JSON.stringify({ ...header, alg: 'HS256' }))}.${b64url(JSON.stringify(payload))}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

function signEs256(header, payload) {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const body = `${b64url(JSON.stringify({ ...header, alg: 'ES256' }))}.${b64url(JSON.stringify(payload))}`
  const signature = sign('sha256', Buffer.from(body), { key: privateKey, dsaEncoding: 'ieee-p1363' })
  return `${body}.${signature.toString('base64url')}`
}

async function call(path, token, init = {}) {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  return response.status
}

let failed = 0
function check(name, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` (${detail})`}`)
  if (!ok) failed = 1
}

const email = `isolation-${randomBytes(6).toString('hex')}@example.invalid`
const password = randomBytes(18).toString('base64url')
const admin = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
const created = await fetch(`${api}/auth/v1/admin/users`, {
  method: 'POST',
  headers: admin,
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then((r) => r.json())
if (!created.id) {
  console.error('Could not create the test user:', created.msg ?? created.message ?? created)
  process.exit(1)
}

try {
  const session = await fetch(`${api}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json())
  const token = session.access_token
  if (!token) throw new Error('Sign-in failed for the test user')
  const [header, payload] = decode(token)

  // Control: the backend accepts its own session.
  const ownRest = await call('/rest/v1/teams?select=id&limit=1', token)
  check('own session reads the API', ownRest === 200, `HTTP ${ownRest}`)
  const ownUser = await call('/auth/v1/user', token)
  check('own session is recognised by auth', ownUser === 200, `HTTP ${ownUser}`)

  // Another club's session: identical claims, signed with keys this backend never issued.
  const foreign = {
    'another club (HS256 secret)': signHs256(header, payload, randomBytes(32).toString('hex')),
    'another club (ES256 key, same key id)': signEs256(header, payload),
    'unsigned token': `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.`,
  }
  for (const [label, forged] of Object.entries(foreign)) {
    const rest = await call('/rest/v1/teams?select=id&limit=1', forged)
    check(`${label}: API refuses`, rest === 401, `HTTP ${rest}`)
    const write = await call('/rest/v1/teams', forged, { method: 'POST', body: JSON.stringify({ name: 'ISOLATION TEST' }) })
    check(`${label}: API refuses writes`, write === 401, `HTTP ${write}`)
    const user = await call('/auth/v1/user', forged)
    check(`${label}: auth refuses`, user === 401 || user === 403, `HTTP ${user}`)
    const storage = await call('/storage/v1/bucket', forged)
    check(`${label}: storage refuses`, storage >= 400 && storage < 500 && storage !== 404, `HTTP ${storage}`)
  }
} finally {
  await fetch(`${api}/auth/v1/admin/users/${created.id}`, { method: 'DELETE', headers: admin })
}

process.exit(failed)
