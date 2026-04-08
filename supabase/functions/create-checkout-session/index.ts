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
    .select('id, name, email, roles, linked_player_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return json(request, { error: 'Profile not found.' }, 403)

  const roles: string[] = Array.isArray(profile.roles) ? profile.roles : []
  const isParent = roles.includes('parent')
  const isPlayer = roles.includes('player')
  if (!isParent && !isPlayer) return json(request, { error: 'Only parents and players can access billing.' }, 403)

  let payload: { mode?: string; redirectOrigin?: string }
  try { payload = await request.json() } catch { return json(request, { error: 'Invalid JSON body.' }, 400) }

  // 'subscription' for monthly; 'payment' for one-off + membership
  const mode: 'subscription' | 'payment' = payload.mode === 'subscription' ? 'subscription' : 'payment'
  const origin = typeof payload.redirectOrigin === 'string' ? payload.redirectOrigin.replace(/\/$/, '') : ''
  const returnBase = origin || 'https://example.com'

  // Determine player IDs for this account
  let playerIds: string[] = []
  if (isParent) {
    const { data: rows } = await db
      .from('player_parents')
      .select('player_id')
      .eq('parent_id', profile.id)
    playerIds = (rows ?? []).map((r: { player_id: string }) => r.player_id)
  } else if (isPlayer && profile.linked_player_id) {
    playerIds = [profile.linked_player_id]
  }

  if (playerIds.length === 0) return json(request, { error: 'No players are linked to this account.' }, 400)

  // Fetch assigned products filtered by billing type
  const billingTypes = mode === 'subscription' ? ['monthly'] : ['one_off', 'membership']
  const { data: assignments } = await db
    .from('player_products')
    .select('id, player_id, product_id, products(id, name, price_pence, billing_type)')
    .in('player_id', playerIds)

  type Assignment = { id: string; player_id: string; product_id: string; products: { id: string; name: string; price_pence: number; billing_type: string } }
  const filtered: Assignment[] = ((assignments ?? []) as Assignment[]).filter((a) =>
    a.products && billingTypes.includes(a.products.billing_type)
  )

  if (filtered.length === 0) {
    return json(request, {
      error: mode === 'subscription'
        ? 'No monthly products are assigned to your players.'
        : 'No outstanding fees found.',
    }, 400)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  // Find or create Stripe customer
  let stripeCustomerId: string
  const { data: existingCustomer } = await db
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('parent_id', profile.id)
    .maybeSingle()

  if (existingCustomer?.stripe_customer_id) {
    stripeCustomerId = existingCustomer.stripe_customer_id
  } else {
    const customer = await stripe.customers.create({
      email: profile.email || user.email,
      name: profile.name,
      metadata: { crm_parent_id: profile.id },
    })
    stripeCustomerId = customer.id
    await db.from('stripe_customers').insert({ parent_id: profile.id, stripe_customer_id: stripeCustomerId })
  }

  // Build Stripe line items
  const lineItems = filtered.map((a) => ({
    price_data: {
      currency: 'gbp',
      product_data: {
        name: a.products.name,
        metadata: { crm_product_id: a.products.id, crm_player_id: a.player_id },
      },
      unit_amount: a.products.price_pence,
      ...(mode === 'subscription' ? { recurring: { interval: 'month' as const } } : {}),
    },
    quantity: 1,
  }))

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: stripeCustomerId,
    line_items: lineItems,
    success_url: `${returnBase}?billing=success`,
    cancel_url: `${returnBase}?billing=cancelled`,
    metadata: {
      crm_parent_id: profile.id,
      crm_player_ids: playerIds.join(','),
    },
    ...(mode === 'subscription'
      ? { subscription_data: { metadata: { crm_parent_id: profile.id, crm_player_ids: playerIds.join(',') } } }
      : {}),
  })

  return json(request, { url: session.url })
})
