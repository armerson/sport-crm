/**
 * ClubOS club registry.
 *
 * The registry is the operator-managed list of clubs that this build of ClubOS
 * knows about. It is the only place a club's backend connection may come from:
 * members can search and choose a listed club, but they can never supply a
 * backend URL, key or redirect destination themselves.
 *
 * Every entry is validated strictly. A malformed registry is rejected as a
 * whole rather than partially trusted.
 *
 * See docs/adr/0001-club-isolation-model.md.
 */

export const CLUB_STATUSES = ['active', 'onboarding', 'suspended'] as const
export type ClubStatus = (typeof CLUB_STATUSES)[number]

export interface ClubLocation {
  town: string
  region?: string
  country?: string
}

export interface ClubBranding {
  primaryColor: string
  secondaryColor?: string
  badgeUrl?: string
}

/** Public Supabase connection for a club's own, separate backend. */
export interface ClubBackend {
  supabaseUrl: string
  /** Public anon or publishable key. Secret and service-role keys are rejected. */
  anonKey: string
}

export interface RegistryClub {
  /** Stable, unique, URL-safe identifier, e.g. `ambassadors-fc`. */
  code: string
  name: string
  sport: string
  status: ClubStatus
  location?: ClubLocation
  branding?: ClubBranding
  /** Origin of a separately deployed ClubOS app for this club, if it has one. */
  origin?: string
  /** The club's public website, whether external or ClubOS-hosted. */
  website?: string
  /** Backend used when this build lets members choose the club in-app. */
  backend?: ClubBackend
  /** Subscription package id. Prices and features live in plans.ts, never here. */
  plan?: string
  /** Operator overrides on top of the plan's features. */
  features?: Record<string, boolean>
}

export interface RegistryOptions {
  /**
   * Permit `http://localhost` / `http://127.0.0.1` backends for local Supabase
   * development. Never enable this in production builds.
   */
  allowLocalBackends?: boolean
  /** Extra operator-approved backend hosts, e.g. a Supabase custom domain. */
  allowedBackendHosts?: readonly string[]
}

export class RegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistryError'
  }
}

const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/
const SPORT_PATTERN = /^[a-z][a-z0-9-]{1,29}$/
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const FEATURE_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{1,49}$/
const SUPABASE_HOST_PATTERN = /^([a-z0-9]{20})\.supabase\.co$/
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

