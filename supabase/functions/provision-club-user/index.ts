import { createClient } from 'jsr:@supabase/supabase-js@2'

type ProvisionableRole = 'admin' | 'coach'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service role credentials are not configured.' }, 500)
  }

  const authHeader = request.headers.get('Authorization')

  if (!authHeader) {
    return json({ error: 'Missing authorization header.' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: actorData, error: actorError } = await adminClient.auth.getUser()

  if (actorError || !actorData.user) {
    return json({ error: 'Unable to validate the current admin session.' }, 401)
  }

  const { data: actorProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('name, role')
    .eq('id', actorData.user.id)
    .maybeSingle()

  if (profileError || actorProfile?.role !== 'admin') {
    return json({ error: 'Only admins can provision staff accounts.' }, 403)
  }

  const payload = await request.json() as { name?: string; email?: string; role?: ProvisionableRole }
  const name = payload.name?.trim() ?? ''
  const email = payload.email?.trim().toLowerCase() ?? ''
  const role = payload.role

  if (name.length < 2 || !email.includes('@') || (role !== 'admin' && role !== 'coach')) {
    return json({ error: 'Invalid provisioning input.' }, 400)
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      name,
      role,
    },
  })

  if (createError || !createdUser.user) {
    return json({ error: createError?.message ?? 'Unable to create the user.' }, 400)
  }

  const { error: insertError } = await adminClient.from('profiles').insert({
    id: createdUser.user.id,
    name,
    email,
    role,
  })

  if (insertError) {
    return json({ error: insertError.message }, 400)
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${appBaseUrl.replace(/\/$/, '')}/login`,
    },
  })

  if (linkError) {
    return json({ error: linkError.message }, 400)
  }

  await adminClient.from('audit_logs').insert({
    actor_id: actorData.user.id,
    actor_name: actorProfile.name,
    action: 'provision_user',
    target_type: 'profile',
    target_id: createdUser.user.id,
    summary: `${actorProfile.name} provisioned ${role} ${name}.`,
  })

  return json({
    uid: createdUser.user.id,
    email,
    role,
    passwordSetupLink: linkData.properties.action_link,
    inviteEmailSent: false,
  })
})