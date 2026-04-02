import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabase.ts'
import type {
  AuthContextValue,
  SignInInput,
  SignUpInput,
  UserProfile,
  UserRole,
} from '../types/auth.ts'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function normalizeRole(value: unknown): UserRole {
  return value === 'admin' || value === 'coach' ? value : 'parent'
}

async function loadUserProfile(user: User): Promise<UserProfile> {
  if (!supabase) {
    throw new Error(supabaseConfigError)
  }

  const [{ data: profileRow, error: profileError }, { data: teamRows, error: teamError }, { data: childRows, error: childError }] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role').eq('id', user.id).maybeSingle(),
    supabase.from('team_coaches').select('team_id').eq('coach_id', user.id),
    supabase.from('player_parents').select('player_id').eq('parent_id', user.id),
  ])

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (teamError) {
    throw new Error(teamError.message)
  }

  if (childError) {
    throw new Error(childError.message)
  }

  if (!profileRow) {
    const fallbackProfile: UserProfile = {
      id: user.id,
      name: (user.user_metadata.name as string | undefined) ?? 'Club Member',
      email: user.email ?? '',
      role: 'parent',
      teams: [],
      children: [],
    }

    const { error: insertError } = await supabase.from('profiles').upsert({
      id: fallbackProfile.id,
      name: fallbackProfile.name,
      email: fallbackProfile.email,
      role: fallbackProfile.role,
    })

    if (insertError) {
      throw new Error(insertError.message)
    }

    return fallbackProfile
  }

  return {
    id: user.id,
    name: typeof profileRow.name === 'string' && profileRow.name.length > 0 ? profileRow.name : ((user.user_metadata.name as string | undefined) ?? 'Club Member'),
    email: typeof profileRow.email === 'string' ? profileRow.email : user.email ?? '',
    role: normalizeRole(profileRow.role),
    teams: Array.isArray(teamRows) ? teamRows.map((row) => row.team_id).filter(Boolean) : [],
    children: Array.isArray(childRows) ? childRows.map((row) => row.player_id).filter(Boolean) : [],
  }
}

function getAuthMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Authentication failed. Please try again.'
  }

  if ('message' in error && typeof error.message === 'string') {
    const message = error.message.toLowerCase()

    if (message.includes('already registered') || message.includes('already been registered')) {
        return 'That email address is already in use.'
    }

    if (message.includes('invalid login credentials')) {
      return 'Incorrect email or password.'
    }

    if (message.includes('email') && message.includes('invalid')) {
        return 'Please enter a valid email address.'
    }

    if (message.includes('password') && message.includes('6')) {
      return 'Password must be at least 6 characters.'
    }
  }

  return error.message
}

async function syncSessionProfile(
  session: Session | null,
  setCurrentUser: (user: User | null) => void,
  setProfile: (profile: UserProfile | null) => void,
  setError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
) {
  const user = session?.user ?? null
  setCurrentUser(user)

  if (!user) {
    setProfile(null)
    setLoading(false)
    return
  }

  try {
    const nextProfile = await loadUserProfile(user)
    setProfile(nextProfile)
    setError(null)
  } catch (authError) {
    setProfile(null)
    setError(getAuthMessage(authError))
  } finally {
    setLoading(false)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(!isSupabaseConfigured ? supabaseConfigError : null)

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError(getAuthMessage(sessionError))
        setLoading(false)
        return
      }

      void syncSessionProfile(data.session, setCurrentUser, setProfile, setError, setLoading)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSessionProfile(session, setCurrentUser, setProfile, setError, setLoading)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      profile,
      loading,
      error,
      isConfigured: isSupabaseConfigured,
      clearError: () => setError(null),
      signIn: async ({ email, password }: SignInInput) => {
        if (!supabase) {
          setError(supabaseConfigError)
          return
        }

        setError(null)
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

        if (signInError) {
          const message = getAuthMessage(signInError)
          setError(message)
          throw new Error(message)
        }
      },
      signUp: async ({ name, email, password, role }: SignUpInput) => {
        if (!supabase) {
          setError(supabaseConfigError)
          return
        }

        setError(null)

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
            },
          },
        })

        if (signUpError) {
          const message = getAuthMessage(signUpError)
          setError(message)
          throw new Error(message)
        }

        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            name,
            email,
            role,
          })

          if (profileError) {
            const message = getAuthMessage(profileError)
            setError(message)
            throw new Error(message)
          }
        }
      },
      signOutUser: async () => {
        if (!supabase) {
          return
        }

        await supabase.auth.signOut()
      },
    }),
    [currentUser, error, loading, profile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }