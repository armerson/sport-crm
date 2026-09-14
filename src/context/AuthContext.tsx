import { completeRegistration, selfServiceRoles } from '../services/registrationCompletion.ts'
import { safeReturnPath } from '../utils/workspace.ts'
import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabase.ts'
import { normalizeRoles } from '../services/supabaseHelpers.ts'
import type {
  AuthContextValue,
  SignInInput,
  SignUpInput,
  UserProfile,
} from '../types/auth.ts'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ---------- sessionStorage profile cache ----------
// Caches the user profile for the lifetime of the browser tab so a page
// refresh never blocks on DB queries. The cache is keyed by user ID and
// invalidated automatically when the user signs out or the ID changes.
const PROFILE_CACHE_KEY = 'crm_profile_cache'

function readCachedProfile(userId: string): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId: string; profile: UserProfile }
    if (parsed.userId !== userId) return null
    return parsed.profile
  } catch {
    return null
  }
}

function writeCachedProfile(userId: string, profile: UserProfile) {
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ userId, profile }))
  } catch { /* sessionStorage unavailable — ignore */ }
}

function clearCachedProfile() {
  try { sessionStorage.removeItem(PROFILE_CACHE_KEY) } catch { /* ignore */ }
}
// --------------------------------------------------

async function loadUserProfile(user: User): Promise<UserProfile> {
  if (!supabase) {
    throw new Error(supabaseConfigError)
  }

  const [{ data: profileRow, error: profileError }, { data: teamRows, error: teamError }, { data: childRows, error: childError }] = await Promise.all([
    supabase.from('profiles').select('id, name, email, roles, linked_player_id').eq('id', user.id).maybeSingle(),
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
      roles: selfServiceRoles(user.user_metadata),
      teams: [],
      children: [],
      linkedPlayerId: null,
    }

    const { error: insertError } = await supabase.from('profiles').upsert({
      id: fallbackProfile.id,
      name: fallbackProfile.name,
      email: fallbackProfile.email,
      roles: fallbackProfile.roles,
    })

    if (insertError) {
      throw new Error(insertError.message)
    }

    return fallbackProfile
  }

  const linkedPlayerId =
    typeof profileRow.linked_player_id === 'string' ? profileRow.linked_player_id : null

  return {
    id: user.id,
    name: typeof profileRow.name === 'string' && profileRow.name.length > 0 ? profileRow.name : ((user.user_metadata.name as string | undefined) ?? 'Club Member'),
    email: typeof profileRow.email === 'string' ? profileRow.email : user.email ?? '',
    roles: normalizeRoles(profileRow.roles),
    teams: Array.isArray(teamRows) ? teamRows.map((row) => row.team_id).filter(Boolean) : [],
    children: Array.isArray(childRows) ? childRows.map((row) => row.player_id).filter(Boolean) : [],
    linkedPlayerId,
  }
}

/** Complete signup only after the auth listener has released its session lock. */
async function completePendingRegistration(user: User, profile: UserProfile): Promise<boolean> {
  if (!supabase) return false
  const client = supabase
  let storage: Storage | undefined
  try { storage = window.sessionStorage } catch { /* Optional browser storage. */ }
  return completeRegistration(user.user_metadata, profile, {
    rpc: (name, args) => client.rpc(name, args),
    clearMetadata: (data) => client.auth.updateUser({ data }),
    storage,
  })
}

function getAuthMessage(error: unknown): string {
  const rawMessage =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : null

  if (!rawMessage) {
    return 'Authentication failed. Please try again.'
  }

  const message = rawMessage.toLowerCase()

  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'That email address is already in use.'
  }

  if (message.includes('invalid login credentials')) {
    return 'Incorrect email or password.'
  }

  if (message.includes('email not confirmed')) {
    return 'Check your email and confirm your account before signing in.'
  }

  if (message.includes('email') && message.includes('invalid')) {
    return 'Please enter a valid email address.'
  }

  if (message.includes('password') && message.includes('6')) {
    return 'Password must be at least 6 characters.'
  }

  return rawMessage
}

