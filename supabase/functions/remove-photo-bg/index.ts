/**
 * Supabase Edge Function: remove-photo-bg
 *
 * Accepts multipart/form-data POST with an `image` field (File/Blob).
 * Proxies the image to remove.bg and returns the transparent PNG.
 *
 * Secret required: REMOVEBG_API_KEY
 * Set via: supabase secrets set REMOVEBG_API_KEY=your_key_here
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('REMOVEBG_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'REMOVEBG_API_KEY not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const incomingForm = await req.formData()
    const imageFile = incomingForm.get('image')
    if (!imageFile || !(imageFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'Missing image field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Forward to remove.bg
    const form = new FormData()
    form.append('image_file', imageFile)
    form.append('size', 'auto')

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
    })

    if (!res.ok) {
      const txt = await res.text()
      return new Response(
        JSON.stringify({ error: `remove.bg error: ${res.status}`, detail: txt }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Stream the transparent PNG back
    const png = await res.arrayBuffer()
    return new Response(png, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Content-Length': String(png.byteLength),
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
