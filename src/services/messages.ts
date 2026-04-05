import type { UserProfile } from '../types/auth.ts'
import type { MessageFormInput, MessageRecord } from '../types/club.ts'
import { mapMessageRow, mapProfileRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

// ──────────────────────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────────────────────

export function subscribeToMessagesForTeam(
  teamId: string,
  onData: (messages: MessageRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`team-messages-${teamId}`, ['messages'], async () => {
    const { data, error } = await client
      .from('messages')
      .select('id, team_id, group_id, sender_id, content, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })

    if (error) {
      onError('Unable to load messages for this team.')
      return
    }

    onData((data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>)))
  })
}

export function subscribeToMessagesForGroup(
  groupId: string,
  onData: (messages: MessageRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`group-messages-${groupId}`, ['messages'], async () => {
    const { data, error } = await client
      .from('messages')
      .select('id, team_id, group_id, sender_id, content, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })

    if (error) {
      onError('Unable to load group messages.')
      return
    }

    onData((data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>)))
  })
}

export function subscribeToClubMessages(
  onData: (messages: MessageRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('club-messages', ['messages'], async () => {
    const { data, error } = await client
      .from('messages')
      .select('id, team_id, group_id, sender_id, content, created_at')
      .is('team_id', null)
      .is('group_id', null)
      .order('created_at', { ascending: true })

    if (error) {
      onError('Unable to load club-wide messages.')
      return
    }

    onData((data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>)))
  })
}

/**
 * Subscribes to all broadcast messages (group + club-wide) — team_id is null.
 * RLS handles authorization: coaches/parents only see messages for their teams' groups.
 * Returns messages in chronological order, capped at 50 most recent.
 */
export function subscribeToAnnouncements(
  onData: (messages: MessageRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('announcements', ['messages', 'group_teams'], async () => {
    const { data, error } = await client
      .from('messages')
      .select('id, team_id, group_id, sender_id, content, created_at')
      .is('team_id', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      onError('Unable to load announcements.')
      return
    }

    onData(
      (data ?? [])
        .map((row) => mapMessageRow(row as Record<string, unknown>))
        .reverse(),
    )
  })
}

// ──────────────────────────────────────────────────────────────
// Sender profiles
// ──────────────────────────────────────────────────────────────

export function subscribeToUserProfilesByIds(
  userIds: string[],
  onData: (users: UserProfile[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  const channelName = userIds.length > 0 ? `message-senders-${userIds.join('-')}` : 'message-senders-empty'

  return subscribeToTables(channelName, ['profiles', 'team_coaches', 'player_parents'], async () => {
    if (userIds.length === 0) {
      onData([])
      return
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, name, email, roles')
      .in('id', userIds)
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load message senders.')
      return
    }

    onData((data ?? []).map((row) => mapProfileRow(row as Record<string, unknown>, { teams: [], children: [] })))
  })
}

// ──────────────────────────────────────────────────────────────
// Send
// ──────────────────────────────────────────────────────────────

export async function sendTeamMessage(input: MessageFormInput) {
  const client = requireSupabase()

  const payload: Record<string, unknown> = {
    sender_id: input.senderId,
    content: input.content,
  }

  if (input.teamId) payload.team_id = input.teamId
  if (input.groupId) payload.group_id = input.groupId
  // club-wide: neither teamId nor groupId — both remain absent from payload

  const { error } = await client.from('messages').insert(payload)

  if (error) {
    throw new Error(error.message)
  }
}
