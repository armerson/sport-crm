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

/** Creates one additional pending child linked to the signed-in parent/admin. */
export async function registerChildrenForCurrentUser(children: ChildRegistrationInput[]): Promise<void> {
  const client = requireSupabase()
  const payload = validateChildren(children).map((child) => {
    const custom = child.custom && Object.keys(child.custom).length > 0 ? child.custom : undefined
    return { ...child, custom }
  })

  if (payload.length !== 1) throw new Error('Add one child at a time.')

  const { error } = await client.rpc('register_additional_child', { p_child: payload[0] })
  if (!error) return
  if (rpcMissing(error)) {
    throw new Error('Adding another child needs a club system update. Please contact your administrator; no registration was created.')
  }
  throw new Error(error.message)
}
