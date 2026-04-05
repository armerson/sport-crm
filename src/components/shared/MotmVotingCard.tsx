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
}

export function MotmVotingCard({
  eventId,
  isPastMatch,
  players: playersProp,
  teamId = '',
  currentUserId,
  readOnly = false,
}: MotmVotingCardProps) {
  // Auto-load when teamId provided and no direct players prop
  const { players: loadedPlayers } = useTeamPlayers(playersProp ? '' : teamId)
  const players = playersProp ?? loadedPlayers

  const { tally, myVote, castVote, totalVotes } = useMotmVoting(eventId, isPastMatch, players)

  if (!isPastMatch) return null

  const myCurrentVote = myVote(currentUserId)
  const winner = tally[0]

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h3 className="font-semibold text-slate-900">Man of the Match</h3>
        </div>
        <p className="text-xs text-slate-400">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</p>
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-slate-400">No players in squad.</p>
      ) : (
        <div className="space-y-2">
          {players.map((player) => {
            const tallyEntry = tally.find((t) => t.playerId === player.id)
            const votes = tallyEntry?.votes ?? 0
            const isLeader = winner && winner.playerId === player.id && winner.votes > 0
            const isMyVote = myCurrentVote === player.id
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0

            return (
              <div
                key={player.id}
                className={`rounded-2xl border px-3 py-2.5 transition ${
                  isLeader
                    ? 'border-amber-200 bg-amber-50'
                    : isMyVote && !readOnly
                      ? 'border-[#123524]/20 bg-[#123524]/5'
                      : 'border-transparent bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isLeader ? (
                    <span className="shrink-0 text-base leading-none">🏆</span>
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}

                  <p className={`flex-1 truncate text-sm font-medium ${isLeader ? 'text-amber-900' : 'text-slate-950'}`}>
                    {player.name}
                  </p>

                  <span className={`shrink-0 text-xs font-semibold tabular-nums ${isLeader ? 'text-amber-700' : 'text-slate-500'}`}>
                    {votes} {votes === 1 ? 'vote' : 'votes'}
                  </span>

                  {!readOnly ? (
                    <button
                      className={`shrink-0 rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        isMyVote
                          ? 'bg-[#123524] text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => { void castVote(currentUserId, player.id) }}
                      type="button"
                    >
                      {isMyVote ? '✓ Voted' : 'Vote'}
                    </button>
                  ) : null}
                </div>

                {/* Vote bar */}
                {totalVotes > 0 ? (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${isLeader ? 'bg-amber-400' : 'bg-slate-400'}`}
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
