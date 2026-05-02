import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase.ts'
import { subscribeToAllPlayers } from '../services/adminClub.ts'
import type { PlayerRecord } from '../types/club.ts'

export function useAllPlayers() {
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    const unsubscribe = subscribeToAllPlayers(
      (next) => { setPlayers(next); setLoading(false); setError(null) },
      (msg) => { setError(msg); setLoading(false) },
    )

    return unsubscribe
  }, [])

  return { players, loading, error }
}
