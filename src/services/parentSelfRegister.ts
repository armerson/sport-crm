import { requireSupabase } from './supabaseHelpers.ts'

export interface ChildRegistrationInput {
  name: string
  dob: string
}

/** Creates pending player rows linked to the current user (same RPC as parent sign-up). */
export async function registerChildrenForCurrentUser(children: ChildRegistrationInput[]): Promise<void> {
  const client = requireSupabase()
  const payload = children
    .map((c) => ({ name: c.name.trim(), dob: c.dob.trim() }))
    .filter((c) => c.name.length > 0 && c.dob.length > 0)

  if (payload.length === 0) {
    throw new Error("Enter each child's name and date of birth.")
  }

  const { error } = await client.rpc('register_signup_children', { children: payload })
  if (error) throw new Error(error.message)
}
