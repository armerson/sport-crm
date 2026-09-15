import { createClient } from 'npm:@supabase/supabase-js@2.101.1'
import webpush from 'npm:web-push@3.6.7'
import { createPushHandler, isTrustedPushEndpoint, type PushActor } from './handler.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
interface PushSubscriptionRow { endpoint: string; p256dh: string; auth: string }

async function authenticate(token: string): Promise<PushActor | null> {
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  const { data: profile, error: profileError } = await supabase.from('profiles').select('roles, linked_player_id').eq('id', data.user.id).maybeSingle()
  if (profileError || !profile) return null
  return { id: data.user.id, roles: profile.roles, linkedPlayerId: profile.linked_player_id }
}

async function allowedRecipients(actor: PushActor): Promise<Set<string>> {
  const [coaches, parents] = await Promise.all([
    supabase.from('team_coaches').select('team_id').eq('coach_id', actor.id),
    supabase.from('player_parents').select('player_id').eq('parent_id', actor.id),
  ])
  if (coaches.error || parents.error) throw new Error('Membership lookup failed')
  const playerIds = [...new Set([...(parents.data ?? []).map((p) => p.player_id), ...(actor.linkedPlayerId ? [actor.linkedPlayerId] : [])])]
  const memberships = playerIds.length ? await supabase.from('player_teams').select('team_id').in('player_id', playerIds) : { data: [], error: null }
  if (memberships.error) throw memberships.error
  const teamIds = [...new Set([...(coaches.data ?? []).map((c) => c.team_id), ...(memberships.data ?? []).map((m) => m.team_id)])]
  if (!teamIds.length) return new Set()
  const [teamCoaches, teamPlayers] = await Promise.all([
    supabase.from('team_coaches').select('coach_id').in('team_id', teamIds),
    supabase.from('player_teams').select('player_id').in('team_id', teamIds),
  ])
  if (teamCoaches.error || teamPlayers.error) throw new Error('Team lookup failed')
  const recipients = new Set<string>((teamCoaches.data ?? []).map((c) => c.coach_id))
  const squadIds = [...new Set((teamPlayers.data ?? []).map((p) => p.player_id))]
  if (squadIds.length) {
    const [families, players] = await Promise.all([
      supabase.from('player_parents').select('parent_id').in('player_id', squadIds),
      supabase.from('profiles').select('id').in('linked_player_id', squadIds),
    ])
    if (families.error || players.error) throw new Error('Recipient lookup failed')
    for (const p of families.data ?? []) recipients.add(p.parent_id)
    for (const p of players.data ?? []) recipients.add(p.id)
  }
  return recipients
}

Deno.serve(createPushHandler({
  authenticate,
  allowedRecipients,
  isInternal(request) {
    const expected = Deno.env.get('COMET_SYNC_SECRET') ?? ''
    const supplied = request.headers.get('x-internal-secret') ?? ''
    return expected.length >= 32 && supplied === expected
  },
  async deliver({ userIds, title, body: messageBody, url, tag }) {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const subject = Deno.env.get('VAPID_SUBJECT')
    if (!publicKey || !privateKey || !subject) throw new Error('Push is not configured')
    webpush.setVapidDetails(subject, publicKey, privateKey)
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (fetchError) {
      throw fetchError
    }

    if (!subscriptions?.length) {
      return { sent: 0 }
    }

    const safeSubscriptions = (subscriptions as PushSubscriptionRow[]).filter((sub) => isTrustedPushEndpoint(sub.endpoint))
    const payload = JSON.stringify({ title, body: messageBody, url, tag })

    const results = await Promise.allSettled(
      safeSubscriptions.map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload),
      ),
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length + subscriptions.length - safeSubscriptions.length

    // Clean up expired subscriptions (HTTP 410 Gone)
    const expiredEndpoints = safeSubscriptions
      .filter((_, i) => {
        const result = results[i]
        return result?.status === 'rejected' && (result as PromiseRejectedResult).reason?.statusCode === 410
      })
      .map((s) => s.endpoint)

    if (expiredEndpoints.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }

    return { sent, failed }
  },
}))
