import { validateChildren } from '../utils/childRegistration.ts'
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
  const payload = validateChildren(children).map((child) => {
    const custom = child.custom && Object.keys(child.custom).length > 0 ? child.custom : undefined
    return { ...child, custom }
  })

  const hasCustom = payload.some((p) => 'custom' in p && p.custom)

  if (hasCustom) {
    const { error } = await client.rpc('register_signup_children_with_field_values', {
      p_children: payload,
    })
    if (!error) return
    if (!rpcMissing(error)) throw new Error(error.message)
    throw new Error('The club’s registration questions are not available yet. Please contact the club; your answers have not been submitted.')
  }

  const { error } = await client.rpc('register_signup_children', { children: payload })
  if (error) throw new Error(error.message)
}
