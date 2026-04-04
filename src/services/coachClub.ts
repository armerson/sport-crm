import type { AttendanceRecord, EventFormInput, EventRecord, RecurrenceOptions, TeamRecord } from '../types/club.ts'
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
      .select('id, team_id, title, type, date_time, location, recurrence_group_id')
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
  recurrence?: RecurrenceOptions,
): Promise<{ count: number }> {
  const client = requireSupabase()

  // Build the list of events to insert. Recurring events share a recurrence_group_id.
  const recurrenceGroupId = recurrence ? crypto.randomUUID() : null
  const daysInterval = recurrence?.pattern === 'fortnightly' ? 14 : 7
  const sessionCount = recurrence ? recurrence.weeks : 1

  const eventsToInsert = Array.from({ length: sessionCount }, (_, i) => {
    const date = new Date(input.dateTime)
    date.setDate(date.getDate() + i * daysInterval)
    return {
      team_id: input.teamId,
      title: input.title,
      type: input.type,
      date_time: date.toISOString(),
      location: input.location,
      recurrence_group_id: recurrenceGroupId,
    }
  })

  const { data: eventRows, error: eventError } = await client
    .from('events')
    .insert(eventsToInsert)
    .select('id')

  if (eventError || !eventRows || eventRows.length === 0) {
    throw new Error(eventError?.message ?? 'Unable to create event.')
  }

  if (playerIds.length > 0) {
    const attendanceRecords = eventRows.flatMap((eventRow) =>
      playerIds.map((playerId) => ({
        event_id: eventRow.id,
        player_id: playerId,
        status: 'pending',
      })),
    )

    const { error: attendanceError } = await client.from('attendance').insert(attendanceRecords)

    if (attendanceError) {
      throw new Error(attendanceError.message)
    }
  }

  return { count: eventRows.length }
}

export async function deleteEvent(eventId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('events').delete().eq('id', eventId)
  if (error) {
    throw new Error(error.message)
  }
}
