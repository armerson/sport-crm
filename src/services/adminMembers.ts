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

/** PostgREST sometimes returns a single embedded row as an object instead of a one-element array. */
function embeddedRows<T extends Record<string, unknown>>(value: unknown): T[] {
  if (value == null) return []
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'object') return [value as T]
  return []
}

/** Fetch every profile in the club with coach-team and parent-child relations. */
export async function fetchAllProfiles(): Promise<MemberProfile[]> {
  const client = requireSupabase()

  const { data, error } = await client
    .from('profiles')
    .select('id, name, email, roles, player_parents(player_id)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  const { data: tcData, error: tcErr } = await client
    .from('team_coaches')
    .select('coach_id, team_id')

  if (tcErr) throw new Error(tcErr.message)

  const teamsByCoach = new Map<string, string[]>()
  for (const row of (tcData ?? []) as Array<{ coach_id: string; team_id: string }>) {
    if (!teamsByCoach.has(row.coach_id)) teamsByCoach.set(row.coach_id, [])
    teamsByCoach.get(row.coach_id)!.push(row.team_id)
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const id = String(r.id ?? '')
    return {
      id,
      name:          typeof r.name === 'string' && r.name.trim() ? r.name : 'Club member',
      email:         typeof r.email === 'string' ? r.email : '',
      roles:         Array.isArray(r.roles) ? (r.roles as UserRole[]) : [],
      coachTeams:    teamsByCoach.get(id) ?? [],
      childPlayerIds: embeddedRows<{ player_id: string }>(r.player_parents).map((p) => p.player_id),
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

  if (!roles.includes('coach')) {
    const { error: rpcErr } = await client.rpc('sync_coach_teams', {
      p_coach_id: profileId,
      p_team_ids: [] as string[],
    })
    if (rpcErr) throw new Error(rpcErr.message)
  }
}

/** Replace a coach's team assignments atomically (SECURITY DEFINER — survives RLS quirks). */
export async function syncCoachTeams(coachId: string, teamIds: string[]): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('sync_coach_teams', {
    p_coach_id: coachId,
    p_team_ids: teamIds,
  })
  if (error) throw new Error(error.message)
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
