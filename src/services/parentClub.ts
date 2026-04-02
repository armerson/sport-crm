import type { AttendanceRecord, EventRecord, PlayerRecord, TeamRecord, AttendanceStatus } from '../types/club.ts'
import { mapAttendanceRow, mapEventRow, mapPlayerRow, mapTeamRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export function subscribeToParentPlayers(
  playerIds: string[],
  onData: (players: PlayerRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`parent-players-${playerIds.join('-')}`, ['players', 'player_parents', 'player_teams'], async () => {
    if (playerIds.length === 0) {
      onData([])
      return
    }

    const { data, error } = await client
      .from('players')
      .select('id, name, dob, player_parents(parent_id), player_teams(team_id)')
      .in('id', playerIds)
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load players for this parent.')
      return
    }

    onData((data ?? []).map((row) => mapPlayerRow(row as Record<string, unknown>)))
  })
}

export function subscribeToTeamsByIds(
  teamIds: string[],
  onData: (teams: TeamRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`teams-by-id-${teamIds.join('-')}`, ['teams', 'team_coaches', 'player_teams'], async () => {
    if (teamIds.length === 0) {
      onData([])
      return
    }

    const { data, error } = await client
      .from('teams')
      .select('id, name, age_group, team_coaches(coach_id), player_teams(player_id)')
      .in('id', teamIds)
      .order('age_group', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load teams for this parent.')
      return
    }

    onData((data ?? []).map((row) => mapTeamRow(row as Record<string, unknown>)))
  })
}

export function subscribeToEventsForTeams(
  teamIds: string[],
  onData: (events: EventRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`events-for-teams-${teamIds.join('-')}`, ['events'], async () => {
    if (teamIds.length === 0) {
      onData([])
      return
    }

    const { data, error } = await client
      .from('events')
      .select('id, team_id, title, type, date_time, location')
      .in('team_id', teamIds)
      .order('date_time', { ascending: true })

    if (error) {
      onError('Unable to load events for this parent.')
      return
    }

    onData((data ?? []).map((row) => mapEventRow(row as Record<string, unknown>)))
  })
}

export function subscribeToAttendanceForPlayers(
  playerIds: string[],
  onData: (attendance: AttendanceRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`attendance-for-players-${playerIds.join('-')}`, ['attendance'], async () => {
    if (playerIds.length === 0) {
      onData([])
      return
    }

    const { data, error } = await client
      .from('attendance')
      .select('id, event_id, player_id, status')
      .in('player_id', playerIds)
      .order('event_id', { ascending: true })
      .order('player_id', { ascending: true })

    if (error) {
      onError('Unable to load attendance for this parent.')
      return
    }

    onData((data ?? []).map((row) => mapAttendanceRow(row as Record<string, unknown>)))
  })
}

export async function updateAttendanceResponse(
  attendanceId: string,
  status: AttendanceStatus,
) {
  const client = requireSupabase()
  const { error } = await client.from('attendance').update({ status }).eq('id', attendanceId)

  if (error) {
    throw new Error(error.message)
  }
}