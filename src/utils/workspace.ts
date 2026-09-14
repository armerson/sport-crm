import type { UserProfile, UserRole } from '../types/auth.ts'

const ROLE_ORDER: UserRole[] = ['admin', 'coach', 'player', 'parent']

export function availableRoles(profile: UserProfile): UserRole[] {
  return ROLE_ORDER.filter((role) => profile.roles.includes(role)
    || (role === 'parent' && profile.children.length > 0)
    || (role === 'player' && Boolean(profile.linkedPlayerId)))
}

export function resolveWorkspaceRole(profile: UserProfile, requested: string | null): UserRole {
  const roles = availableRoles(profile)
  return roles.find((role) => role === requested) ?? roles[0] ?? 'parent'
}

function hasUnsafeCharacters(value: string): boolean {
  return Array.from(value).some((character) => character === '\\' || character.charCodeAt(0) <= 32)
}

/** Keep post-login navigation inside the app, including encoded redirect attempts. */
export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || hasUnsafeCharacters(value)) return '/'
  try {
    const decoded = decodeURIComponent(value)
    if (decoded.startsWith('//') || hasUnsafeCharacters(decoded)) return '/'
    const url = new URL(value, 'https://club.example')
    if (url.origin !== 'https://club.example' || /^\/login\/?$/.test(url.pathname)) return '/'
    return url.pathname + url.search + url.hash
  } catch { return '/' }
}
