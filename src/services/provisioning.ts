import { supabase, supabaseConfigError } from '../lib/supabase.ts'

export type ProvisionableRole = 'admin' | 'coach'

export interface ProvisionClubUserInput {
  name: string
  email: string
  roles: ProvisionableRole[]
  /** Current app origin (e.g. https://app.vercel.app). Used for invite redirect when APP_BASE_URL is not set on the Edge Function. */
  redirectOrigin?: string
}

export interface ProvisionClubUserResult {
  uid: string
  email: string
  roles: ProvisionableRole[]
  passwordSetupLink: string
  inviteEmailSent: boolean
}

function isHttpErrorWithResponse(error: unknown): error is { context: Response; name?: string } {
  if (typeof error !== 'object' || error === null || !('context' in error)) return false
  const ctx = (error as { context: unknown }).context
  return typeof Response !== 'undefined' && ctx instanceof Response
}

/**
 * Reads JSON `{ error: string }` from a failed function response.
 * Avoids `instanceof FunctionsHttpError` — Vite can duplicate the class so instanceof fails.
 */
async function messageFromFunctionsError(error: unknown): Promise<string> {
  if (isHttpErrorWithResponse(error)) {
    const res = error.context
    try {
      const text = await res.clone().text()
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string }
          const msg = typeof parsed?.error === 'string' ? parsed.error : typeof parsed?.message === 'string' ? parsed.message : ''
          if (msg.length > 0) return msg
        } catch {
          /* not JSON */
        }
        return text
      }
    } catch {
      /* fall through */
    }
  }
  return error instanceof Error && error.message ? error.message : 'Unable to provision account.'
}

export async function provisionClubUser(input: ProvisionClubUserInput): Promise<ProvisionClubUserResult> {
  if (!supabase) {
    throw new Error(supabaseConfigError)
  }

  const { data, error } = await supabase.functions.invoke<ProvisionClubUserResult>('provision-club-user', {
    body: input,
  })

  if (error) {
    throw new Error(await messageFromFunctionsError(error))
  }

  if (!data) {
    throw new Error('Unable to provision account.')
  }

  return data
}
