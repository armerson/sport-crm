/** Optional operator-configured public website starter (see WEBSITE_BUILDER_ROADMAP.md). */
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
