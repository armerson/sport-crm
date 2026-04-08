import { useState } from 'react'
import { StarRating } from './StarRating.tsx'
import {
  saveReview,
  publishReview,
  type PlayerReview,
  type ReviewFormInput,
} from '../../services/playerReviews.ts'

interface ReviewEditorProps {
  playerId: string
  playerName: string
  teamId: string
  coachId: string
  existing?: PlayerReview | null
  onSaved: (review: PlayerReview) => void
  onCancel: () => void
}

const PERIOD_PRESETS = [
  'Mid-Season 2025/26',
  'End of Season 2025/26',
  'Mid-Season 2026/27',
  'End of Season 2026/27',
]

const RATING_FIELDS: { key: keyof Pick<ReviewFormInput, 'ratingTechnical' | 'ratingTactical' | 'ratingPhysical' | 'ratingAttitude'>; label: string; hint: string }[] = [
  { key: 'ratingTechnical', label: 'Technical', hint: 'Ball control, passing, shooting, dribbling' },
  { key: 'ratingTactical',  label: 'Tactical',  hint: 'Positioning, decision-making, game awareness' },
  { key: 'ratingPhysical',  label: 'Physical',  hint: 'Pace, stamina, strength, agility' },
  { key: 'ratingAttitude',  label: 'Attitude',  hint: 'Effort, teamwork, coachability, punctuality' },
]

export function ReviewEditor({ playerId, playerName, teamId, coachId, existing, onSaved, onCancel }: ReviewEditorProps) {
  const [form, setForm] = useState<ReviewFormInput>({
    periodLabel:       existing?.periodLabel    ?? '',
    ratingTechnical:   existing?.ratingTechnical ?? null,
    ratingTactical:    existing?.ratingTactical  ?? null,
    ratingPhysical:    existing?.ratingPhysical  ?? null,
    ratingAttitude:    existing?.ratingAttitude  ?? null,
    strengths:         existing?.strengths        ?? '',
    areasToImprove:    existing?.areasToImprove   ?? '',
    coachNotes:        existing?.coachNotes       ?? '',
  })
  const [saving,     setSaving]     = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  function set<K extends keyof ReviewFormInput>(key: K, value: ReviewFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(andPublish = false) {
    if (!form.periodLabel.trim()) { setError('Period label is required.'); return }
    setError(null)
    setSaving(true)
    try {
      const saved = await saveReview(playerId, teamId, coachId, form, existing?.id)
      if (andPublish) {
        setPublishing(true)
        await publishReview(saved.id)
        onSaved({ ...saved, status: 'published' })
      } else {
        onSaved(saved)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
      setPublishing(false)
    }
  }

  const isAlreadyPublished = existing?.status === 'published'

  return (
    <div className="space-y-5 rounded-[1.75rem] border border-[#123524]/20 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {existing ? 'Edit review' : 'New review'}
          </h3>
          <p className="text-sm text-slate-500">{playerName}</p>
        </div>
        <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-600">Cancel</button>
      </div>

      {/* Period */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Review period
        </label>
        <input
          type="text"
          list="period-presets"
          value={form.periodLabel}
          onChange={(e) => set('periodLabel', e.target.value)}
          placeholder="e.g. End of Season 2025/26"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#123524] focus:ring-2 focus:ring-[#123524]/15"
        />
        <datalist id="period-presets">
          {PERIOD_PRESETS.map((p) => <option key={p} value={p} />)}
        </datalist>
      </div>

      {/* Ratings */}
      <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skill ratings</p>
        {RATING_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400">{hint}</p>
            </div>
            <StarRating
              value={form[key] as number | null}
              onChange={(v) => set(key, v === form[key] ? null : v)}
            />
          </div>
        ))}
      </div>

      {/* Strengths */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          Strengths <span className="font-normal text-slate-400">(visible to parents)</span>
        </label>
        <textarea
          rows={3}
          value={form.strengths}
          onChange={(e) => set('strengths', e.target.value)}
          maxLength={1000}
          placeholder="What has this player done really well this season?"
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#123524] focus:ring-2 focus:ring-[#123524]/15"
        />
      </div>

      {/* Areas to improve */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          Areas to improve <span className="font-normal text-slate-400">(visible to parents)</span>
        </label>
        <textarea
          rows={3}
          value={form.areasToImprove}
          onChange={(e) => set('areasToImprove', e.target.value)}
          maxLength={1000}
          placeholder="What should this player focus on next?"
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#123524] focus:ring-2 focus:ring-[#123524]/15"
        />
      </div>

      {/* Private coach notes */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          Private notes <span className="font-normal text-slate-400">(coach &amp; admin only)</span>
        </label>
        <textarea
          rows={2}
          value={form.coachNotes}
          onChange={(e) => set('coachNotes', e.target.value)}
          maxLength={2000}
          placeholder="Internal notes — never shown to parents or players"
          className="w-full resize-none rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => void handleSave(false)}
          disabled={saving}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition disabled:opacity-40 hover:bg-slate-50 active:scale-[0.98]"
        >
          {saving && !publishing ? 'Saving…' : 'Save draft'}
        </button>
        {!isAlreadyPublished && (
          <button
            type="button"
            onClick={() => void handleSave(true)}
            disabled={saving}
            className="rounded-xl bg-[#123524] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40 hover:bg-[#1a4a33] active:scale-[0.98]"
          >
            {publishing ? 'Publishing…' : 'Save & publish to parents'}
          </button>
        )}
        {isAlreadyPublished && (
          <span className="flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Published — parents can see this
          </span>
        )}
      </div>
    </div>
  )
}
