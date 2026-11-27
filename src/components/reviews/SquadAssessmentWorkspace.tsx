import { useEffect, useMemo, useState } from 'react'
import { fetchReviewsForPlayers, type PlayerReview } from '../../services/playerReviews.ts'
import type { PlayerRecord } from '../../types/club.ts'
import { ReviewEditor } from './ReviewEditor.tsx'

interface SquadAssessmentWorkspaceProps {
  players: PlayerRecord[]
  teamId: string
  coachId: string
  onClose: () => void
}

export function SquadAssessmentWorkspace({ players, teamId, coachId, onClose }: SquadAssessmentWorkspaceProps) {
  const [reviews, setReviews] = useState<PlayerReview[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let current = true
    void fetchReviewsForPlayers(players.map((player) => player.id))
      .then((next) => { if (current) { setReviews(next); setError(null) } })
      .catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : 'Unable to load squad assessments.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [players])

  const latestByPlayer = useMemo(() => {
    const result = new Map<string, PlayerReview>()
    for (const review of reviews) if (!result.has(review.playerId)) result.set(review.playerId, review)
    return result
  }, [reviews])
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null
  const selectedReview = selectedPlayer ? latestByPlayer.get(selectedPlayer.id) ?? null : null
  const published = players.filter((player) => latestByPlayer.get(player.id)?.status === 'published').length
  const drafts = players.filter((player) => latestByPlayer.get(player.id)?.status === 'draft').length
  const notStarted = players.length - published - drafts

  function handleSaved(review: PlayerReview) {
    setReviews((current) => {
      const exists = current.some((item) => item.id === review.id)
      return exists ? current.map((item) => item.id === review.id ? review : item) : [review, ...current]
    })
    const currentIndex = players.findIndex((player) => player.id === review.playerId)
    setSelectedPlayerId(players[currentIndex + 1]?.id ?? null)
  }

  return (
    <section className="ui-panel overflow-hidden">
      <div className="border-b border-[var(--ui-border)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-accent)]">Squad assessments</p><h3 className="mt-1 text-xl font-semibold text-slate-950">Review the squad</h3><p className="mt-1 text-sm text-slate-500">Save a draft or publish feedback, then move straight to the next player.</p></div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600">Close</button>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 py-3 text-center">
          <div><p className="text-xl font-bold text-emerald-700">{published}</p><p className="text-xs text-slate-500">Published</p></div>
          <div><p className="text-xl font-bold text-amber-700">{drafts}</p><p className="text-xs text-slate-500">Drafts</p></div>
          <div><p className="text-xl font-bold text-slate-700">{notStarted}</p><p className="text-xs text-slate-500">Not started</p></div>
        </div>
      </div>

      {error ? <p className="m-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="p-5 text-sm text-slate-500" role="status">Loading assessment status…</p> : (
        <div className="grid lg:grid-cols-[19rem_1fr]">
          <div className="max-h-[34rem] space-y-2 overflow-y-auto border-b border-slate-200 p-3 lg:border-b-0 lg:border-r">
            {players.map((player) => {
              const review = latestByPlayer.get(player.id)
              const label = review?.status === 'published' ? 'Published' : review?.status === 'draft' ? 'Draft saved' : 'Not started'
              const tone = review?.status === 'published' ? 'bg-emerald-50 text-emerald-700' : review?.status === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
              return <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${selectedPlayerId === player.id ? 'border-[var(--ui-accent)] bg-blue-50/50' : 'border-transparent hover:bg-slate-50'}`}>
                {player.photoUrl ? <img src={player.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-[var(--ui-accent)]">{player.name.charAt(0)}</span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{player.name}</span><span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span></span>
              </button>
            })}
          </div>
          <div className="min-w-0 p-4 sm:p-5">
            {selectedPlayer ? <ReviewEditor key={`${selectedPlayer.id}:${selectedReview?.id ?? 'new'}`} playerId={selectedPlayer.id} playerName={selectedPlayer.name} teamId={teamId} coachId={coachId} existing={selectedReview} onSaved={handleSaved} onCancel={() => setSelectedPlayerId(null)} /> : <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-slate-300 p-6 text-center"><div><p className="font-semibold text-slate-700">Choose a player to begin</p><p className="mt-1 text-sm text-slate-500">Their latest draft or assessment will open here.</p></div></div>}
          </div>
        </div>
      )}
    </section>
  )
}
