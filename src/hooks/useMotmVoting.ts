import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase.ts'
import { castMotmVote, computeMotmTally, subscribeToMotmVotes } from '../services/coachClub.ts'
import type { MotmTally, MotmVote, PlayerRecord } from '../types/club.ts'

/**
 * Subscribe to MOTM votes for a single past match event and expose
 * the tally + a castVote action.  Safe to mount for non-match or future
 * events (just returns empty state).
 */
export function useMotmVoting(eventId: string, isPastMatch: boolean, players: PlayerRecord[]) {
  const [votes, setVotes] = useState<MotmVote[]>([])

  useEffect(() => {
    if (!eventId || !isPastMatch || !isSupabaseConfigured) {
      setVotes([])
      return undefined
    }
    return subscribeToMotmVotes(
      eventId,
      (next) => setVotes(next),
      () => undefined,
    )
  }, [eventId, isPastMatch])

  const playerNames = useMemo(
    () => new Map(players.map((p) => [p.id, p.name])),
    [players],
  )

  const tally: MotmTally[] = useMemo(
    () => computeMotmTally(votes, playerNames),
    [votes, playerNames],
  )

  function myVote(voterId: string): string | null {
    return votes.find((v) => v.voterId === voterId)?.playerId ?? null
  }

  async function castVote(voterId: string, playerId: string): Promise<void> {
    if (!isSupabaseConfigured || !eventId) return
    await castMotmVote(eventId, voterId, playerId)
  }

  return { tally, myVote, castVote, totalVotes: votes.length }
}
