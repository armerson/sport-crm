import { supabase } from '../lib/supabase.ts'

export async function registerCurrentMemberAsPlayer(dob: string): Promise<string> {
  if (!supabase) throw new Error('Club data is not configured.')
  const { data, error } = await supabase.rpc('register_current_member_as_player', { p_dob: dob })
  if (error) throw new Error(error.message)
  if (typeof data !== 'string') throw new Error('Your player profile could not be created.')
  return data
}
