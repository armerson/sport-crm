import { supabase, supabaseConfigError } from '../lib/supabase.ts'

export type ProvisionableRole = 'admin' | 'coach'

export interface ProvisionClubUserInput {
  name: string
  email: string
  role: ProvisionableRole
}

export interface ProvisionClubUserResult {
  uid: string
  email: string
  role: ProvisionableRole
  passwordSetupLink: string
  inviteEmailSent: boolean
}

export async function provisionClubUser(input: ProvisionClubUserInput): Promise<ProvisionClubUserResult> {
  if (!supabase) {
    throw new Error(supabaseConfigError)
  }

  const { data, error } = await supabase.functions.invoke<ProvisionClubUserResult>('provision-club-user', {
    body: input,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to provision account.')
  }

  return data
}