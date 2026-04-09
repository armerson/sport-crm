import type { UserProfile } from '../types/auth.ts'
import type { EventRecord, GroupFormInput, GroupRecord, PlayerFormInput, PlayerRecord, TeamFormInput, TeamRecord } from '../types/club.ts'

export interface PendingRegistration {
  playerId: string
  name: string
  dob: string | null
  parentIds: string[]
  /** Who registered — parent name(s) or self (senior) */
  registeredByLabel: string
}
import { mapEventRow, mapGroupRow, mapPlayerRow, mapProfileRow, mapTeamRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export function subscribeToTeams(
  onData: (teams: TeamRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('teams-feed', ['teams', 'team_coaches', 'player_teams'], async () => {
    const { data: teamsData, error: teamsError } = await client
      .from('teams')
      .select('id, name, age_group, is_senior, photo_url')
      .order('age_group', { ascending: true })
      .order('name', { ascending: true })

    if (teamsError) {
      onError('Unable to load teams.')
      return
    }

    const { data: tcData, error: tcErr } = await client.from('team_coaches').select('team_id, coach_id')
    if (tcErr) {
      onError('Unable to load teams.')
      return
    }

    const { data: ptData, error: ptErr } = await client.from('player_teams').select('team_id, player_id')
    if (ptErr) {
      onError('Unable to load teams.')
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

    onData((teamsData ?? []).map((team) => {
      const id = (team as { id: string }).id
      const team_coaches = (coachesByTeam.get(id) ?? []).map((coach_id) => ({ coach_id }))
      const player_teams = (playersByTeam.get(id) ?? []).map((player_id) => ({ player_id }))
      return mapTeamRow({ ...team, team_coaches, player_teams } as Record<string, unknown>)
    }))
  })
}

export function subscribeToPlayers(
  teamId: string,
  onData: (players: PlayerRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables(`team-players-${teamId}`, ['players', 'player_teams', 'player_parents'], async () => {
    const { data, error } = await client
      .from('players')
      .select('id, name, dob, player_parents(parent_id), player_teams!inner(team_id)')
      .eq('player_teams.team_id', teamId)
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load players.')
      return
    }

    onData((data ?? []).map((row) => mapPlayerRow(row as Record<string, unknown>)))
  })
}

export function subscribeToCoaches(
  onData: (coaches: UserProfile[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('coach-profiles', ['profiles', 'team_coaches'], async () => {
    // Load coach-team assignments first, then resolve profile names.
    // We do NOT filter by roles because the roles update can be silently
    // blocked by RLS; anyone in team_coaches is a coach for display purposes.
    const { data: tcData, error: tcErr } = await client
      .from('team_coaches')
      .select('coach_id, team_id')

    if (tcErr) {
      onError('Unable to load coaches.')
      return
    }

    const teamsByCoach = new Map<string, string[]>()
    const coachIds = new Set<string>()
    for (const row of (tcData ?? []) as Array<{ coach_id: string; team_id: string }>) {
      coachIds.add(row.coach_id)
      if (!teamsByCoach.has(row.coach_id)) teamsByCoach.set(row.coach_id, [])
      teamsByCoach.get(row.coach_id)!.push(row.team_id)
    }

    // Also include profiles that explicitly carry the coach role (for the dropdown)
    const { data: roleData } = await client
      .from('profiles')
      .select('id, name, email, roles, linked_player_id')
      .contains('roles', ['coach'])
      .order('name', { ascending: true })

    const allCoachIds = new Set([...coachIds, ...((roleData ?? []) as Array<{ id: string }>).map((r) => r.id)])

    if (allCoachIds.size === 0) {
      onData([])
      return
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, name, email, roles, linked_player_id')
      .in('id', [...allCoachIds])
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load coaches.')
      return
    }

    onData((data ?? []).map((row) => {
      const r = row as Record<string, unknown>
      const id = String(r.id ?? '')
      return mapProfileRow(r, {
        teams: teamsByCoach.get(id) ?? [],
        children: [],
      })
    }))
  })
}

export function subscribeToParents(
  onData: (parents: UserProfile[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('parent-profiles', ['profiles', 'player_parents'], async () => {
    const { data, error } = await client
      .from('profiles')
      .select('id, name, email, roles, linked_player_id, player_parents(player_id)')
      .contains('roles', ['parent'])
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load parent accounts.')
      return
    }

    onData((data ?? []).map((row) => mapProfileRow(row as Record<string, unknown>, {
      teams: [],
      children: Array.isArray((row as Record<string, unknown>).player_parents)
        ? ((row as { player_parents: Array<{ player_id: string }> }).player_parents.map((entry) => entry.player_id).filter(Boolean))
        : [],
    })))
  })
}

export function subscribeToAllEvents(
  onData: (events: EventRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('all-events', ['events'], async () => {
    const { data, error } = await client
      .from('events')
      .select('id, team_id, title, type, date_time, location, recurrence_group_id, opponent')
      .order('date_time', { ascending: true })

    if (error) {
      onError('Unable to load events.')
      return
    }

    onData((data ?? []).map((row) => mapEventRow(row as Record<string, unknown>)))
  })
}

export function subscribeToPendingPlayers(
  onData: (rows: PendingRegistration[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('pending-registrations', ['players', 'player_parents', 'profiles'], async () => {
    const { data, error } = await client
      .from('players')
      .select('id, name, dob, status, player_parents(parent_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      onError('Unable to load pending registrations.')
      return
    }

    const rows = data ?? []
    const playerIds = rows.map((r) => r.id as string)
    const allParentIds = [
      ...new Set(
        rows.flatMap((r) => {
          const pp = r.player_parents as Array<{ parent_id: string }> | null
          return Array.isArray(pp) ? pp.map((x) => x.parent_id) : []
        }),
      ),
    ]

    const [{ data: parentProfiles }, { data: selfProfiles }] = await Promise.all([
      allParentIds.length
        ? client.from('profiles').select('id, name').in('id', allParentIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      playerIds.length
        ? client.from('profiles').select('id, name, email, linked_player_id').in('linked_player_id', playerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; email: string; linked_player_id: string }> }),
    ])

    const parentNameById = new Map((parentProfiles ?? []).map((p) => [p.id, p.name]))
    const selfByPlayerId = new Map(
      (selfProfiles ?? []).map((p) => [p.linked_player_id, p.name || p.email]),
    )

    const mapped: PendingRegistration[] = rows.map((r) => {
      const pp = r.player_parents as Array<{ parent_id: string }> | null
      const parentIds = Array.isArray(pp) ? pp.map((x) => x.parent_id) : []
      let registeredByLabel = 'Unknown'
      if (parentIds.length > 0) {
        registeredByLabel = parentIds
          .map((id) => parentNameById.get(id) ?? 'Parent')
          .join(', ')
      } else {
        registeredByLabel = `Self (18+) — ${selfByPlayerId.get(r.id as string) ?? 'player'}`
      }
      return {
        playerId: r.id as string,
        name: r.name as string,
        dob: typeof r.dob === 'string' ? r.dob : null,
        parentIds,
        registeredByLabel,
      }
    })

    onData(mapped)
  })
}

export async function createTeam(input: TeamFormInput) {
  const client = requireSupabase()
  const { error } = await client.from('teams').insert({
    name: input.name,
    age_group: input.ageGroup,
    is_senior: input.isSenior === true,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateTeam(teamId: string, input: TeamFormInput) {
  const client = requireSupabase()
  const { error } = await client
    .from('teams')
    .update({
      name: input.name,
      age_group: input.ageGroup,
      is_senior: input.isSenior === true,
    })
    .eq('id', teamId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function uploadTeamPhoto(teamId: string, file: File): Promise<string> {
  const client = requireSupabase()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${teamId}.${ext}`

  const { error: uploadError } = await client.storage
    .from('team-photos')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw new Error(uploadError.message)

  const { data } = client.storage.from('team-photos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  const { error: updateError } = await client
    .from('teams')
    .update({ photo_url: url })
    .eq('id', teamId)

  if (updateError) throw new Error(updateError.message)
  return url
}

export async function deleteTeam(teamId: string) {
  const client = requireSupabase()
  const { error } = await client.from('teams').delete().eq('id', teamId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function addPlayerToTeam(input: PlayerFormInput) {
  const client = requireSupabase()
  const { data: playerRow, error: playerError } = await client
    .from('players')
    .insert({
      name: input.name,
      dob: input.dob,
      status: 'active',
    })
    .select('id')
    .single()

  if (playerError || !playerRow) {
    throw new Error(playerError?.message ?? 'Unable to create player.')
  }

  const { error: relationError } = await client.from('player_teams').insert({
    player_id: playerRow.id,
    team_id: input.teamId,
  })

  if (relationError) {
    throw new Error(relationError.message)
  }
}

// ──────────────────────────────────────────────────────────────
// Group management
// ──────────────────────────────────────────────────────────────

export function subscribeToGroups(
  onData: (groups: GroupRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('groups-feed', ['groups', 'group_teams'], async () => {
    const { data, error } = await client
      .from('groups')
      .select('id, name, parent_id, group_teams(team_id)')
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load groups.')
      return
    }

    onData((data ?? []).map((row) => mapGroupRow(row as Record<string, unknown>)))
  })
}

export async function createGroup(input: GroupFormInput, teamIds: string[] = []) {
  const client = requireSupabase()

  const { data: groupRow, error: groupError } = await client
    .from('groups')
    .insert({ name: input.name, parent_id: input.parentId ?? null })
    .select('id')
    .single()

  if (groupError || !groupRow) {
    throw new Error(groupError?.message ?? 'Unable to create group.')
  }

  if (teamIds.length > 0) {
    const { error: teamError } = await client
      .from('group_teams')
      .insert(teamIds.map((teamId) => ({ group_id: groupRow.id, team_id: teamId })))

    if (teamError) {
      throw new Error(teamError.message)
    }
  }

  return groupRow.id as string
}

export async function updateGroup(groupId: string, input: GroupFormInput, teamIds: string[]) {
  const client = requireSupabase()

  const [{ error: nameError }, { error: deleteError }] = await Promise.all([
    client.from('groups').update({ name: input.name, parent_id: input.parentId ?? null }).eq('id', groupId),
    client.from('group_teams').delete().eq('group_id', groupId),
  ])

  if (nameError) throw new Error(nameError.message)
  if (deleteError) throw new Error(deleteError.message)

  if (teamIds.length > 0) {
    const { error: insertError } = await client
      .from('group_teams')
      .insert(teamIds.map((teamId) => ({ group_id: groupId, team_id: teamId })))

    if (insertError) throw new Error(insertError.message)
  }
}

export async function deleteGroup(groupId: string) {
  const client = requireSupabase()
  const { error } = await client.from('groups').delete().eq('id', groupId)
  if (error) throw new Error(error.message)
}

// ──────────────────────────────────────────────────────────────
// Club stats
// ──────────────────────────────────────────────────────────────

export async function fetchClubAttendanceRate(daysBack = 60): Promise<{ attended: number; total: number; rate: number | null }> {
  const client = requireSupabase()
  const { data } = await client.rpc('club_attendance_rate', { days_back: daysBack })
  if (!data?.[0]) return { attended: 0, total: 0, rate: null }
  const row = data[0] as { attended: string | number; total: string | number }
  const attended = Number(row.attended)
  const total = Number(row.total)
  return {
    attended,
    total,
    rate: total > 0 ? Math.round((attended / total) * 100) : null,
  }
}