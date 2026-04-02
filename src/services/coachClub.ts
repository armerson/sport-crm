import type { AttendanceRecord, EventFormInput, EventRecord, TeamRecord } from '../types/club.ts'
import { mapAttendanceRow, mapEventRow, mapTeamRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export function subscribeToCoachTeams(
  coachId: string,
  onData: (teams: TeamRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`coach-teams-${coachId}`, ['teams', 'team_coaches', 'player_teams'], async () => {
    const { data, error } = await client
      .from('teams')
      .select('id, name, age_group, team_coaches!inner(coach_id), player_teams(player_id)')
      .eq('team_coaches.coach_id', coachId)
      .order('age_group', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load coach teams.')
      return
    }

    onData((data ?? []).map((row) => mapTeamRow(row as Record<string, unknown>)))
  })
}

export function subscribeToEventsForTeam(
  teamId: string,
  onData: (events: EventRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`team-events-${teamId}`, ['events'], async () => {
    const { data, error } = await client
      .from('events')
      .select('id, team_id, title, type, date_time, location')
      .eq('team_id', teamId)
      .order('date_time', { ascending: true })

    if (error) {
      onError('Unable to load team events.')
      return
    }

    onData((data ?? []).map((row) => mapEventRow(row as Record<string, unknown>)))
  })
}

export function subscribeToAttendanceForEvent(
  eventId: string,
  onData: (attendance: AttendanceRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`event-attendance-${eventId}`, ['attendance'], async () => {
    const { data, error } = await client
      .from('attendance')
      .select('id, event_id, player_id, status')
      .eq('event_id', eventId)
      .order('player_id', { ascending: true })

    if (error) {
      onError('Unable to load attendance.')
      return
    }

    onData((data ?? []).map((row) => mapAttendanceRow(row as Record<string, unknown>)))
  })
}

export async function createEventWithAttendance(
  input: EventFormInput,
  playerIds: string[],
) {
  const client = requireSupabase()
  const { data: eventRow, error: eventError } = await client
    .from('events')
    .insert({
      team_id: input.teamId,
      title: input.title,
      type: input.type,
      date_time: input.dateTime,
      location: input.location,
    })
    .select('id')
    .single()

  if (eventError || !eventRow) {
    throw new Error(eventError?.message ?? 'Unable to create event.')
  }

  if (playerIds.length === 0) {
    return
  }

  const { error: attendanceError } = await client.from('attendance').insert(
    playerIds.map((playerId) => ({
      event_id: eventRow.id,
      player_id: playerId,
      status: 'pending',
    })),
  )

  if (attendanceError) {
    throw new Error(attendanceError.message)
  }
}