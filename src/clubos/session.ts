/**
 * Club selection and per-club isolation of browser state.
 *
 * Pure functions with injected storage so they can be tested without a
 * browser. `runtime.ts` wires them to the real environment.
 */
import { findClub, type ClubBackend, type RegistryClub } from './registry.ts'

/**
 * - `standalone`: one branded deployment per club, backend from build env.
 *   This is how Ambassadors FC runs today and remains the default.
 * - `directory`: a central finder with no backend; links to each club's app.
 * - `multi`: one app (web or native) where the member chooses a registered
 *   club and the app connects to that club's own backend.
 */
export type ClubOSMode = 'standalone' | 'directory' | 'multi'

export interface ModeEnv {
  VITE_CLUBOS_MODE?: string
  /** Legacy flag from the first multi-club branch. */
  VITE_CLUB_DIRECTORY_ONLY?: string
}

export function resolveMode(env: ModeEnv): ClubOSMode {
  const mode = env.VITE_CLUBOS_MODE?.trim()
  if (mode === 'standalone' || mode === 'directory' || mode === 'multi') return mode
  if (env.VITE_CLUB_DIRECTORY_ONLY === 'true') return 'directory'
  return 'standalone'
}

/** Minimal Storage surface so tests can supply a Map-backed fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const SELECTED_CLUB_KEY = 'clubos:selected-club'
const SCOPE_PREFIX = 'clubos:club:'

/**
 * Storage key for club-specific browser state. In standalone mode the key is
 * returned unchanged so existing Ambassadors sessions and caches keep working.
 */
export function clubScopedKey(clubCode: string | null, key: string): string {
  return clubCode ? `${SCOPE_PREFIX}${clubCode}:${key}` : key
}

/** Supabase auth token key, so each club keeps its own sign-in. */
export function clubAuthStorageKey(clubCode: string): string {
  return clubScopedKey(clubCode, 'auth')
}

/** Wraps a storage so every key is confined to one club's namespace. */
export function scopedStorage(storage: KeyValueStorage, clubCode: string | null): KeyValueStorage {
  if (!clubCode) return storage
  return {
    getItem: (key) => storage.getItem(clubScopedKey(clubCode, key)),
    setItem: (key, value) => storage.setItem(clubScopedKey(clubCode, key), value),
    removeItem: (key) => storage.removeItem(clubScopedKey(clubCode, key)),
  }
}

function safeGet(storage: KeyValueStorage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

/**
 * Returns the remembered club only if it is still listed and has a backend.
 * A tampered, removed or suspended selection is discarded, never trusted.
 */
export function readSelectedClub(storage: KeyValueStorage | undefined, registry: readonly RegistryClub[]): RegistryClub | null {
  const code = safeGet(storage, SELECTED_CLUB_KEY)
  if (!code) return null
  const club = findClub(registry, code)
  if (club?.backend) return club
  try { storage?.removeItem(SELECTED_CLUB_KEY) } catch { /* Storage is optional. */ }
  return null
}

export function rememberSelectedClub(storage: KeyValueStorage | undefined, club: RegistryClub): void {
  if (!club.backend) throw new Error('This club is not available in the ClubOS app yet.')
  storage?.setItem(SELECTED_CLUB_KEY, club.code)
}

export function forgetSelectedClub(storage: KeyValueStorage | undefined): void {
  try { storage?.removeItem(SELECTED_CLUB_KEY) } catch { /* Storage is optional. */ }
}

export interface BackendEnv extends ModeEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export interface ActiveBackend {
  mode: ClubOSMode
  /** Null in standalone mode: the deployment itself is the club. */
  club: RegistryClub | null
  backend: ClubBackend | null
  /** Custom auth storage key, or null to keep Supabase's default. */
  authStorageKey: string | null
}

/**
 * Decides which backend this app instance may talk to.
 * Only build-time env (standalone) or the validated registry (multi) are
 * sources; nothing here reads a URL from the address bar or user input.
 */
export function resolveActiveBackend(env: BackendEnv, registry: readonly RegistryClub[], storage: KeyValueStorage | undefined): ActiveBackend {
  const mode = resolveMode(env)
  if (mode === 'directory') return { mode, club: null, backend: null, authStorageKey: null }
  if (mode === 'multi') {
    const club = readSelectedClub(storage, registry)
    return { mode, club, backend: club?.backend ?? null, authStorageKey: club ? clubAuthStorageKey(club.code) : null }
  }
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_ANON_KEY?.trim()
  return { mode, club: null, backend: url && key ? { supabaseUrl: url, anonKey: key } : null, authStorageKey: null }
}

/**
 * Public entry routes a club link may open. Anything else is refused, so a
 * club-specific link can never be turned into an open redirect or a deep link
 * into private workspace state.
 */
const ENTRY_PATTERNS: readonly RegExp[] = [
  /^\/login$/,
  /^\/register$/,
  /^\/register\/parent$/,
  /^\/register\/[a-z0-9-]{1,60}$/,
  /^\/reset-password$/,
  /^\/join\/[A-Za-z0-9_-]{4,64}$/,
  /^\/join\/club\/[A-Za-z0-9_-]{4,64}$/,
  /^\/pay\/camp\/success$/,
  /^\/pay\/camp\/[A-Za-z0-9-]{1,64}$/,
]

/** Normalises a path to an allowed public entry route, or returns null. */
export function safeEntryPath(path: string | undefined): string | null {
  if (path === undefined || path === '' || path === '/') return '/login'
  if (path.length > 200) return null
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  return ENTRY_PATTERNS.some((pattern) => pattern.test(trimmed)) ? trimmed : null
}

const CLUB_PATH_PATTERN = /^\/clubs\/([a-z0-9][a-z0-9-]{1,39})(\/.*)?$/

/** Parses `/clubs/<code>/<entry>` links. Returns null for other paths. */
export function parseClubEntryPath(pathname: string): { code: string; path: string | null } | null {
  const match = CLUB_PATH_PATTERN.exec(pathname)
  if (!match) return null
  return { code: match[1], path: safeEntryPath(match[2]) }
}

/**
 * Path for a link shared outside the app (invitations, registration, camp
 * payments, email confirmation). In multi-club mode the link carries the club
 * code so it opens the right club on any device. Standalone links are unchanged.
 */
export function clubSharePath(clubCode: string | null, path: string): string {
  if (!clubCode) return path
  const entry = safeEntryPath(path)
  return entry ? `/clubs/${clubCode}${entry}` : `/clubs/${clubCode}`
}

/**
 * In multi-club mode, a `/clubs/<code>/...` link selects that club before the
 * backend client is created, so an email confirmation or invitation is always
 * processed by its own club's backend and never by a previously chosen one.
 */
export function selectClubFromPath(
  env: ModeEnv,
  pathname: string,
  registry: readonly RegistryClub[],
  storage: KeyValueStorage | undefined,
): RegistryClub | null {
  if (resolveMode(env) !== 'multi') return null
  const entry = parseClubEntryPath(pathname)
  const club = entry ? findClub(registry, entry.code) : null
  if (!club?.backend) return null
  try { rememberSelectedClub(storage, club) } catch { return null }
  return club
}