function fail(message: string): never {
  throw new RegistryError(message)
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`Invalid ${field}.`)
  return value.trim()
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  return value === undefined ? undefined : text(value, field, max)
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Invalid ${field}.`)
  return value as Record<string, unknown>
}

/** A public HTTPS URL without credentials, port, query or fragment. */
export function parseHttpsUrl(value: unknown, field: string): URL {
  if (typeof value !== 'string') fail(`Invalid ${field}.`)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    fail(`Invalid ${field}.`)
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
    fail(`${field} must be a public HTTPS URL without credentials, port, query or fragment.`)
  }
  return url
}

function parseOrigin(value: unknown, field: string): string {
  const url = parseHttpsUrl(value, field)
  if (url.pathname !== '/') fail(`${field} must not contain a path.`)
  return url.origin
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload: unknown = JSON.parse(atob(padded))
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Accepts only keys that are designed to be public. A service-role or secret
 * key in a frontend registry would bypass every row-level security policy, so
 * it is rejected outright rather than merely discouraged.
 */
export function validatePublicKey(key: unknown, projectRef: string | null): string {
  if (typeof key !== 'string' || !key.trim() || key.length > 2048) fail('Invalid backend key.')
  const value = key.trim()
  if (value.startsWith('sb_secret_')) fail('Secret backend keys must never be placed in the club registry.')
  if (value.startsWith('sb_publishable_')) {
    if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(value)) fail('Invalid publishable key.')
    return value
  }
  const payload = decodeJwtPayload(value)
  if (!payload) fail('Backend key must be a Supabase anon JWT or publishable key.')
  if (payload.role !== 'anon') fail('Only anon backend keys are allowed; service-role keys bypass row-level security.')
  if (projectRef && typeof payload.ref === 'string' && payload.ref !== projectRef) {
    fail('Backend key belongs to a different Supabase project than its URL.')
  }
  return value
}

export function parseBackend(value: unknown, options: RegistryOptions = {}): ClubBackend {
  const raw = record(value, 'backend')
  if (typeof raw.supabaseUrl !== 'string') fail('Invalid backend URL.')
  let url: URL
  try {
    url = new URL(raw.supabaseUrl)
  } catch {
    fail('Invalid backend URL.')
  }
  const isLocal = options.allowLocalBackends === true && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)
  if (!isLocal) {
    parseOrigin(raw.supabaseUrl, 'backend URL')
    const approved = SUPABASE_HOST_PATTERN.test(url.hostname) || (options.allowedBackendHosts ?? []).includes(url.hostname)
    if (!approved) fail('Backend URL is not a Supabase project or an operator-approved host.')
  } else if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    fail('Invalid local backend URL.')
  }
  const projectRef = SUPABASE_HOST_PATTERN.exec(url.hostname)?.[1] ?? null
  return { supabaseUrl: url.origin, anonKey: validatePublicKey(raw.anonKey, projectRef) }
}

function parseLocation(value: unknown): ClubLocation | undefined {
  if (value === undefined) return undefined
  const raw = record(value, 'location')
  const location: ClubLocation = { town: text(raw.town, 'location town', 80) }
  const region = optionalText(raw.region, 'location region', 80)
  const country = optionalText(raw.country, 'location country', 80)
  if (region) location.region = region
  if (country) location.country = country
  return location
}

function parseColor(value: unknown, field: string): string {
  if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) fail(`Invalid ${field}.`)
  return value.toLowerCase()
}

function parseBranding(value: unknown): ClubBranding | undefined {
  if (value === undefined) return undefined
  const raw = record(value, 'branding')
  const branding: ClubBranding = { primaryColor: parseColor(raw.primaryColor, 'primary colour') }
  if (raw.secondaryColor !== undefined) branding.secondaryColor = parseColor(raw.secondaryColor, 'secondary colour')
  if (raw.badgeUrl !== undefined) branding.badgeUrl = parseHttpsUrl(raw.badgeUrl, 'badge URL').href
  return branding
}

function parseFeatures(value: unknown): Record<string, boolean> | undefined {
  if (value === undefined) return undefined
  const raw = record(value, 'features')
  const features: Record<string, boolean> = {}
  for (const [key, enabled] of Object.entries(raw)) {
    if (!FEATURE_KEY_PATTERN.test(key) || typeof enabled !== 'boolean') fail('Invalid feature override.')
    features[key] = enabled
  }
  return features
}

export function parseRegistryClub(value: unknown, options: RegistryOptions = {}): RegistryClub {
  const raw = record(value, 'club entry')
  const { code } = raw
  if (typeof code !== 'string' || !CODE_PATTERN.test(code)) fail('Invalid club code.')
  const sport = raw.sport === undefined ? 'football' : raw.sport
  if (typeof sport !== 'string' || !SPORT_PATTERN.test(sport)) fail('Invalid sport.')
  const status = raw.status === undefined ? 'active' : raw.status
  if (!CLUB_STATUSES.includes(status as ClubStatus)) fail('Invalid club status.')
  const plan = raw.plan === undefined ? undefined : raw.plan
  if (plan !== undefined && (typeof plan !== 'string' || !CODE_PATTERN.test(plan))) fail('Invalid plan.')

  const club: RegistryClub = { code, name: text(raw.name, 'club name', 100), sport, status: status as ClubStatus }
  const location = parseLocation(raw.location)
  const branding = parseBranding(raw.branding)
  const features = parseFeatures(raw.features)
  if (location) club.location = location
  if (branding) club.branding = branding
  if (raw.origin !== undefined) club.origin = parseOrigin(raw.origin, 'club origin')
  if (raw.website !== undefined) club.website = parseHttpsUrl(raw.website, 'club website').href
  if (raw.backend !== undefined) club.backend = parseBackend(raw.backend, options)
  if (plan) club.plan = plan
  if (features) club.features = features
  if (!club.origin && !club.backend) fail(`Club ${code} needs an origin or a backend.`)
  return club
}

/**
 * Parses the operator-managed registry. Codes, app origins and backends must
 * all be unique: two clubs sharing one backend would share one database.
 */
export function parseClubRegistry(raw: string | undefined, options: RegistryOptions = {}): RegistryClub[] {
  if (!raw?.trim()) return []
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    fail('Club registry is not valid JSON.')
  }
  if (!Array.isArray(value)) fail('Club registry must be an array.')
  if (value.length > 500) fail('Club registry is too large for a build-time configuration.')
  const codes = new Set<string>()
  const origins = new Set<string>()
  const backends = new Set<string>()
  return value.map((entry: unknown) => {
    const club = parseRegistryClub(entry, options)
    if (codes.has(club.code)) fail(`Duplicate club code ${club.code}.`)
    codes.add(club.code)
    if (club.origin) {
      if (origins.has(club.origin)) fail(`Duplicate club origin for ${club.code}.`)
      origins.add(club.origin)
    }
    if (club.backend) {
      if (backends.has(club.backend.supabaseUrl)) fail(`Clubs must not share a backend (${club.code}).`)
      backends.add(club.backend.supabaseUrl)
    }
    return club
  })
}

/** Clubs members may see and choose. Onboarding and suspended clubs are hidden. */
export function listedClubs(clubs: readonly RegistryClub[]): RegistryClub[] {
  return clubs.filter((club) => club.status === 'active')
}

function normalise(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Search by club name, code or location. */
export function searchClubs(clubs: readonly RegistryClub[], query: string): RegistryClub[] {
  const term = normalise(query)
  const listed = listedClubs(clubs)
  if (!term) return listed
  return listed.filter((club) => {
    const haystack = [club.name, club.code, club.location?.town, club.location?.region, club.location?.country]
      .filter((part): part is string => Boolean(part))
      .map(normalise)
    return haystack.some((part) => part.includes(term))
  })
}

export function findClub(clubs: readonly RegistryClub[], code: string | null | undefined): RegistryClub | null {
  if (!code || !CODE_PATTERN.test(code)) return null
  return listedClubs(clubs).find((club) => club.code === code) ?? null
}

export const CLUB_ENTRY_ACTIONS = ['login', 'register'] as const
export type ClubEntryAction = (typeof CLUB_ENTRY_ACTIONS)[number]

export function isClubEntryAction(value: unknown): value is ClubEntryAction {
  return CLUB_ENTRY_ACTIONS.includes(value as ClubEntryAction)
}

/** Fixed entry routes only, so a club link can never become an open redirect. */
export function clubEntryPath(action: ClubEntryAction): string {
  return action === 'register' ? '/register' : '/login'
}
