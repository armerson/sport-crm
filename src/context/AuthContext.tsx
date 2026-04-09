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
      roles: normalizeRoles(user.user_metadata.roles ?? user.user_metadata.role),
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

/** Runs signup RPCs using auth metadata (works after email confirmation). */
async function completePendingRegistration(user: User, profile: UserProfile): Promise<boolean> {
  if (!supabase) return false

  const meta = user.user_metadata as Record<string, unknown>
  let changed = false

  // Process a pending team invite (stored in sessionStorage by JoinPage after signup/signin)
  const pendingInviteCode = sessionStorage.getItem('pending_invite_code')
  if (pendingInviteCode) {
    sessionStorage.removeItem('pending_invite_code')
    await supabase.rpc('use_team_invite', { p_code: pendingInviteCode }).then(() => undefined, () => undefined)
    changed = true
  }

  const pendingClubCode = sessionStorage.getItem('pending_club_invite_code')
  if (pendingClubCode) {
    sessionStorage.removeItem('pending_club_invite_code')
    await supabase.rpc('use_club_invite', { p_code: pendingClubCode }).then(() => undefined, () => undefined)
    changed = true
  }

  const signupChildren = meta.signup_children as Array<{ name: string; dob: string }> | undefined
  if (profile.roles.includes('parent') && signupChildren?.length && profile.children.length === 0) {
    const { error } = await supabase.rpc('register_signup_children', {
      children: signupChildren,
    })
    if (!error) {
      await supabase.auth.updateUser({ data: { signup_children: null } })
      changed = true
    }
  }

  if (
    profile.roles.includes('player')
    && !profile.linkedPlayerId
    && meta.signup_account === 'player'
    && typeof meta.player_dob === 'string'
    && meta.player_dob.length > 0
  ) {
    const { error } = await supabase.rpc('register_self_as_player', {
      p_name: profile.name.trim(),
      p_dob: meta.player_dob,
    })
    if (!error) {
      await supabase.auth.updateUser({ data: { signup_account: null, player_dob: null } })
      changed = true
    }
  }

  return changed
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
    // Refresh in the background to pick up any role or team changes.
    void (async () => {
      try {
        const nextProfile = await loadUserProfile(user)
        writeCachedProfile(user.id, nextProfile)
        setProfile(nextProfile)
      } catch { /* silent — user already has a working profile */ }
    })()
    return
  }

  try {
    let nextProfile = await loadUserProfile(user)
    const ranRegistration = await completePendingRegistration(user, nextProfile)
    if (ranRegistration) {
      nextProfile = await loadUserProfile(user)
    }
    writeCachedProfile(user.id, nextProfile)
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

    // onAuthStateChange fires INITIAL_SESSION immediately on subscription,
    // covering the same case as getSession(). Using only one listener avoids
    // a double-call to syncSessionProfile (and the resulting 6 parallel DB
    // connections) that was causing ~15 s load times on the Nano plan.
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
      signUp: async ({
        name,
        email,
        password,
        roles,
        signupChildren,
        playerDob,
      }: SignUpInput) => {
        if (!supabase) {
          setError(supabaseConfigError)
          return
        }

        setError(null)

        const isPlayer = roles.includes('player')
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              roles,
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

        if (data.user && data.session) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            name,
            email,
            roles,
          })

          if (profileError) {
            const message = getAuthMessage(profileError)
            setError(message)
            throw new Error(message)
          }
        }
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
