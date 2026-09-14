export interface PushActor { id: string; roles: string[]; linkedPlayerId: string | null }
export interface PushPayload { userIds: string[]; title: string; body: string; url: string; tag: string }
export interface PushDependencies {
  authenticate: (token: string) => Promise<PushActor | null>
  allowedRecipients: (actor: PushActor) => Promise<Set<string>>
  deliver: (payload: PushPayload) => Promise<{ sent: number; failed?: number }>
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export function createPushHandler(dependencies: PushDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return json({ error: 'Sign in to send notifications.' }, 401)
    try {
      const actor = await dependencies.authenticate(token)
      if (!actor) return json({ error: 'Your session is invalid or expired.' }, 401)
      const raw = await request.text()
      if (raw.length > 16000) return json({ error: 'Notification is too large.' }, 400)
      let input: Record<string, unknown>
      try { input = JSON.parse(raw) } catch { return json({ error: 'Invalid notification.' }, 400) }
      if (!input || typeof input !== 'object' || !Array.isArray(input.userIds) || input.userIds.length < 1 || input.userIds.length > 100
        || input.userIds.some((id) => typeof id !== 'string' || !uuid.test(id))
        || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200
        || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 2000) {
        return json({ error: 'Invalid notification.' }, 400)
      }
      const url = typeof input.url === 'string' ? input.url : '/'
      if (!url.startsWith('/') || url.startsWith('//') || (url.includes('\\') || [...url].some((character) => character.charCodeAt(0) < 32))) return json({ error: 'Invalid notification destination.' }, 400)
      const userIds = [...new Set(input.userIds as string[])]
      if (!actor.roles.includes('admin')) {
        const allowed = await dependencies.allowedRecipients(actor)
        if (userIds.some((id) => !allowed.has(id))) return json({ error: 'Recipients must belong to your teams.' }, 403)
      }
      const result = await dependencies.deliver({ userIds, title: input.title.trim(), body: input.body.trim(), url, tag: 'sports-crm' })
      return json(result)
    } catch {
      return json({ error: 'Unable to send notifications right now.' }, 500)
    }
  }
}

/** Subscription URLs are user-writable; delivery must stay on browser push services. */
export function isTrustedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false
    return url.hostname === 'fcm.googleapis.com'
      || url.hostname === 'updates.push.services.mozilla.com'
      || url.hostname.endsWith('.push.services.mozilla.com')
      || url.hostname === 'web.push.apple.com'
      || url.hostname.endsWith('.notify.windows.com')
  } catch { return false }
}
