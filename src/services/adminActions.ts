import { requireSupabase, writeAuditLog } from './supabaseHelpers.ts'

export async function assignCoachToTeam(teamId: string, coachId: string) {
  const client = requireSupabase()
  const [{ data: teamRow, error: teamError }, { data: coachRow, error: coachError }, { error: relationError }] = await Promise.all([
    client.from('teams').select('id, name').eq('id', teamId).single(),
    client.from('profiles').select('id, name').eq('id', coachId).eq('role', 'coach').single(),
    client.from('team_coaches').upsert({ team_id: teamId, coach_id: coachId }, { onConflict: 'team_id,coach_id', ignoreDuplicates: true }),
  ])

  if (teamError || !teamRow) {
    throw new Error(teamError?.message ?? 'Team not found.')
  }

  if (coachError || !coachRow) {
    throw new Error(coachError?.message ?? 'Coach not found.')
  }

  if (relationError) {
    throw new Error(relationError.message)
  }

  await writeAuditLog({
    action: 'assign_coach',
    targetType: 'team',
    targetId: teamId,
    summary: `Assigned ${coachRow.name} to ${teamRow.name}.`,
  })
}

export async function linkParentToPlayer(playerId: string, parentId: string) {
  const client = requireSupabase()
  const [{ data: playerRow, error: playerError }, { data: parentRow, error: parentError }, { error: relationError }] = await Promise.all([
    client.from('players').select('id, name').eq('id', playerId).single(),
    client.from('profiles').select('id, name').eq('id', parentId).eq('role', 'parent').single(),
    client.from('player_parents').upsert({ player_id: playerId, parent_id: parentId }, { onConflict: 'player_id,parent_id', ignoreDuplicates: true }),
  ])

  if (playerError || !playerRow) {
    throw new Error(playerError?.message ?? 'Player not found.')
  }

  if (parentError || !parentRow) {
    throw new Error(parentError?.message ?? 'Parent account not found.')
  }

  if (relationError) {
    throw new Error(relationError.message)
  }

  await writeAuditLog({
    action: 'link_parent',
    targetType: 'player',
    targetId: playerId,
    summary: `Linked ${parentRow.name} to ${playerRow.name}.`,
  })
}

export async function unlinkParentFromPlayer(playerId: string, parentId: string) {
  const client = requireSupabase()
  const [{ data: playerRow, error: playerError }, { data: parentRow, error: parentError }, { error: relationError }] = await Promise.all([
    client.from('players').select('id, name').eq('id', playerId).single(),
    client.from('profiles').select('id, name').eq('id', parentId).eq('role', 'parent').single(),
    client.from('player_parents').delete().eq('player_id', playerId).eq('parent_id', parentId),
  ])

  if (playerError || !playerRow) {
    throw new Error(playerError?.message ?? 'Player not found.')
  }

  if (parentError || !parentRow) {
    throw new Error(parentError?.message ?? 'Parent account not found.')
  }

  if (relationError) {
    throw new Error(relationError.message)
  }

  await writeAuditLog({
    action: 'unlink_parent',
    targetType: 'player',
    targetId: playerId,
    summary: `Removed ${parentRow.name} from ${playerRow.name}.`,
  })
}