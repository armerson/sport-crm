import { StarRating } from './StarRating.tsx'
import { type PlayerReview } from '../../services/playerReviews.ts'

interface ReviewCardProps {
  review: PlayerReview
  playerName?: string
  /** Coach mode shows private notes, draft badge, edit/retract buttons */
  mode: 'coach' | 'parent'
  onEdit?: () => void
  onRetract?: () => void
  onDelete?: () => void
}

const RATING_LABELS: { key: keyof Pick<PlayerReview, 'ratingTechnical' | 'ratingTactical' | 'ratingPhysical' | 'ratingAttitude'>; label: string }[] = [
  { key: 'ratingTechnical', label: 'Technical' },
  { key: 'ratingTactical',  label: 'Tactical'  },
  { key: 'ratingPhysical',  label: 'Physical'  },
  { key: 'ratingAttitude',  label: 'Attitude'  },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function OverallScore({ review }: { review: PlayerReview }) {
  const ratings = [review.ratingTechnical, review.ratingTactical, review.ratingPhysical, review.ratingAttitude].filter((r): r is number => r !== null)
  if (!ratings.length) return null
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const pct = Math.round((avg / 5) * 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-3">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle
          cx="22" cy="22" r="18"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${2 * Math.PI * 18}`}
          strokeDashoffset={`${2 * Math.PI * 18 * (1 - pct / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
        <text x="22" y="27" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overall</p>
        <p className="text-sm font-bold" style={{ color }}>{pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Developing' : 'Needs work'}</p>
      </div>
    </div>
  )
}

export function ReviewCard({ review, playerName, mode, onEdit, onRetract, onDelete }: ReviewCardProps) {
  const isDraft = review.status === 'draft'

  return (
    <div className={`overflow-hidden rounded-[1.5rem] border shadow-sm ${isDraft && mode === 'coach' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          {playerName && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{playerName}</p>}
          <h3 className="text-base font-bold text-slate-900">{review.periodLabel}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {isDraft
              ? `Draft · saved ${formatDate(review.updatedAt)}`
              : `Published ${review.publishedAt ? formatDate(review.publishedAt) : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && mode === 'coach' && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Draft</span>
          )}
          {!isDraft && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Published</span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Overall + ratings */}
        <div className="flex flex-wrap items-center gap-4">
          <OverallScore review={review} />
          <div className="flex-1 space-y-2 min-w-0">
            {RATING_LABELS.map(({ key, label }) => (
              review[key] !== null ? (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="w-20 shrink-0 text-xs font-medium text-slate-500">{label}</span>
                  <StarRating value={review[key] as number | null} readonly size="sm" />
                </div>
              ) : null
            ))}
          </div>
        </div>

        {/* Strengths */}
        {review.strengths && (
          <div className="rounded-xl bg-green-50 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700">Strengths</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{review.strengths}</p>
          </div>
        )}

        {/* Areas to improve */}
        {review.areasToImprove && (
          <div className="rounded-xl bg-blue-50 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Areas to improve</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{review.areasToImprove}</p>
          </div>
        )}

        {/* Private coach notes — only shown to coach */}
        {mode === 'coach' && review.coachNotes && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Private notes
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{review.coachNotes}</p>
          </div>
        )}

        {/* Coach actions */}
        {mode === 'coach' && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Edit
              </button>
            )}
            {onRetract && !isDraft && (
              <button
                type="button"
                onClick={onRetract}
                className="rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
              >
                Retract from parents
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-xl border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
