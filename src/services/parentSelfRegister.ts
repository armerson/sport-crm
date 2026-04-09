import { requireSupabase } from './supabaseHelpers.ts'

export interface ChildRegistrationInput {
  name: string
  dob: string
  /** Club-defined field id → value (from `club_player_fields`). */
  custom?: Record<string, string>
}

function rpcMissing(err: { message?: string; code?: string }): boolean {
  const m = (err.message ?? '').toLowerCase()
  return m.includes('could not find') || m.includes('does not exist') || err.code === 'PGRST202'
}

/** Creates pending player rows linked to the current user. Uses extended RPC when custom fields are present. */
export async function registerChildrenForCurrentUser(children: ChildRegistrationInput[]): Promise<void> {
  const client = requireSupabase()
  const payload = children
    .map((c) => {
      const base = { name: c.name.trim(), dob: c.dob.trim() }
      const custom = c.custom && Object.keys(c.custom).length > 0 ? c.custom : undefined
      return custom ? { ...base, custom } : base
    })
    .filter((c) => c.name.length > 0 && c.dob.length > 0)

  if (payload.length === 0) {
    throw new Error("Enter each child's name and date of birth.")
  }

  const hasCustom = payload.some((p) => 'custom' in p && p.custom)

  if (hasCustom) {
    const { error } = await client.rpc('register_signup_children_with_field_values', {
      p_children: payload,
    })
    if (!error) return
    if (!rpcMissing(error)) throw new Error(error.message)
    // RPC not deployed — fall back without custom values
    const { error: e2 } = await client.rpc('register_signup_children', {
      children: payload.map(({ name, dob }) => ({ name, dob })),
    })
    if (e2) throw new Error(e2.message)
    return
  }

  const { error } = await client.rpc('register_signup_children', { children: payload })
  if (error) throw new Error(error.message)
}
