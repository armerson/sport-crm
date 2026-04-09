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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function simpleEmailOk(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsFor(request) })
  }

  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed.' }, 405)
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!stripeKey) return json(request, { error: 'Stripe is not configured on this server.' }, 503)

  let payload: {
    productId?: string
    guardianEmail?: string
    guardianName?: string
    childName?: string
    childDob?: string
    notes?: string
    redirectOrigin?: string
  }
  try {
    payload = await request.json()
  } catch {
    return json(request, { error: 'Invalid JSON body.' }, 400)
  }

  const productId = typeof payload.productId === 'string' ? payload.productId.trim() : ''
  const guardianEmail = typeof payload.guardianEmail === 'string' ? payload.guardianEmail.trim().toLowerCase() : ''
  const guardianName = typeof payload.guardianName === 'string' ? payload.guardianName.trim() : ''
  const childName = typeof payload.childName === 'string' ? payload.childName.trim() : ''
  const childDob = typeof payload.childDob === 'string' ? payload.childDob.trim() : ''
  const notes = typeof payload.notes === 'string' ? payload.notes.trim().slice(0, 2000) : ''
  const origin = typeof payload.redirectOrigin === 'string' ? payload.redirectOrigin.replace(/\/$/, '') : ''
  const returnBase = origin || 'https://example.com'

  if (!productId || !UUID_RE.test(productId)) {
    return json(request, { error: 'Invalid product id.' }, 400)
  }
  if (!guardianEmail || !simpleEmailOk(guardianEmail)) {
    return json(request, { error: 'Please enter a valid email address.' }, 400)
  }
  if (!guardianName || guardianName.length > 200) {
    return json(request, { error: 'Please enter the parent or guardian name.' }, 400)
  }
  if (!childName || childName.length > 200) {
    return json(request, { error: "Please enter the participant's name." }, 400)
  }
  if (!childDob || childDob.length > 32) {
    return json(request, { error: 'Please enter a date of birth.' }, 400)
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: product, error: prodErr } = await db
    .from('products')
    .select('id, name, price_pence, billing_type, active')
    .eq('id', productId)
    .maybeSingle()

  if (prodErr || !product || !product.active) {
    return json(request, { error: 'Product not found.' }, 404)
  }

  const billingType = product.billing_type as string
  if (billingType !== 'one_off' && billingType !== 'membership') {
    return json(request, { error: 'This product is not available for guest checkout.' }, 400)
  }

  const amountPence = product.price_pence as number
  if (amountPence <= 0) {
    return json(request, { error: 'This product has no price set.' }, 400)
  }

  const { data: reg, error: insErr } = await db
    .from('guest_checkout_registrations')
    .insert({
      product_id: productId,
      guardian_email: guardianEmail,
      guardian_name: guardianName,
      child_name: childName,
      child_dob: childDob,
      notes: notes || null,
      amount_pence: amountPence,
      status: 'pending_payment',
    })
    .select('id')
    .single()

  if (insErr || !reg?.id) {
    return json(request, { error: 'Could not start checkout. Please try again.' }, 500)
  }

  const regId = reg.id as string
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: guardianEmail,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: product.name as string,
              metadata: {
                crm_product_id: productId,
                crm_guest_registration_id: regId,
              },
            },
            unit_amount: amountPence,
          },
          quantity: 1,
        },
      ],
      success_url: `${returnBase}/pay/camp/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnBase}/pay/camp/${productId}?cancelled=1`,
      metadata: {
        crm_guest_checkout: 'true',
        guest_registration_id: regId,
        crm_product_id: productId,
      },
      payment_intent_data: {
        metadata: {
          crm_guest_checkout: 'true',
          guest_registration_id: regId,
          crm_product_id: productId,
        },
      },
    })

    await db
      .from('guest_checkout_registrations')
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', regId)

    if (!session.url) {
      await db.from('guest_checkout_registrations').delete().eq('id', regId)
      return json(request, { error: 'Checkout session had no URL.' }, 500)
    }

    return json(request, { url: session.url })
  } catch (e) {
    await db.from('guest_checkout_registrations').delete().eq('id', regId)
    const msg = e instanceof Error ? e.message : 'Stripe error'
    return json(request, { error: msg }, 500)
  }
})
