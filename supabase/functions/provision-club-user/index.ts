import { createClient } from 'jsr:@supabase/supabase-js@2'

type ProvisionableRole = 'admin' | 'coach'

/** Browsers sending `Authorization` need a concrete origin — `*` is rejected (e.g. Safari). */
function corsFor(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowed =
    /^https:\/\/.+/i.test(origin) ||
    /^http:\/\/localhost(?::\d+)?$/i.test(origin) ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
  if (allowed && origin.length > 0) {
    return { ...base, 'Access-Control-Allow-Origin': origin }
  }
  return { ...base, 'Access-Control-Allow-Origin': '*' }
}

function isProvisionableRole(value: unknown): value is ProvisionableRole {
  return value === 'admin' || value === 'coach'
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsFor(request),
    },
  })
}

/** Full origin for invite redirect (https or http on localhost only). */
function resolveAppBaseUrl(envBase: string, redirectOrigin: string | undefined): string | null {
  const trimmed = envBase.replace(/\/$/, '').trim()
  if (trimmed.length > 0) return trimmed
  if (!redirectOrigin) return null
  try {
    const u = new URL(redirectOrigin)
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (u.protocol === 'https:') return u.origin
    if (u.protocol === 'http:' && local) return u.origin
    return null
  } catch {
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsFor(request) })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return json(request, { error: 'Supabase service role credentials are not configured.' }, 500)
  }

  const authHeader = request.headers.get('Authorization')

  if (!authHeader) {
    return json(request, { error: 'Missing authorization header.' }, 401)
  }

  // Single service-role client — used for all operations.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Validate the caller by passing the JWT directly (not via global headers).
  const callerJwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: actorData, error: actorError } = await serviceClient.auth.getUser(callerJwt)

  if (actorError || !actorData.user) {
    return json(request, { error: 'Unable to validate the current admin session.' }, 401)
  }

  const { data: actorProfile, error: profileError } = await serviceClient
    .from('profiles')
    .select('name, roles')
    .eq('id', actorData.user.id)
    .maybeSingle()

  if (profileError || !actorProfile || !Array.isArray(actorProfile.roles) || !actorProfile.roles.includes('admin')) {
    return json(request, { error: 'Only admins can provision staff accounts.' }, 403)
  }

  let payload: { name?: string; email?: string; roles?: unknown[]; redirectOrigin?: string }
  try {
    payload = await request.json()
  } catch {
    return json(request, { error: 'Invalid JSON body.' }, 400)
  }

  const name = payload.name?.trim() ?? ''
  const email = payload.email?.trim().toLowerCase() ?? ''
  const roles: ProvisionableRole[] = Array.isArray(payload.roles)
    ? payload.roles.filter(isProvisionableRole)
    : []

  if (name.length < 2 || !email.includes('@') || roles.length === 0) {
    return json(request, { error: 'Invalid provisioning input.' }, 400)
  }

  const redirectBase = resolveAppBaseUrl(appBaseUrl, typeof payload.redirectOrigin === 'string' ? payload.redirectOrigin : undefined)
  if (!redirectBase) {
    return json(request, {
      error:
        'Invite redirect URL is not configured. Set the APP_BASE_URL secret on this Edge Function (your production site origin, e.g. https://your-app.vercel.app), or use the app from a normal browser tab so it can send redirectOrigin.',
    }, 400)
  }

  const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      name,
      roles,
    },
  })

  if (createError || !createdUser.user) {
    return json(request, { error: createError?.message ?? 'Unable to create the user.' }, 400)
  }

  const { error: insertError } = await serviceClient.from('profiles').insert({
    id: createdUser.user.id,
    name,
    email,
    roles,
  })

  if (insertError) {
    return json(request, { error: insertError.message }, 400)
  }

  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${redirectBase}/login`,
    },
  })

  if (linkError) {
    let msg = linkError.message ?? 'Unable to generate invite link.'
    if (/redirect|url|uri|allowed|invalid/i.test(msg)) {
      msg += ` Add this URL under Authentication → URL Configuration → Redirect URLs: ${redirectBase}/login`
    }
    return json(request, { error: msg }, 400)
  }

  const roleLabel = roles.join(' + ')

  await serviceClient.from('audit_logs').insert({
    actor_id: actorData.user.id,
    actor_name: actorProfile.name,
    action: 'provision_user',
    target_type: 'profile',
    target_id: createdUser.user.id,
    summary: `${actorProfile.name} provisioned ${roleLabel} account for ${name}.`,
  })

  return json(request, {
    uid: createdUser.user.id,
    email,
    roles,
    passwordSetupLink: linkData.properties.action_link,
    inviteEmailSent: false,
  })
})
