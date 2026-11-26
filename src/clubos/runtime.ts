/**
 * Browser wiring for the ClubOS registry and club session.
 * Evaluated once at start-up, before the Supabase client is created.
 */
import { parseClubRegistry, type RegistryClub } from './registry.ts'
import {
  clubSharePath,
  forgetSelectedClub,
  rememberSelectedClub,
  resolveActiveBackend,
  scopedStorage,
  selectClubFromPath,
  type KeyValueStorage,
} from './session.ts'

function browserStorage(kind: 'localStorage' | 'sessionStorage'): KeyValueStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window[kind]
  } catch {
    return undefined
  }
}

function loadRegistry(): { clubs: RegistryClub[]; error: string | null } {
  try {
    const raw = import.meta.env.VITE_CLUBOS_REGISTRY_JSON || import.meta.env.VITE_CLUB_DIRECTORY_JSON
    const allowedBackendHosts = (import.meta.env.VITE_CLUBOS_BACKEND_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean)
    return { clubs: parseClubRegistry(raw, { allowLocalBackends: import.meta.env.DEV, allowedBackendHosts }), error: null }
  } catch (error) {
    // Reject the whole registry rather than trust part of a malformed one.
    console.error('[ClubOS] Club registry rejected:', error)
    return { clubs: [], error: 'The club directory is unavailable. Please contact your club.' }
  }
}

const registry = loadRegistry()

export const clubRegistry: readonly RegistryClub[] = registry.clubs
export const clubRegistryError = registry.error

// A club-specific link must win over a previously remembered club, and must
// do so before the backend client exists.
selectClubFromPath(
  import.meta.env,
  typeof window === 'undefined' ? '' : window.location.pathname,
  clubRegistry,
  browserStorage('localStorage'),
)

export const activeBackend = resolveActiveBackend(import.meta.env, clubRegistry, browserStorage('localStorage'))
export const clubOSMode = activeBackend.mode
/** The chosen club in multi-club mode; null for standalone deployments. */
export const activeClub = activeBackend.club

const activeClubCode = activeClub?.code ?? null

/** Session storage confined to the active club. Identity in standalone mode. */
export function clubSessionStorage(): KeyValueStorage | undefined {
  const storage = browserStorage('sessionStorage')
  return storage ? scopedStorage(storage, activeClubCode) : undefined
}

/** Local storage confined to the active club. Identity in standalone mode. */
export function clubLocalStorage(): KeyValueStorage | undefined {
  const storage = browserStorage('localStorage')
  return storage ? scopedStorage(storage, activeClubCode) : undefined
}

/**
 * Switches club with a full reload so no module-level client, cache or
 * realtime channel from the previous club survives into the next one.
 */
export function switchToClub(club: RegistryClub, path: '/login' | '/register' = '/login'): void {
  rememberSelectedClub(browserStorage('localStorage'), club)
  window.location.assign(path)
}

export function leaveClub(): void {
  forgetSelectedClub(browserStorage('localStorage'))
  window.location.assign('/clubs')
}

/** Absolute URL for a link shared outside the app. See `clubSharePath`. */
export function clubShareUrl(path: string): string {
  return `${window.location.origin}${clubSharePath(activeClubCode, path)}`
}
