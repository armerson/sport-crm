/**
 * Loads the club directory from the ClubOS control plane (ADR 0001, Phase 2).
 *
 * The control plane is a separate, operator-owned Supabase project. Its public
 * `clubs_public` view returns active clubs already shaped as registry entries.
 * Everything fetched goes through the same validator as the bundled registry,
 * and a directory that fails validation is never used or cached.
 *
 * Order of preference: fresh directory, then the last good copy on this
 * device, then the bundled `VITE_CLUBOS_REGISTRY_JSON`.
 */
import { parseBackend, parseClubRegistry, type ClubBackend, type RegistryOptions } from './registry.ts'
import { resolveMode, type KeyValueStorage, type ModeEnv } from './session.ts'

export interface RegistryOptionsEnv {
  DEV?: boolean
  VITE_CLUBOS_BACKEND_HOSTS?: string
}

/** Registry validation options for this build. Local backends only in dev. */
export function registryOptionsFromEnv(env: RegistryOptionsEnv): RegistryOptions {
  const allowedBackendHosts = (env.VITE_CLUBOS_BACKEND_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
  return { allowLocalBackends: Boolean(env.DEV), allowedBackendHosts }
}

export interface ControlPlaneEnv extends ModeEnv {
  VITE_CLUBOS_CONTROL_PLANE_URL?: string
  VITE_CLUBOS_CONTROL_PLANE_ANON_KEY?: string
}

/** Device-wide: the directory is public operator data, not a club's data. */
export const DIRECTORY_CACHE_KEY = 'clubos:directory-cache'
const FETCH_TIMEOUT_MS = 4000
const MAX_DIRECTORY_BYTES = 512 * 1024

/**
 * The control plane to read, or null when this build does not use one.
 * Standalone builds never fetch a directory. Invalid settings throw.
 */
export function controlPlaneConfig(env: ControlPlaneEnv, options: RegistryOptions = {}): ClubBackend | null {
  if (resolveMode(env) === 'standalone') return null
  const supabaseUrl = env.VITE_CLUBOS_CONTROL_PLANE_URL?.trim()
  const anonKey = env.VITE_CLUBOS_CONTROL_PLANE_ANON_KEY?.trim()
  if (!supabaseUrl && !anonKey) return null
  return parseBackend({ supabaseUrl, anonKey }, options)
}

/** Turns `clubs_public` rows into registry JSON. Throws on anything unexpected. */
export function registryJsonFromDirectory(rows: unknown, options: RegistryOptions = {}): string {
  if (!Array.isArray(rows)) throw new Error('Club directory response must be an array.')
  const entries = rows.map((row) => {
    if (!row || typeof row !== 'object' || !('entry' in row)) throw new Error('Club directory row has no entry.')
    return (row as { entry: unknown }).entry
  })
  const json = JSON.stringify(entries)
  parseClubRegistry(json, options) // reject the whole directory if any entry is invalid
  return json
}

export interface DirectoryResult {
  /** Registry JSON to use, or null to fall back to the bundled registry. */
  json: string | null
  source: 'control-plane' | 'cache' | 'bundled'
}

export async function loadClubDirectory(
  config: ClubBackend,
  options: RegistryOptions,
  cache: KeyValueStorage | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<DirectoryResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetchImpl(`${config.supabaseUrl}/rest/v1/clubs_public?select=entry&order=code`, {
        headers: { apikey: config.anonKey, Accept: 'application/json' },
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      })
    } finally {
      clearTimeout(timer)
    }
    if (!response.ok) throw new Error(`Club directory returned HTTP ${response.status}.`)
    const text = await response.text()
    if (text.length > MAX_DIRECTORY_BYTES) throw new Error('Club directory is too large.')
    const json = registryJsonFromDirectory(JSON.parse(text), options)
    try {
      cache?.setItem(DIRECTORY_CACHE_KEY, json)
    } catch {
      /* Storage full or blocked: the fresh copy is still used. */
    }
    return { json, source: 'control-plane' }
  } catch (error) {
    console.warn('[ClubOS] Club directory unavailable, using fallback:', error)
  }
  try {
    const cached = cache?.getItem(DIRECTORY_CACHE_KEY)
    if (cached) {
      parseClubRegistry(cached, options)
      return { json: cached, source: 'cache' }
    }
  } catch {
    try {
      cache?.removeItem(DIRECTORY_CACHE_KEY)
    } catch {
      /* ignore */
    }
  }
  return { json: null, source: 'bundled' }
}
