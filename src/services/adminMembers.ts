import { requireSupabase } from './supabaseHelpers.ts'
import type { UserRole } from '../types/auth.ts'

// ── Types ─────────────────────────────────────────────────────────

export interface MemberProfile {
  id: string
  name: string
  email: string
  roles: UserRole[]
  /** Team IDs this person coaches */
  coachTeams: string[]
  /** Player IDs linked as children (for parents) */
  childPlayerIds: string[]
}

export interface DuplicateGroup {
  name: string
  dob: string | null
  players: Array<{ id: string; name: string; dob: string | null; teamIds: string[] }>
}

// ── Fetch ─────────────────────────────────────────────────────────

/** Fetch every profile in the club with coach-team and parent-child relations. */
export async function fetchAllProfiles(): Promise<MemberProfile[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('id, name, email, roles, team_coaches(team_id), player_parents(player_id)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id:            String(r.id ?? ''),
      name:          typeof r.name === 'string' && r.name.trim() ? r.name : 'Club member',
      email:         typeof r.email === 'string' ? r.email : '',
      roles:         Array.isArray(r.roles) ? (r.roles as UserRole[]) : [],
      coachTeams:    Array.isArray(r.team_coaches)
        ? (r.team_coaches as Array<{ team_id: string }>).map((t) => t.team_id)
        : [],
      childPlayerIds: Array.isArray(r.player_parents)
        ? (r.player_parents as Array<{ player_id: string }>).map((p) => p.player_id)
        : [],
    }
  })
}

/** Find groups of players that share the same name (case-insensitive) and DOB. */
export async function fetchDuplicatePlayers(): Promise<DuplicateGroup[]> {
  const client = requireSupabase()

  // Fetch all players with team info
  const { data, error } = await client
    .from('players')
    .select('id, name, dob, player_teams(team_id)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  type Row = { id: string; name: string; dob: string | null; player_teams: Array<{ team_id: string }> }

  const grouped = new Map<string, Row[]>()
  for (const row of (data ?? []) as Row[]) {
    const key = `${row.name.trim().toLowerCase()}||${row.dob ?? ''}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }

  const duplicates: DuplicateGroup[] = []
  for (const [, rows] of grouped) {
    if (rows.length < 2) continue
    duplicates.push({
      name: rows[0].name,
      dob:  rows[0].dob ?? null,
      players: rows.map((r) => ({
        id:      r.id,
        name:    r.name,
        dob:     r.dob ?? null,
        teamIds: r.player_teams.map((t) => t.team_id),
      })),
    })
  }

  return duplicates
}

// ── Mutations ─────────────────────────────────────────────────────

/** Update the roles array for a profile. */
export async function updateProfileRoles(profileId: string, roles: UserRole[]): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('profiles')
    .update({ roles })
    .eq('id', profileId)
  if (error) throw new Error(error.message)

  // If coach role removed, clean up team_coaches via the sync RPC with an empty list
  if (!roles.includes('coach')) {
    await client.rpc('sync_coach_teams', { p_coach_id: profileId, p_team_ids: [] })
  }
}

/** Replace a coach's team assignments atomically. */
export async function syncCoachTeams(coachId: string, teamIds: string[]): Promise<void> {
  const client = requireSupabase()

  // Remove all current team assignments for this coach
  const { error: delErr } = await client
    .from('team_coaches')
    .delete()
    .eq('coach_id', coachId)
  if (delErr) throw new Error(delErr.message)

  // Re-insert the new set
  if (teamIds.length > 0) {
    const { error: insErr } = await client
      .from('team_coaches')
      .insert(teamIds.map((teamId) => ({ team_id: teamId, coach_id: coachId })))
    if (insErr) throw new Error(insErr.message)
  }
}

/** Merge two player records — all data moves to primary, secondary is deleted. */
export async function mergePlayers(primaryId: string, secondaryId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('merge_players', {
    p_primary_id:   primaryId,
    p_secondary_id: secondaryId,
  })
  if (error) throw new Error(error.message)
}
