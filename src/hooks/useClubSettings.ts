import { useEffect, useState } from 'react'
import { fetchClubSettings, saveClubSettings, uploadClubLogo } from '../services/forms.ts'
import type { ClubSettings } from '../types/forms.ts'

const DEFAULT: ClubSettings = { name: 'My Club', logoUrl: null, primaryColor: '#1565ff', instagramTagline: '', instagramHashtags: '' }
const STORAGE_KEY = 'clubos_settings'

function readStoredSettings(): ClubSettings | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ClubSettings
  } catch { return null }
}

function writeStoredSettings(s: ClubSettings) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

/** Module-level cache so multiple consumers don't re-fetch on every mount. */
let cached: ClubSettings | null = readStoredSettings()

// Apply color immediately from cache so there's no flash on reload
if (cached?.primaryColor) {
  document.documentElement.style.setProperty('--club-color', cached.primaryColor)
}

export function useClubSettings() {
  const [settings, setSettings] = useState<ClubSettings>(cached ?? DEFAULT)
  const [loading, setLoading] = useState(!cached)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Always re-fetch in the background to pick up changes made in another tab
    void fetchClubSettings().then((s) => {
      cached = s
      setSettings(s)
      applyColorVar(s.primaryColor)
      writeStoredSettings(s)
    }).finally(() => setLoading(false))
  }, [])

  async function save(patch: Partial<ClubSettings>, logoFile?: File) {
    setSaving(true)
    setError(null)
    try {
      let logoUrl = patch.logoUrl ?? settings.logoUrl
      if (logoFile) {
        logoUrl = await uploadClubLogo(logoFile)
      }
      const next: ClubSettings = { ...settings, ...patch, logoUrl }
      await saveClubSettings(next)
      cached = next
      setSettings(next)
      applyColorVar(next.primaryColor)
      writeStoredSettings(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  return { settings, loading, saving, error, save }
}

/** Writes the primary colour as a CSS custom property on <html> so Tailwind arbitrary values can use it. */
export function applyColorVar(color: string) {
  document.documentElement.style.setProperty('--club-color', color)
}
