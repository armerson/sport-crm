import type { UserProfile } from '../types/auth.ts'

interface RpcResult { data?: unknown; error: { message: string } | null }
interface RegistrationDependencies {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>
  clearMetadata: (patch: Record<string, null>) => PromiseLike<{ error: { message: string } | null }>
  storage?: Pick<Storage, 'getItem' | 'removeItem'>
}

/** User-editable signup metadata can only select a self-service role. */
export function selfServiceRoles(metadata: Record<string, unknown>): UserProfile['roles'] {
  return metadata.signup_account === 'player' || (Array.isArray(metadata.roles) && metadata.roles.includes('player'))
    ? ['player'] : ['parent']
}

export async function completeRegistration(
  metadata: Record<string, unknown>, profile: UserProfile, dependencies: RegistrationDependencies,
): Promise<boolean> {
  let changed = false
  for (const [key, rpc] of [['pending_invite_code', 'use_team_invite'], ['pending_club_invite_code', 'use_club_invite']]) {
    let code: string | null = null
    try { code = dependencies.storage?.getItem(key) ?? null } catch { /* Storage is optional. */ }
    if (!code) continue
    const result = await dependencies.rpc(rpc, { p_code: code })
    const applicationError = result.data && typeof result.data === 'object' && 'error' in result.data ? result.data.error : null
    if (result.error || applicationError) throw new Error(result.error?.message ?? String(applicationError))
    try { dependencies.storage?.removeItem(key) } catch { /* The invite already succeeded. */ }
    changed = true
  }

  if (profile.roles.includes('parent') && Array.isArray(metadata.signup_children) && metadata.signup_children.length > 0) {
    if (profile.children.length === 0) {
      const { error } = await dependencies.rpc('register_signup_children', { children: metadata.signup_children })
      if (error) throw new Error(`Your account is created, but your children could not be registered: ${error.message}`)
      changed = true
    }
    const { error } = await dependencies.clearMetadata({ signup_children: null })
    if (error) throw new Error('Your children were saved. Please refresh to finish setting up your account.')
  }

  if (profile.roles.includes('player') && metadata.signup_account === 'player' && typeof metadata.player_dob === 'string') {
    if (!profile.linkedPlayerId) {
      const { error } = await dependencies.rpc('register_self_as_player', { p_name: profile.name.trim(), p_dob: metadata.player_dob })
      if (error) throw new Error(`Your account is created, but your player registration could not be saved: ${error.message}`)
      changed = true
    }
    const { error } = await dependencies.clearMetadata({ signup_account: null, player_dob: null })
    if (error) throw new Error('Your player registration was saved. Please refresh to finish setting up your account.')
  }
  return changed
}
