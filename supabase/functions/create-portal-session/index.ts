import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno&no-check'

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
  if (allowed && origin.length > 0) return { ...base, 'Access-Control-Allow-Origin': origin }
  return { ...base, 'Access-Control-Allow-Origin': '*' }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsFor(req) },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsFor(request) })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!stripeKey) return json(request, { error: 'Stripe is not configured on this server.' }, 503)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json(request, { error: 'Missing authorization header.' }, 401)

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user }, error: authError } = await db.auth.getUser(jwt)
  if (authError || !user) return json(request, { error: 'Unable to validate session.' }, 401)

  const { data: profile } = await db
    .from('profiles')
    .select('id, roles')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return json(request, { error: 'Profile not found.' }, 403)

  const roles: string[] = Array.isArray(profile.roles) ? profile.roles : []
  if (!roles.includes('parent') && !roles.includes('player')) {
    return json(request, { error: 'Only parents and players can access the billing portal.' }, 403)
  }

  let payload: { redirectOrigin?: string }
  try { payload = await request.json() } catch { return json(request, { error: 'Invalid JSON body.' }, 400) }

  const origin = typeof payload.redirectOrigin === 'string' ? payload.redirectOrigin.replace(/\/$/, '') : ''
  const returnUrl = origin ? `${origin}/` : 'https://example.com'

  const { data: customerRow } = await db
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('parent_id', profile.id)
    .maybeSingle()

  if (!customerRow?.stripe_customer_id) {
    return json(request, { error: 'No billing account found. Complete a payment first to access the portal.' }, 404)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  const session = await stripe.billingPortal.sessions.create({
    customer: customerRow.stripe_customer_id,
    return_url: returnUrl,
  })

  return json(request, { url: session.url })
})
