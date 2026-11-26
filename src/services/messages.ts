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
      .is('recipient_id', null)
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
      .is('recipient_id', null)
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
      .is('recipient_id', null)
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
      .is('recipient_id', null)
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

export async function sendTeamMessage(input: MessageFormInput): Promise<MessageRecord> {
  const client = requireSupabase()

  const payload: Record<string, unknown> = {
    sender_id: input.senderId,
    content: input.content,
  }

  if (input.teamId) payload.team_id = input.teamId
  if (input.groupId) payload.group_id = input.groupId
  if (input.recipientId) payload.recipient_id = input.recipientId
  // club-wide: neither teamId nor groupId — both remain absent from payload

  const { data, error } = await client
    .from('messages')
    .insert(payload)
    .select('id, team_id, group_id, recipient_id, sender_id, content, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapMessageRow(data as Record<string, unknown>)
}

export interface CommunicationContact {
  id: string
  name: string
  label: string
  teamId: string | null
}

export async function fetchParentCommunicationContacts(parentId: string): Promise<CommunicationContact[]> {
  const client = requireSupabase()
  const { data: links, error: linksError } = await client
    .from('player_parents')
    .select('player_id, players!inner(player_teams(team_id))')
    .eq('parent_id', parentId)
  if (linksError) throw new Error(linksError.message)

  const teamIds = [...new Set((links ?? []).flatMap((row) => {
    const player = row.players as unknown as { player_teams?: Array<{ team_id: string }> }
    return (player.player_teams ?? []).map((link) => link.team_id)
  }))]

  const [{ data: coachLinks, error: coachError }, { data: assignments, error: assignmentError }] = await Promise.all([
    teamIds.length
      ? client.from('team_coaches').select('coach_id, team_id, profiles!team_coaches_coach_id_fkey(name), teams(name)').in('team_id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    client.from('club_contact_assignments').select('contact_type, profile_id, profiles!club_contact_assignments_profile_id_fkey(name)'),
  ])
  if (coachError) throw new Error(coachError.message)
  if (assignmentError) throw new Error(assignmentError.message)

  const contacts: CommunicationContact[] = (coachLinks ?? []).map((row) => ({
    id: String(row.coach_id),
    name: String((row.profiles as unknown as { name?: string })?.name ?? 'Team coach'),
    label: `Coach · ${String((row.teams as unknown as { name?: string })?.name ?? 'Your team')}`,
    teamId: String(row.team_id),
  }))
  const labels: Record<string, string> = { finance: 'Finance', kit: 'Kit', welfare: 'Child welfare' }
  for (const row of assignments ?? []) contacts.push({
    id: String(row.profile_id),
    name: String((row.profiles as unknown as { name?: string })?.name ?? 'Club contact'),
    label: labels[String(row.contact_type)] ?? 'Club contact',
    teamId: null,
  })
  return contacts.filter((contact, index) => contacts.findIndex((candidate) => candidate.id === contact.id && candidate.teamId === contact.teamId) === index)
}

export function subscribeToDirectMessages(
  userId: string,
  onData: (messages: MessageRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()
  return subscribeToTables(`direct-messages-${userId}`, ['messages'], async () => {
    const { data, error } = await client.from('messages')
      .select('id, team_id, group_id, recipient_id, sender_id, content, created_at')
      .not('recipient_id', 'is', null)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: true })
    if (error) { onError('Unable to load private messages.'); return }
    onData((data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>)))
  })
}

export async function sendDirectMessage(senderId: string, recipientId: string, teamId: string | null, content: string): Promise<MessageRecord> {
  return sendTeamMessage({ senderId, recipientId, teamId, groupId: null, content })
}
