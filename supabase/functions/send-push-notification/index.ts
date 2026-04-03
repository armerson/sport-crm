/**
 * Supabase Edge Function: send-push-notification
 *
 * Sends Web Push notifications to one or more users via their stored subscriptions.
 *
 * Required secrets (set with `supabase secrets set`):
 *   VAPID_PUBLIC_KEY   — base64url VAPID public key
 *   VAPID_PRIVATE_KEY  — base64url VAPID private key
 *   VAPID_SUBJECT      — mailto: URI for the VAPID contact (e.g. mailto:admin@yourclub.com)
 *
 * Generate keys once with:
 *   npx web-push generate-vapid-keys
 *
 * Deploy with:
 *   supabase functions deploy send-push-notification
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  userIds: string[]
  title: string
  body: string
  url?: string
  tag?: string
}

interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = (await req.json()) as RequestBody
    const { userIds, title, body: messageBody, url = '/', tag = 'sports-crm' } = body

    if (!userIds?.length || !title || !messageBody) {
      return new Response(JSON.stringify({ error: 'Missing required fields: userIds, title, body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({ title, body: messageBody, url, tag })

    const results = await Promise.allSettled(
      (subscriptions as PushSubscriptionRow[]).map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload),
      ),
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    // Clean up expired subscriptions (HTTP 410 Gone)
    const expiredEndpoints = (subscriptions as PushSubscriptionRow[])
      .filter((_, i) => {
        const result = results[i]
        return result?.status === 'rejected' && (result as PromiseRejectedResult).reason?.statusCode === 410
      })
      .map((s) => s.endpoint)

    if (expiredEndpoints.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
