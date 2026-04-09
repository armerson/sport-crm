import type { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'coach' | 'parent' | 'player'

export interface UserProfile {
  id: string
  name: string
  email: string
  roles: UserRole[]
  teams: string[]
  children: string[]
  /** Senior self-registered player: their own `players.id` */
  linkedPlayerId: string | null
}

export interface SignInInput {
  email: string
  password: string
}

export interface SignUpChildInput {
  name: string
  dob: string
}

export interface SignUpInput extends SignInInput {
  name: string
  roles: UserRole[]
  /** Stored in auth metadata and applied after first session (email confirm safe). */
  signupChildren?: SignUpChildInput[]
  /** When roles include `player`, date of birth for the player row */
  playerDob?: string
}

export interface AuthContextValue {
  currentUser: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  isConfigured: boolean
  signIn: (input: SignInInput) => Promise<void>
  signUp: (input: SignUpInput) => Promise<void>
  signOutUser: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateProfile: (name: string) => Promise<void>
  /** Reload profile from DB (e.g. after linking a new child). */
  refreshProfile: () => Promise<void>
  clearError: () => void
}
