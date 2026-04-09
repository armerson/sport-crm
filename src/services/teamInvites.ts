import { requireSupabase } from './supabaseHelpers.ts'

export interface InviteInfo {
  teamId: string
  teamName: string
  ageGroup: string
  photoUrl: string | null
  role: 'parent' | 'coach'
  code: string
}

/** Public — works before the user is logged in. */
export async function getInviteInfo(code: string): Promise<InviteInfo | { error: string }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_invite_info', { p_code: code })
  if (error) return { error: error.message }
  const d = data as Record<string, unknown>
  if (d.error) return { error: d.error as string }
  return {
    teamId:   String(d.teamId   ?? ''),
    teamName: String(d.teamName ?? ''),
    ageGroup: String(d.ageGroup ?? ''),
    photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl : null,
    role:     d.role === 'coach' ? 'coach' : 'parent',
    code,
  }
}

/** Create an invite link for a team. Returns the short code. */
export async function createTeamInvite(teamId: string, role: 'parent' | 'coach'): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_team_invite', {
    p_team_id: teamId,
    p_role: role,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/** Called after authentication to process a pending invite code. */
export async function useTeamInvite(code: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('use_team_invite', { p_code: code })
  if (error) throw new Error(error.message)
}

// ── Club-level invites ────────────────────────────────────────────

export interface ClubInviteInfo {
  role: 'coach' | 'admin'
  code: string
}

export async function getClubInviteInfo(code: string): Promise<ClubInviteInfo | { error: string }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_club_invite_info', { p_code: code })
  if (error) return { error: error.message }
  const d = data as Record<string, unknown>
  if (d.error) return { error: d.error as string }
  return { role: d.role === 'admin' ? 'admin' : 'coach', code }
}

export async function createClubInvite(role: 'coach' | 'admin'): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_club_invite', { p_role: role })
  if (error) throw new Error(error.message)
  return data as string
}

export async function useClubInvite(code: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('use_club_invite', { p_code: code })
  if (error) throw new Error(error.message)
}
