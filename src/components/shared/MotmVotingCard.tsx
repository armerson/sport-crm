import { useState } from 'react'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import { useMotmVoting } from '../../hooks/useMotmVoting.ts'
import type { PlayerRecord } from '../../types/club.ts'

interface MotmVotingCardProps {
  eventId: string
  isPastMatch: boolean
  /** Pass players directly (coach panel already has them) OR pass teamId to auto-load */
  players?: PlayerRecord[]
  teamId?: string
  /** Current user's ID — used to highlight their vote and to cast votes */
  currentUserId: string
  /** If true shows just the tally (coach/admin read-only view) */
  readOnly?: boolean
  /** ID of the already-confirmed MOTM winner (from results.motm_winner_id) */
  confirmedWinnerId?: string | null
  /** Coach callback to officially confirm a player as MOTM (or null to clear) */
  onConfirmWinner?: (playerId: string | null) => Promise<void>
}

export function MotmVotingCard({
  eventId,
  isPastMatch,
  players: playersProp,
  teamId = '',
  currentUserId,
  readOnly = false,
  confirmedWinnerId = null,
  onConfirmWinner,
}: MotmVotingCardProps) {
  const [confirmState, setConfirmState] = useState<'idle' | 'picking' | 'saving'>('idle')
  const [pickingId, setPickingId] = useState<string>('')

  // Auto-load when teamId provided and no direct players prop
  const { players: loadedPlayers } = useTeamPlayers(playersProp ? '' : teamId)
  const players = playersProp ?? loadedPlayers

  const { tally, myVote, castVote, totalVotes } = useMotmVoting(eventId, isPastMatch, players)

  if (!isPastMatch) return null

  const myCurrentVote = myVote(currentUserId)
  const voteLeader = tally[0]

  async function handleConfirm(playerId: string | null) {
    if (!onConfirmWinner) return
    setPickingId(playerId ?? '')
    setConfirmState('saving')
    try {
      await onConfirmWinner(playerId)
    } finally {
      setConfirmState('idle')
      setPickingId('')
    }
  }

  const confirmedPlayer = confirmedWinnerId ? players.find((p) => p.id === confirmedWinnerId) : null

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h3 className="font-semibold text-slate-900">Man of the Match</h3>
        </div>
        <p className="text-xs text-slate-400">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</p>
      </div>

      {/* Confirmed winner banner */}
      {confirmedPlayer && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="text-lg">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Official MOTM</p>
            <p className="truncate text-sm font-semibold text-amber-900">{confirmedPlayer.name}</p>
          </div>
          {onConfirmWinner && (
            <button
              type="button"
              disabled={confirmState === 'saving'}
              onClick={() => void handleConfirm(null)}
              className="shrink-0 text-xs font-semibold text-amber-600 hover:text-amber-800 disabled:opacity-40"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {players.length === 0 ? (
        <p className="text-sm text-slate-400">No players in squad.</p>
      ) : (
        <div className="space-y-2">
          {players.map((player) => {
            const tallyEntry = tally.find((t) => t.playerId === player.id)
            const votes = tallyEntry?.votes ?? 0
            const isLeader = voteLeader && voteLeader.playerId === player.id && voteLeader.votes > 0
            const isMyVote = myCurrentVote === player.id
            const isConfirmed = confirmedWinnerId === player.id
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0

            return (
              <div
                key={player.id}
                className={`rounded-2xl border px-3 py-2.5 transition ${
                  isConfirmed
                    ? 'border-amber-300 bg-amber-50'
                    : isLeader
                      ? 'border-amber-200 bg-amber-50/60'
                      : isMyVote && !readOnly
                        ? 'border-[#1565ff]/20 bg-[#1565ff]/5'
                        : 'border-transparent bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isConfirmed ? (
                    <span className="shrink-0 text-base leading-none">🏆</span>
                  ) : isLeader ? (
                    <span className="shrink-0 text-base leading-none opacity-40">🏆</span>
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}

                  <p className={`flex-1 truncate text-sm font-medium ${isConfirmed || isLeader ? 'text-amber-900' : 'text-slate-950'}`}>
                    {player.name}
                  </p>

                  <span className={`shrink-0 text-xs font-semibold tabular-nums ${isConfirmed || isLeader ? 'text-amber-700' : 'text-slate-500'}`}>
                    {votes} {votes === 1 ? 'vote' : 'votes'}
                  </span>

                  {!readOnly ? (
                    <button
                      className={`shrink-0 rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        isMyVote
                          ? 'bg-[#1565ff] text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => { void castVote(currentUserId, player.id) }}
                      type="button"
                    >
                      {isMyVote ? '✓ Voted' : 'Vote'}
                    </button>
                  ) : null}

                  {/* Coach confirm button */}
                  {onConfirmWinner && !isConfirmed && (
                    <button
                      type="button"
                      disabled={confirmState === 'saving'}
                      onClick={() => void handleConfirm(player.id)}
                      className="shrink-0 rounded-xl border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40 transition"
                    >
                      {confirmState === 'saving' && pickingId === player.id ? 'Saving…' : 'Confirm'}
                    </button>
                  )}
                </div>

                {/* Vote bar */}
                {totalVotes > 0 ? (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${isConfirmed || isLeader ? 'bg-amber-400' : 'bg-slate-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
