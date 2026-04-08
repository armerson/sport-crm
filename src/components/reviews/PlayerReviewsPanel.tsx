import { useEffect, useState } from 'react'
import {
  fetchPlayerReviews,
  retractReview,
  deleteReview,
  type PlayerReview,
} from '../../services/playerReviews.ts'
import { ReviewCard } from './ReviewCard.tsx'
import { ReviewEditor } from './ReviewEditor.tsx'

interface PlayerReviewsPanelProps {
  playerId: string
  playerName: string
  teamId: string
  coachId: string
}

export function PlayerReviewsPanel({ playerId, playerName, teamId, coachId }: PlayerReviewsPanelProps) {
  const [reviews, setReviews] = useState<PlayerReview[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchPlayerReviews(playerId)
      .then(setReviews)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [playerId])

  function handleSaved(review: PlayerReview) {
    setReviews((prev) => {
      const idx = prev.findIndex((r) => r.id === review.id)
      return idx >= 0 ? prev.map((r) => (r.id === review.id ? review : r)) : [review, ...prev]
    })
    setEditingId(null)
  }

  async function handleRetract(id: string) {
    try {
      await retractReview(id)
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: 'draft', publishedAt: null } : r))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retract')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReview(id)
      setReviews((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const editingReview = editingId && editingId !== 'new' ? reviews.find((r) => r.id === editingId) : null

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">Development reviews</p>
        {editingId === null && (
          <button
            type="button"
            onClick={() => setEditingId('new')}
            className="flex items-center gap-1.5 rounded-xl bg-[#123524] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a4a33] active:scale-[0.98]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Write review
          </button>
        )}
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      {editingId !== null && (
        <ReviewEditor
          playerId={playerId}
          playerName={playerName}
          teamId={teamId}
          coachId={coachId}
          existing={editingReview ?? null}
          onSaved={handleSaved}
          onCancel={() => setEditingId(null)}
        />
      )}

      {loading && <p className="text-xs text-slate-400">Loading reviews…</p>}

      {!loading && reviews.length === 0 && editingId === null && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-400">
          No reviews yet. Write the first one to get started.
        </p>
      )}

      {reviews.map((review) =>
        editingId === review.id ? null : (
          <ReviewCard
            key={review.id}
            review={review}
            mode="coach"
            onEdit={() => setEditingId(review.id)}
            onRetract={() => void handleRetract(review.id)}
            onDelete={() => void handleDelete(review.id)}
          />
        ),
      )}
    </div>
  )
}
