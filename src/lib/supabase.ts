import { createClient } from '@supabase/supabase-js'
import { activeBackend } from '../clubos/runtime.ts'

/**
 * The single Supabase client for this app instance.
 *
 * Standalone deployments (Ambassadors FC today) connect to the backend in their
 * build environment exactly as before. In multi-club mode the backend comes
 * only from the operator-managed club registry, and the auth session is stored
 * under a club-specific key so clubs never share a sign-in.
 */
export const supabaseUrl = activeBackend.backend?.supabaseUrl ?? ''
const supabaseAnonKey = activeBackend.backend?.anonKey ?? ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabaseConfigError =
  activeBackend.mode === 'multi'
    ? 'Choose your club to continue.'
    : 'Supabase is not configured. Copy .env.example to .env.local and add your Supabase project credentials.'

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        ...(activeBackend.authStorageKey ? { storageKey: activeBackend.authStorageKey } : {}),
      },
    })
  : null
