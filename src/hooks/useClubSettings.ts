import { useEffect, useState } from 'react'
import { fetchClubSettings, saveClubSettings, uploadClubLogo } from '../services/forms.ts'
import type { ClubSettings } from '../types/forms.ts'

const DEFAULT: ClubSettings = { name: 'My Club', logoUrl: null, primaryColor: '#123524' }

/** Module-level cache so multiple consumers don't re-fetch on every mount. */
let cached: ClubSettings | null = null

export function useClubSettings() {
  const [settings, setSettings] = useState<ClubSettings>(cached ?? DEFAULT)
  const [loading, setLoading] = useState(!cached)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cached) { setSettings(cached); setLoading(false); return }
    void fetchClubSettings().then((s) => {
      cached = s
      setSettings(s)
      applyColorVar(s.primaryColor)
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