async function syncSessionProfile(
  session: Session | null,
  setCurrentUser: (user: User | null) => void,
  setProfile: (profile: UserProfile | null) => void,
  setError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
  isCurrent: () => boolean = () => true,
) {
  const user = session?.user ?? null
  setCurrentUser(user)

  if (!user) {
    clearCachedProfile()
    setProfile(null)
    setLoading(false)
    return
  }

  // Serve cached profile immediately so the UI appears without any DB round-trip.
  const cached = readCachedProfile(user.id)
  if (cached) {
    setProfile(cached)
    setLoading(false)
  }

  try {
    let nextProfile = await loadUserProfile(user)
    if (!isCurrent()) return
    const ranRegistration = await completePendingRegistration(user, nextProfile)
    if (ranRegistration) {
      nextProfile = await loadUserProfile(user)
    }
    if (!isCurrent()) return
    writeCachedProfile(user.id, nextProfile)
    setProfile(nextProfile)
    setError(null)
  } catch (authError) {
    if (!isCurrent()) return
    clearCachedProfile()
    setProfile(null)
    setError(getAuthMessage(authError))
  } finally {
    if (isCurrent()) setLoading(false)
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

    let active = true
    let revision = 0
    let previousUserId: string | null = null
    let queue = Promise.resolve()
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentRevision = ++revision
      // Do not call auth methods from inside the auth event callback. Queue work
      // outside the callback and serialize it so metadata updates cannot re-enter.
      if (!session) {
        previousUserId = null
        clearCachedProfile()
        setCurrentUser(null)
        setProfile(null)
        setLoading(false)
        setError(null)
        return
      }
      if (previousUserId !== session.user.id) setLoading(true)
      previousUserId = session.user.id
      const timer = setTimeout(() => {
        timers.delete(timer)
        const isCurrent = () => active && currentRevision === revision
        queue = queue.then(async () => {
          if (isCurrent()) await syncSessionProfile(session, setCurrentUser, setProfile, setError, setLoading, isCurrent)
        }).catch(() => { if (isCurrent()) { setError('Unable to finish sign-in. Please try again.'); setLoading(false) } })
      }, 0)
      timers.add(timer)
    })
    return () => {
      active = false
      timers.forEach(clearTimeout)
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
      signUp: async ({
        name,
        email,
        password,
        roles,
        signupChildren,
        playerDob,
        emailRedirectPath,
      }: SignUpInput) => {
        if (!supabase) {
          setError(supabaseConfigError)
          throw new Error(supabaseConfigError)
        }

        setError(null)

        const isPlayer = roles.includes('player')
        const signupRoles = isPlayer ? ['player'] : ['parent']
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${safeReturnPath(emailRedirectPath ?? '/')}`,
            data: {
              name,
              roles: signupRoles,
              signup_children: !isPlayer && signupChildren?.length ? signupChildren : undefined,
              signup_account: isPlayer ? 'player' : undefined,
              player_dob: isPlayer ? playerDob : undefined,
            },
          },
        })

        if (signUpError) {
          const message = getAuthMessage(signUpError)
          setError(message)
          throw new Error(message)
        }

        return { requiresEmailConfirmation: !data.session }
      },
      resetPassword: async (email: string) => {
        if (!supabase) {
          setError(supabaseConfigError)
          return
        }

        setError(null)
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        })

        if (resetError) {
          const message = getAuthMessage(resetError)
          setError(message)
          throw new Error(message)
        }
      },
      signOutUser: async () => {
        if (!supabase) {
          return
        }

        await supabase.auth.signOut()
      },
      updateProfile: async (name: string) => {
        if (!supabase || !currentUser) return
        const trimmed = name.trim()
        if (!trimmed) return
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ name: trimmed })
          .eq('id', currentUser.id)
        if (updateError) throw new Error(updateError.message)
        // Patch local state and cache so the UI updates immediately
        setProfile((prev) => {
          if (!prev) return prev
          const next = { ...prev, name: trimmed }
          writeCachedProfile(currentUser.id, next)
          return next
        })
      },
      refreshProfile: async () => {
        if (!supabase) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        try {
          const nextProfile = await loadUserProfile(user)
          writeCachedProfile(user.id, nextProfile)
          setProfile(nextProfile)
        } catch {
          /* keep existing profile */
        }
      },
    }),
    [currentUser, error, loading, profile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
