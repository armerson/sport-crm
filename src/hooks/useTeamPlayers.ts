import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { subscribeToPlayers } from '../services/adminClub.ts'
import type { PlayerRecord } from '../types/club.ts'

export function useTeamPlayers(teamId: string) {
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const configError = !isSupabaseConfigured ? (teamId ? supabaseConfigError : null) : null

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    if (!teamId) {
      return undefined
    }

    const unsubscribe = subscribeToPlayers(
      teamId,
      (nextPlayers) => {
        setPlayers(nextPlayers)
        setError(null)
      },
      (message) => {
        setError(message)
      },
    )

    return unsubscribe
  }, [teamId])

  return {
    players: teamId ? players : [],
    loading: false,
    error: teamId ? (configError ?? error) : null,
  }
}