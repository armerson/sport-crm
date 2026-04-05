import type { UserProfile } from '../types/auth.ts'
import type { EventRecord, GroupFormInput, GroupRecord, PlayerFormInput, PlayerRecord, TeamFormInput, TeamRecord } from '../types/club.ts'
import { mapEventRow, mapGroupRow, mapPlayerRow, mapProfileRow, mapTeamRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export function subscribeToTeams(
  onData: (teams: TeamRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('teams-feed', ['teams', 'team_coaches', 'player_teams'], async () => {
    const { data, error } = await client
      .from('teams')
      .select('id, name, age_group, team_coaches(coach_id), player_teams(player_id)')
      .order('age_group', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load teams.')
      return
    }

    onData((data ?? []).map((row) => mapTeamRow(row as Record<string, unknown>)))
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
    const { data, error } = await client
      .from('profiles')
      .select('id, name, email, roles, team_coaches(team_id)')
      .contains('roles', ['coach'])
      .order('name', { ascending: true })

    if (error) {
      onError('Unable to load coaches.')
      return
    }

    onData((data ?? []).map((row) => mapProfileRow(row as Record<string, unknown>, {
      teams: Array.isArray((row as Record<string, unknown>).team_coaches)
        ? ((row as { team_coaches: Array<{ team_id: string }> }).team_coaches.map((entry) => entry.team_id).filter(Boolean))
        : [],
      children: [],
    })))
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
      .select('id, name, email, roles, player_parents(player_id)')
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
      .select('id, team_id, title, type, date_time, location, recurrence_group_id')
      .order('date_time', { ascending: true })

    if (error) {
      onError('Unable to load events.')
      return
    }

    onData((data ?? []).map((row) => mapEventRow(row as Record<string, unknown>)))
  })
}

export async function createTeam(input: TeamFormInput) {
  const client = requireSupabase()
  const { error } = await client.from('teams').insert({
    name: input.name,
    age_group: input.ageGroup,
  })

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