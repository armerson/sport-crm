import type { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'coach' | 'parent'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  teams: string[]
  children: string[]
}

export interface SignInInput {
  email: string
  password: string
}

export interface SignUpInput extends SignInInput {
  name: string
  role: UserRole
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
  clearError: () => void
}