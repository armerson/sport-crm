/**
 * Supabase Edge Function: post-to-instagram
 *
 * Forwards an image URL + caption to a Make.com (or Zapier) webhook,
 * which handles the actual Instagram Business posting. This avoids
 * dealing with the Instagram Graph API directly.
 *
 * Required secret (set with `supabase secrets set`):
 *   INSTAGRAM_WEBHOOK_URL — Your Make.com or Zapier webhook URL
 *
 * Make.com setup (free tier — 1,000 ops/month):
 *   1. Sign up at https://make.com (free)
 *   2. Create a new Scenario
 *   3. Add trigger: Webhooks → Custom webhook → copy the URL
 *   4. Add action: Instagram for Business → Create a Photo Post
 *      - Image URL: {{1.imageUrl}}
 *      - Caption:   {{1.caption}}
 *   5. Turn the scenario ON
 *   6. Run: supabase secrets set INSTAGRAM_WEBHOOK_URL=https://hook.eu2.make.com/xxxx
 *
 * Zapier setup (free tier — 100 tasks/month):
 *   1. Sign up at https://zapier.com (free)
 *   2. Create a new Zap
 *   3. Trigger: Webhooks by Zapier → Catch Hook → copy the URL
 *   4. Action: Instagram for Business → Create Post
 *      - Media URL: {{imageUrl}}
 *      - Caption:   {{caption}}
 *   5. Publish the Zap
 *   6. Run: supabase secrets set INSTAGRAM_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxx
 *
 * Deploy with:
 *   supabase functions deploy post-to-instagram
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  /** Publicly accessible HTTPS URL for the image */
  imageUrl: string
  /** Caption text including hashtags */
  caption: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const webhookUrl = Deno.env.get('INSTAGRAM_WEBHOOK_URL')

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({
          error: 'Instagram sharing is not configured. Set the INSTAGRAM_WEBHOOK_URL secret — see the function comments for Make.com / Zapier setup instructions.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body: RequestBody = await req.json()
    const { imageUrl, caption } = body

    if (!imageUrl?.trim()) {
      return new Response(JSON.stringify({ error: 'imageUrl is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!caption?.trim()) {
      return new Response(JSON.stringify({ error: 'caption is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Forward to Make.com / Zapier webhook
    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, caption }),
    })

    if (!webhookRes.ok) {
      const text = await webhookRes.text().catch(() => '')
      throw new Error(`Webhook responded with ${webhookRes.status}${text ? `: ${text}` : ''}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
