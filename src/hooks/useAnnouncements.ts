import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { subscribeToAnnouncements } from '../services/messages.ts'
import type { MessageRecord } from '../types/club.ts'

/**
 * Subscribes to all broadcast messages visible to the current user:
 * club-wide announcements and group messages for any group containing
 * the user's teams. Supabase RLS handles authorization automatically.
 */
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<MessageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(supabaseConfigError)
      return undefined
    }

    const unsubscribe = subscribeToAnnouncements(
      (next) => { setAnnouncements(next); setLoading(false) },
      (msg) => { setError(msg); setLoading(false) },
    )

    return unsubscribe
  }, [])

  return { announcements, loading, error }
}
