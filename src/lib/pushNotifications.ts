import { requireSupabase } from '../services/supabaseHelpers.ts'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

export async function requestPermissionAndSubscribe(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY not set — skipping push subscription.')
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    const client = requireSupabase()
    await client.from('push_subscriptions').upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'user_id,endpoint' },
    )

    return true
  } catch (err) {
    console.error('[push] Failed to subscribe:', err)
    return false
  }
}

/**
 * Fetch all parent user IDs linked to any player in a team.
 * Used to determine who to notify when a new event is created.
 */
export async function fetchTeamParentIds(teamId: string): Promise<string[]> {
  const client = requireSupabase()
  const { data } = await client
    .from('player_parents')
    .select('parent_id, players!inner(team_id)')
    .eq('players.team_id', teamId)
  if (!data) return []
  return [...new Set(data.map((row) => row.parent_id as string))]
}

/**
 * Fetch all team IDs reachable from a group (uses the recursive DB function).
 */
export async function fetchTeamsInGroup(groupId: string): Promise<string[]> {
  const client = requireSupabase()
  const { data } = await client.rpc('teams_in_group', { root_group_id: groupId })
  if (!data) return []
  return (data as Array<{ team_id: string }>).map((row) => row.team_id)
}

/**
 * All coach + parent IDs for every team in a group's subtree.
 * Excludes the sender. Used for push notifications on group broadcasts.
 */
export async function fetchGroupRecipientIds(groupId: string, senderId: string): Promise<string[]> {
  const teamIds = await fetchTeamsInGroup(groupId)
  if (!teamIds.length) return []

  const client = requireSupabase()
  const [parentArrays, { data: coachRows }] = await Promise.all([
    Promise.all(teamIds.map(fetchTeamParentIds)),
    client.from('team_coaches').select('coach_id').in('team_id', teamIds),
  ])

  const all = [
    ...parentArrays.flat(),
    ...((coachRows ?? []).map((r) => r.coach_id as string)),
  ]
  return [...new Set(all)].filter((id) => id !== senderId)
}

/**
 * All user IDs with an active push subscription — for club-wide broadcasts.
 * Excludes the sender.
 */
export async function fetchAllClubRecipientIds(senderId: string): Promise<string[]> {
  const client = requireSupabase()
  const { data } = await client.from('push_subscriptions').select('user_id')
  return [...new Set((data ?? []).map((r) => r.user_id as string))].filter((id) => id !== senderId)
}

/**
 * Parent IDs for a specific set of player IDs.
 * Used for targeted attendance reminders (only ping parents of players who haven't responded).
 */
export async function fetchParentIdsForPlayers(playerIds: string[]): Promise<string[]> {
  if (!playerIds.length) return []
  const client = requireSupabase()
  const { data } = await client
    .from('player_parents')
    .select('parent_id')
    .in('player_id', playerIds)
  return [...new Set((data ?? []).map((r) => r.parent_id as string))]
}

export async function sendPushToUsers(userIds: string[], title: string, body: string, url = '/'): Promise<void> {
  if (!userIds.length) return

  const client = requireSupabase()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(await client.auth.getSession()).data.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ userIds, title, body, url }),
    })
  } catch (err) {
    console.error('[push] Failed to send notification:', err)
  }
}
