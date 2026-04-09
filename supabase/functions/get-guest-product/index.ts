import { createClient } from 'jsr:@supabase/supabase-js@2'

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsFor(request) })
  }

  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  let payload: { productId?: string }
  try {
    payload = await request.json()
  } catch {
    return json(request, { error: 'Invalid JSON body.' }, 400)
  }

  const productId = typeof payload.productId === 'string' ? payload.productId.trim() : ''
  if (!productId || !UUID_RE.test(productId)) {
    return json(request, { error: 'Invalid product id.' }, 400)
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: row, error } = await db
    .from('products')
    .select('id, name, description, price_pence, billing_type, active')
    .eq('id', productId)
    .maybeSingle()

  if (error) {
    return json(request, { error: 'Unable to load product.' }, 500)
  }

  if (!row || !row.active) {
    return json(request, { error: 'Product not found.' }, 404)
  }

  const billingType = row.billing_type as string
  if (billingType !== 'one_off' && billingType !== 'membership') {
    return json(request, { error: 'This product is not available for guest checkout.' }, 400)
  }

  return json(request, {
    product: {
      id: row.id,
      name: row.name,
      description: row.description,
      pricePence: row.price_pence,
      billingType,
    },
  })
})
