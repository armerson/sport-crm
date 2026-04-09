import type { AttendanceStat, AttendanceRecord, EventFormInput, EventRecord, LineupEntry, MotmTally, MotmVote, RecurrenceOptions, ResultFormInput, ResultRecord, TeamRecord } from '../types/club.ts'
import { mapAttendanceRow, mapEventRow, mapLineupRow, mapMotmVoteRow, mapResultRow, mapTeamRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export function subscribeToCoachTeams(
  coachId: string,
  onData: (teams: TeamRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`coach-teams-${coachId}`, ['teams', 'team_coaches', 'player_teams'], async () => {
    const { data: links, error: linkErr } = await client
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', coachId)

    if (linkErr) {
      onError('Unable to load coach teams.')
      return
    }

    const teamIds = [...new Set((links ?? []).map((r: { team_id: string }) => r.team_id))]
    if (teamIds.length === 0) {
      onData([])
      return
    }

    const { data: teams, error: teamsErr } = await client
      .from('teams')
      .select('id, name, age_group, is_senior, photo_url')
      .in('id', teamIds)
      .order('age_group', { ascending: true })
      .order('name', { ascending: true })

    if (teamsErr) {
      onError('Unable to load coach teams.')
      return
    }

    const { data: tcData, error: tcErr } = await client.from('team_coaches').select('team_id, coach_id').in('team_id', teamIds)
    if (tcErr) {
      onError('Unable to load coach teams.')
      return
    }

    const { data: ptData, error: ptErr } = await client.from('player_teams').select('team_id, player_id').in('team_id', teamIds)
    if (ptErr) {
      onError('Unable to load coach teams.')
      return
    }

    const coachesByTeam = new Map<string, string[]>()
    for (const r of (tcData ?? []) as Array<{ team_id: string; coach_id: string }>) {
      if (!coachesByTeam.has(r.team_id)) coachesByTeam.set(r.team_id, [])
      coachesByTeam.get(r.team_id)!.push(r.coach_id)
    }

    const playersByTeam = new Map<string, string[]>()
    for (const r of (ptData ?? []) as Array<{ team_id: string; player_id: string }>) {
      if (!playersByTeam.has(r.team_id)) playersByTeam.set(r.team_id, [])
      playersByTeam.get(r.team_id)!.push(r.player_id)
    }

    onData(
      (teams ?? []).map((team) => {
        const row = team as Record<string, unknown>
        const id = String(row.id ?? '')
        return mapTeamRow({
          ...row,
          team_coaches: (coachesByTeam.get(id) ?? []).map((coach_id) => ({ coach_id })),
          player_teams: (playersByTeam.get(id) ?? []).map((player_id) => ({ player_id })),
        })
      }),
    )
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

export interface AttendanceCounts { yes: number; pending: number; no: number }

/** Lightweight per-event attendance counts for a whole team — used to show ✓/⚠/✗ badges on cards. */
export function subscribeToAttendanceCountsForTeam(
  teamId: string,
  onData: (counts: Map<string, AttendanceCounts>) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  // Subscribe to attendance changes only (avoids JOIN and reduces realtime channels)
  return subscribeToTables(`team-att-counts-${teamId}`, ['attendance'], async () => {
    // Step 1: get all event IDs for this team
    const { data: evRows, error: evErr } = await client
      .from('events')
      .select('id')
      .eq('team_id', teamId)

    if (evErr) { onError('Unable to load attendance counts.'); return }

    const eventIds = (evRows ?? []).map((r: { id: string }) => r.id)
    if (eventIds.length === 0) { onData(new Map()); return }

    // Step 2: get attendance for those events
    const { data, error } = await client
      .from('attendance')
      .select('event_id, status')
      .in('event_id', eventIds)

    if (error) { onError('Unable to load attendance counts.'); return }

    const map = new Map<string, AttendanceCounts>()
    for (const row of (data ?? []) as Array<{ event_id: string; status: string }>) {
      if (!map.has(row.event_id)) map.set(row.event_id, { yes: 0, pending: 0, no: 0 })
      const c = map.get(row.event_id)!
      if (row.status === 'yes') c.yes++
      else if (row.status === 'no') c.no++
      else c.pending++
    }
    onData(map)
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
