export interface DirectoryClub {
  code: string
  name: string
  origin: string
  website?: string
}

function httpsUrl(value: unknown): URL {
  if (typeof value !== 'string') throw new Error('Invalid URL.')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('Use a public HTTPS URL without credentials, port, query or fragment.')
  }
  return url
}

/** Only operator-configured destinations are accepted, never URLs entered by members. */
export function parseClubDirectory(raw: string | undefined): DirectoryClub[] {
  if (!raw?.trim()) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value)) throw new Error('Club directory must be an array.')
  const codes = new Set<string>()
  const origins = new Set<string>()
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid club entry.')
    const { code, name, origin, website } = entry as Record<string, unknown>
    if (typeof code !== 'string' || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(code)) throw new Error('Invalid club code.')
    if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new Error('Invalid club name.')
    const url = httpsUrl(origin)
    if (url.pathname !== '/') throw new Error('Club origin must not contain a path.')
    if (codes.has(code) || origins.has(url.origin)) throw new Error('Duplicate club code or origin.')
    codes.add(code)
    origins.add(url.origin)
    return { code, name: name.trim(), origin: url.origin, ...(website === undefined ? {} : { website: httpsUrl(website).href }) }
  })
}

export function filterDirectory(clubs: readonly DirectoryClub[], query: string): DirectoryClub[] {
  const term = query.trim().toLowerCase()
  return clubs.filter((club) => !term || club.name.toLowerCase().includes(term) || club.code.includes(term))
}

export function clubEntryUrl(club: DirectoryClub, action: 'login' | 'register'): string {
  return new URL(action === 'register' ? '/register' : '/login', club.origin).href
}

export interface PublicClubSite {
  name: string
  introduction: string
  about: string
  programmes: string[]
  contactEmail?: string
  primaryColor: string
}

export function parsePublicClubSite(raw: string | undefined): PublicClubSite | null {
  if (!raw?.trim()) return null
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid site configuration.')
  const { name, introduction, about, programmes, contactEmail, primaryColor } = value as Record<string, unknown>
  const isText = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max
  if (!isText(name, 100) || !isText(introduction, 300) || !isText(about, 3000)) throw new Error('Invalid site content.')
  if (!Array.isArray(programmes) || programmes.length > 12 || !programmes.every((p: unknown) => isText(p, 150))) throw new Error('Invalid programmes.')
  if (contactEmail !== undefined && (typeof contactEmail !== 'string' || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(contactEmail))) throw new Error('Invalid public contact email.')
  if (typeof primaryColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) throw new Error('Invalid brand colour.')
  return { name: name.trim(), introduction, about, programmes: programmes as string[], contactEmail, primaryColor }
}
