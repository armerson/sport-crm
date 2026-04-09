import { requireSupabase, writeAuditLog } from './supabaseHelpers.ts'

export async function assignCoachToTeam(teamId: string, coachId: string) {
  const client = requireSupabase()

  const { data: teamRow, error: teamError } = await client.from('teams').select('id, name').eq('id', teamId).single()
  if (teamError || !teamRow) {
    throw new Error(teamError?.message ?? 'Team not found.')
  }

  const { data: coachProfile, error: coachError } = await client
    .from('profiles')
    .select('id, name')
    .eq('id', coachId)
    .single()

  if (coachError || !coachProfile) {
    throw new Error(coachError?.message ?? 'Profile not found.')
  }

  const { error: rpcErr } = await client.rpc('admin_assign_coach_to_team', {
    p_team_id: teamId,
    p_coach_id: coachId,
  })
  if (rpcErr) throw new Error(rpcErr.message)

  await writeAuditLog({
    action: 'assign_coach',
    targetType: 'team',
    targetId: teamId,
    summary: `Assigned ${(coachProfile as { name: string }).name} to ${teamRow.name}.`,
  })
}

export async function linkParentToPlayer(playerId: string, parentId: string) {
  const client = requireSupabase()
  const [{ data: playerRow, error: playerError }, { data: parentRow, error: parentError }, { error: relationError }] = await Promise.all([
    client.from('players').select('id, name').eq('id', playerId).single(),
    client.from('profiles').select('id, name').eq('id', parentId).contains('roles', ['parent']).single(),
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

export async function movePlayerToTeam(playerId: string, fromTeamId: string, toTeamId: string) {
  const client = requireSupabase()
  const [{ data: playerRow, error: playerError }, { data: toTeamRow, error: toTeamError }] = await Promise.all([
    client.from('players').select('id, name').eq('id', playerId).single(),
    client.from('teams').select('id, name').eq('id', toTeamId).single(),
  ])

  if (playerError || !playerRow) throw new Error(playerError?.message ?? 'Player not found.')
  if (toTeamError || !toTeamRow) throw new Error(toTeamError?.message ?? 'Destination team not found.')

  // Delete old team link then insert new one
  const { error: deleteError } = await client
    .from('player_teams')
    .delete()
    .eq('player_id', playerId)
    .eq('team_id', fromTeamId)

  if (deleteError) throw new Error(deleteError.message)

  const { error: insertError } = await client
    .from('player_teams')
    .upsert({ player_id: playerId, team_id: toTeamId }, { onConflict: 'player_id,team_id', ignoreDuplicates: true })

  if (insertError) throw new Error(insertError.message)

  await writeAuditLog({
    action: 'move_player',
    targetType: 'player',
    targetId: playerId,
    summary: `Moved ${playerRow.name} to ${toTeamRow.name}.`,
  })
}

export async function removePlayerFromClub(playerId: string) {
  const client = requireSupabase()
  const { data: playerRow, error: playerError } = await client
    .from('players')
    .select('id, name')
    .eq('id', playerId)
    .single()

  if (playerError || !playerRow) throw new Error(playerError?.message ?? 'Player not found.')

  const { error: deleteError } = await client.from('players').delete().eq('id', playerId)
  if (deleteError) throw new Error(deleteError.message)

  await writeAuditLog({
    action: 'remove_player',
    targetType: 'player',
    targetId: playerId,
    summary: `Removed ${playerRow.name} from the club.`,
  })
}

export async function approvePendingPlayerToTeam(playerId: string, teamId: string) {
  const client = requireSupabase()
  const { data: playerRow, error: playerError } = await client
    .from('players')
    .select('id, name, status')
    .eq('id', playerId)
    .single()

  if (playerError || !playerRow) {
    throw new Error(playerError?.message ?? 'Player not found.')
  }
  if (playerRow.status !== 'pending') {
    throw new Error('This registration is not pending approval.')
  }

  const { error: updateError } = await client.from('players').update({ status: 'active' }).eq('id', playerId)
  if (updateError) throw new Error(updateError.message)

  const { error: insertError } = await client.from('player_teams').insert({ player_id: playerId, team_id: teamId })
  if (insertError) {
    await client.from('players').update({ status: 'pending' }).eq('id', playerId)
    throw new Error(insertError.message)
  }

  const { data: teamRow } = await client.from('teams').select('name').eq('id', teamId).single()

  await writeAuditLog({
    action: 'approve_pending_player',
    targetType: 'player',
    targetId: playerId,
    summary: `Approved ${playerRow.name} onto ${teamRow?.name ?? 'team'}.`,
  })
}

export async function rejectPendingRegistration(playerId: string) {
  const client = requireSupabase()
  const { data: playerRow, error: playerError } = await client
    .from('players')
    .select('id, name, status')
    .eq('id', playerId)
    .single()

  if (playerError || !playerRow) {
    throw new Error(playerError?.message ?? 'Player not found.')
  }
  if (playerRow.status !== 'pending') {
    throw new Error('Only pending registrations can be rejected.')
  }

  const { error: deleteError } = await client.from('players').delete().eq('id', playerId)
  if (deleteError) throw new Error(deleteError.message)

  await writeAuditLog({
    action: 'reject_pending_registration',
    targetType: 'player',
    targetId: playerId,
    summary: `Rejected registration for ${playerRow.name}.`,
  })
}

export async function unlinkParentFromPlayer(playerId: string, parentId: string) {
  const client = requireSupabase()
  const [{ data: playerRow, error: playerError }, { data: parentRow, error: parentError }, { error: relationError }] = await Promise.all([
    client.from('players').select('id, name').eq('id', playerId).single(),
    client.from('profiles').select('id, name').eq('id', parentId).contains('roles', ['parent']).single(),
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