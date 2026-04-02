import type { UserProfile } from '../types/auth.ts'
import type { MessageFormInput, MessageRecord } from '../types/club.ts'
import { mapMessageRow, mapProfileRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export function subscribeToMessagesForTeam(
  teamId: string,
  onData: (messages: MessageRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`team-messages-${teamId}`, ['messages'], async () => {
    const { data, error } = await client
      .from('messages')
      .select('id, team_id, sender_id, content, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })

    if (error) {
      onError('Unable to load messages for this team.')
      return
    }

    onData((data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>)))
  })
}

export function subscribeToUserProfilesByIds(
  userIds: string[],
  onData: (users: UserProfile[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`message-senders-${userIds.join('-')}`, ['profiles', 'team_coaches', 'player_parents'], async () => {
    if (userIds.length === 0) {
      onData([])
      return
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, name, email, role')
      .in('id', userIds)
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load message senders.')
      return
    }

    onData((data ?? []).map((row) => mapProfileRow(row as Record<string, unknown>, { teams: [], children: [] })))
  })
}

export async function sendTeamMessage(input: MessageFormInput) {
  const client = requireSupabase()
  const { error } = await client.from('messages').insert({
    team_id: input.teamId,
    sender_id: input.senderId,
    content: input.content,
  })

  if (error) {
    throw new Error(error.message)
  }
}