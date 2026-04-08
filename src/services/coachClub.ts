import type { AttendanceStat, AttendanceRecord, EventFormInput, EventRecord, LineupEntry, MotmTally, MotmVote, RecurrenceOptions, ResultFormInput, ResultRecord, TeamRecord } from '../types/club.ts'
import { mapAttendanceRow, mapEventRow, mapLineupRow, mapMotmVoteRow, mapResultRow, mapTeamRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export function subscribeToCoachTeams(
  coachId: string,
  onData: (teams: TeamRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`coach-teams-${coachId}`, ['teams', 'team_coaches', 'player_teams'], async () => {
    const { data, error } = await client
      .from('teams')
      .select('id, name, age_group, photo_url, team_coaches!inner(coach_id), player_teams(player_id)')
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
      .select('id, team_id, title, type, date_time, location, place_id, lat, lng, recurrence_group_id, opponent')
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
      place_id: input.placeId ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      recurrence_group_id: recurrenceGroupId,
      opponent: input.type === 'match' && input.opponent?.trim() ? input.opponent.trim() : null,
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

export async function updateEvent(eventId: string, input: Partial<EventFormInput>): Promise<void> {
  const client = requireSupabase()
  const updates: Record<string, unknown> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.type !== undefined) updates.type = input.type
  if (input.dateTime !== undefined) updates.date_time = input.dateTime
  if (input.location !== undefined) updates.location = input.location
  if (input.placeId !== undefined) updates.place_id = input.placeId ?? null
  if (input.lat !== undefined) updates.lat = input.lat ?? null
  if (input.lng !== undefined) updates.lng = input.lng ?? null
  if (input.opponent !== undefined) updates.opponent = input.opponent?.trim() || null

  const { error } = await client.from('events').update(updates).eq('id', eventId)
  if (error) throw new Error(error.message)
}

export async function deleteEvent(eventId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('events').delete().eq('id', eventId)
  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteEventSeries(recurrenceGroupId: string, fromDateTime: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('events')
    .delete()
    .eq('recurrence_group_id', recurrenceGroupId)
    .gte('date_time', fromDateTime)
  if (error) {
    throw new Error(error.message)
  }
}

// ──────────────────────────────────────────────────────────────
// Match results
// ──────────────────────────────────────────────────────────────

export function subscribeToResultsForTeam(
  teamId: string,
  onData: (results: ResultRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`team-results-${teamId}`, ['results', 'events'], async () => {
    const { data, error } = await client
      .from('results')
      .select('id, event_id, home_score, away_score, notes, events!inner(team_id)')
      .eq('events.team_id', teamId)

    if (error) {
      onError('Unable to load match results.')
      return
    }

    onData((data ?? []).map((row) => mapResultRow(row as Record<string, unknown>)))
  })
}

export async function upsertResult(eventId: string, input: ResultFormInput): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('results').upsert(
    {
      event_id: eventId,
      home_score: input.homeScore,
      away_score: input.awayScore,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  )
  if (error) throw new Error(error.message)
}

// ──────────────────────────────────────────────────────────────
// Match lineups
// ──────────────────────────────────────────────────────────────

export function subscribeToLineupForEvent(
  eventId: string,
  onData: (lineup: LineupEntry[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`event-lineup-${eventId}`, ['match_lineups'], async () => {
    const { data, error } = await client
      .from('match_lineups')
      .select('id, event_id, player_id, is_starting')
      .eq('event_id', eventId)
      .order('is_starting', { ascending: false }) // starters first

    if (error) {
      onError('Unable to load lineup.')
      return
    }

    onData((data ?? []).map((row) => mapLineupRow(row as Record<string, unknown>)))
  })
}

export async function upsertLineupPlayer(eventId: string, playerId: string, isStarting: boolean): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('match_lineups')
    .upsert(
      { event_id: eventId, player_id: playerId, is_starting: isStarting },
      { onConflict: 'event_id,player_id' },
    )
  if (error) throw new Error(error.message)
}

export async function coachUpdateAttendance(attendanceId: string, status: import('../types/club.ts').AttendanceStatus): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('attendance').update({ status }).eq('id', attendanceId)
  if (error) throw new Error(error.message)
}

export async function removeLineupPlayer(eventId: string, playerId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('match_lineups')
    .delete()
    .eq('event_id', eventId)
    .eq('player_id', playerId)
  if (error) throw new Error(error.message)
}

// ──────────────────────────────────────────────────────────────
// Man of the Match
// ──────────────────────────────────────────────────────────────

export function subscribeToMotmVotes(
  eventId: string,
  onData: (votes: MotmVote[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()
  return subscribeToTables(`motm-votes-${eventId}`, ['motm_votes'], async () => {
    const { data, error } = await client
      .from('motm_votes')
      .select('id, event_id, voter_id, player_id')
      .eq('event_id', eventId)
    if (error) { onError('Unable to load votes.'); return }
    onData((data ?? []).map((row) => mapMotmVoteRow(row as Record<string, unknown>)))
  })
}

export async function castMotmVote(eventId: string, voterId: string, playerId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('motm_votes')
    .upsert(
      { event_id: eventId, voter_id: voterId, player_id: playerId },
      { onConflict: 'event_id,voter_id' },
    )
  if (error) throw new Error(error.message)
}

/**
 * Compute a sorted tally from raw votes + a player name map.
 */
export function computeMotmTally(
  votes: MotmVote[],
  playerNames: Map<string, string>,
): MotmTally[] {
  const counts = new Map<string, number>()
  for (const v of votes) {
    counts.set(v.playerId, (counts.get(v.playerId) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([playerId, count]) => ({
      playerId,
      playerName: playerNames.get(playerId) ?? 'Unknown player',
      votes: count,
    }))
    .sort((a, b) => b.votes - a.votes)
}

// ──────────────────────────────────────────────────────────────
// Attendance stats
// ──────────────────────────────────────────────────────────────

export async function fetchAttendanceStats(teamId: string): Promise<AttendanceStat[]> {
  const client = requireSupabase()

  const [{ data: players }, { data: pastEvents }] = await Promise.all([
    client
      .from('players')
      .select('id, name, player_teams!inner(team_id)')
      .eq('player_teams.team_id', teamId)
      .order('name', { ascending: true }),
    client
      .from('events')
      .select('id')
      .eq('team_id', teamId)
      .lt('date_time', new Date().toISOString()),
  ])

  if (!players?.length) return []

  if (!pastEvents?.length) {
    return players.map((p) => ({ playerId: p.id, playerName: p.name, attended: 0, total: 0, rate: null }))
  }

  const eventIds = pastEvents.map((e) => e.id)
  const playerIds = players.map((p) => p.id)

  const { data: attendanceData } = await client
    .from('attendance')
    .select('player_id, status')
    .in('player_id', playerIds)
    .in('event_id', eventIds)

  return players.map((player) => {
    const records = (attendanceData ?? []).filter((a) => a.player_id === player.id)
    const attended = records.filter((a) => a.status === 'yes').length
    const total = records.length
    const rate = total > 0 ? Math.round((attended / total) * 100) : null
    return { playerId: player.id, playerName: player.name, attended, total, rate }
  })
}
