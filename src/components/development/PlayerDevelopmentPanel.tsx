import { useEffect, useMemo, useState } from 'react'
import {
  archiveDevelopmentGoal,
  createDevelopmentGoal,
  fetchDevelopmentCategories,
  fetchDevelopmentGoals,
  fetchGoalUpdates,
  updateDevelopmentGoal,
  type DevelopmentCategory,
  type DevelopmentGoal,
  type FeedbackAudience,
  type GoalPriority,
  type GoalStatus,
  type GoalUpdate,
} from '../../services/playerDevelopment.ts'
import { PlayerReviewsPanel } from '../reviews/PlayerReviewsPanel.tsx'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'

interface PlayerDevelopmentPanelProps {
  playerId: string
  playerName: string
  teamId: string
  currentUserId: string
  role: 'admin' | 'coach'
}

const STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  achieved: 'Achieved',
  paused: 'Paused',
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]
const VISIBILITY_OPTIONS = [
  { value: 'internal', label: 'Coaches only' },
  { value: 'player', label: 'Player visible' },
  { value: 'parent', label: 'Player and parent visible' },
]

function GoalCard({
  goal,
  updates,
  currentUserId,
  onChanged,
  onArchived,
}: {
  goal: DevelopmentGoal
  updates: GoalUpdate[]
  currentUserId: string
  onChanged: (goal: DevelopmentGoal) => void
  onArchived: (goalId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<GoalStatus>(goal.status)
  const [progress, setProgress] = useState(goal.progress)
  const [comment, setComment] = useState('')
  const [audience, setAudience] = useState<FeedbackAudience>('internal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveProgress() {
    setSaving(true)
    setError(null)
    try {
      const changed = await updateDevelopmentGoal(goal, currentUserId, { status, progress, comment, audience })
      onChanged(changed)
      setComment('')
      setExpanded(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update this goal.')
    } finally {
      setSaving(false)
    }
  }

  async function archiveGoal() {
    setSaving(true)
    setError(null)
    try {
      await archiveDevelopmentGoal(goal.id)
      onArchived(goal.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to archive this goal.')
      setSaving(false)
    }
  }

  return (
    <article className="rounded-xl border border-[var(--ui-border)] bg-white p-4 shadow-[0_1px_2px_#10182808] transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-slate-900">{goal.title}</h4>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${goal.status === 'achieved' ? 'bg-emerald-50 text-emerald-700' : goal.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : goal.status === 'paused' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
              {STATUS_LABELS[goal.status]}
            </span>
            {goal.priority === 'high' ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">High priority</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {[goal.categoryName, goal.targetDate ? `Target ${new Date(`${goal.targetDate}T00:00:00`).toLocaleDateString('en-GB')}` : null]
              .filter(Boolean).join(' · ') || 'Individual goal'}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-[var(--ui-accent)]">{goal.progress}%</span>
      </div>
      {goal.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{goal.description}</p> : null}
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${goal.progress}% complete`}>
        <div className="h-full rounded-full bg-[var(--ui-accent)] transition-all" style={{ width: `${goal.progress}%` }} />
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Status" value={status} options={STATUS_OPTIONS} onChange={(event) => setStatus(event.target.value as GoalStatus)} />
            <label className="block text-sm font-semibold text-slate-700">
              Progress: {status === 'achieved' ? 100 : progress}%
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={status === 'achieved'}
                value={status === 'achieved' ? 100 : progress}
                onChange={(event) => setProgress(Number(event.target.value))}
                className="mt-3 w-full accent-[var(--ui-accent)]"
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Progress note
            <textarea
              rows={3}
              maxLength={2000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What changed and what should happen next?"
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-normal outline-none focus:border-[var(--ui-accent)] focus:ring-2 focus:ring-[var(--ui-accent)]/15"
            />
          </label>
          <SelectField label="Who can see this note?" value={audience} options={VISIBILITY_OPTIONS} onChange={(event) => setAudience(event.target.value as FeedbackAudience)} />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" loading={saving} onClick={() => void saveProgress()}>Save update</Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setExpanded(false)}>Cancel</Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => void archiveGoal()}>Archive goal</Button>
          </div>
          {updates.length > 0 ? (
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recent history</p>
              {updates.slice(0, 4).map((update) => (
                <div key={update.id} className="border-l-2 border-slate-200 pl-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">
                    {update.status ? STATUS_LABELS[update.status] : 'Progress update'}
                    {update.progress != null ? ` · ${update.progress}%` : ''}
                  </p>
                  {update.comment ? <p className="mt-0.5">{update.comment}</p> : null}
                  <p className="mt-0.5 text-slate-400">{new Date(update.createdAt).toLocaleDateString('en-GB')}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <button type="button" onClick={() => setExpanded(true)} className="mt-4 min-h-11 text-sm font-semibold text-[var(--ui-accent)]">
          Update progress
        </button>
      )}
    </article>
  )
}

function NewGoalForm({
  categories,
  playerId,
  teamId,
  currentUserId,
  assignedCoachId,
  onCreated,
  onCancel,
}: {
  categories: DevelopmentCategory[]
  playerId: string
  teamId: string
  currentUserId: string
  assignedCoachId: string | null
  onCreated: (goal: DevelopmentGoal) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [targetDate, setTargetDate] = useState('')
  const [priority, setPriority] = useState<GoalPriority>('medium')
  const [visibility, setVisibility] = useState<FeedbackAudience>('internal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const goal = await createDevelopmentGoal(playerId, currentUserId, {
        title, description, categoryId, targetDate, priority, visibility,
        assignedCoachId,
        originatingTeamId: teamId || null,
      })
      onCreated(goal)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create this goal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border border-[var(--ui-accent)]/20 bg-white p-4">
      <div>
        <h4 className="font-semibold text-slate-900">New development goal</h4>
        <p className="mt-1 text-xs text-slate-500">Start simple. You can add progress notes over time.</p>
      </div>
      <TextField label="Goal title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Improve first touch under pressure" required />
      <label className="block text-sm font-semibold text-slate-700">
        Description
        <textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-base font-normal outline-none focus:border-[var(--ui-accent)] focus:ring-2 focus:ring-[var(--ui-accent)]/15" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Category" value={categoryId} options={categories.map((category) => ({ value: category.id, label: category.name }))} onChange={(event) => setCategoryId(event.target.value)} />
        <TextField label="Target date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <SelectField label="Priority" value={priority} options={PRIORITY_OPTIONS} onChange={(event) => setPriority(event.target.value as GoalPriority)} />
        <SelectField label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={(event) => setVisibility(event.target.value as FeedbackAudience)} />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" loading={saving} disabled={!title.trim()}>Create goal</Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

export function PlayerDevelopmentPanel({ playerId, playerName, teamId, currentUserId, role }: PlayerDevelopmentPanelProps) {
  const [goals, setGoals] = useState<DevelopmentGoal[]>([])
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [categories, setCategories] = useState<DevelopmentCategory[]>([])
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchDevelopmentGoals(playerId), fetchDevelopmentCategories()])
      .then(async ([nextGoals, nextCategories]) => {
        const nextUpdates = await fetchGoalUpdates(nextGoals.map((goal) => goal.id))
        if (!cancelled) {
          setGoals(nextGoals)
          setCategories(nextCategories)
          setUpdates(nextUpdates)
        }
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load development.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [playerId])

  const updatesByGoal = useMemo(() => {
    const grouped = new Map<string, GoalUpdate[]>()
    for (const update of updates) grouped.set(update.goalId, [...(grouped.get(update.goalId) ?? []), update])
    return grouped
  }, [updates])

  const averageProgress = goals.length
    ? Math.round(goals.reduce((total, goal) => total + goal.progress, 0) / goals.length)
    : 0
  const achievedGoals = goals.filter((goal) => goal.status === 'achieved').length
  const goalsInProgress = goals.filter((goal) => goal.status === 'in_progress').length

  return (
    <section className="space-y-5">
      <div className="ui-module">
        <div className="ui-module-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-accent)]">Player development</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">{playerName}</h3>
            <p className="mt-1 text-sm text-slate-500">Individual goals, progress updates and coach assessments.</p>
          </div>
          <span className="rounded-full border border-[var(--ui-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ui-muted)]">Coach view</span>
        </div>
        </div>
        <div className="ui-module-body grid grid-cols-3 gap-2 sm:gap-3">
          <div className="ui-metric"><p className="ui-metric-label">Goal progress</p><p className="ui-metric-value">{averageProgress}%</p></div>
          <div className="ui-metric"><p className="ui-metric-label">In progress</p><p className="ui-metric-value">{goalsInProgress}</p></div>
          <div className="ui-metric"><p className="ui-metric-label">Achieved</p><p className="ui-metric-value">{achievedGoals}</p></div>
        </div>
      </div>

      <section className="ui-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Development goals</h3>
            <p className="text-sm text-slate-500">{goals.length} active {goals.length === 1 ? 'goal' : 'goals'}</p>
          </div>
          {!showNewGoal ? <Button type="button" onClick={() => setShowNewGoal(true)}>Add goal</Button> : null}
        </div>
        {showNewGoal ? (
          <div className="mt-4">
            <NewGoalForm
              categories={categories}
              playerId={playerId}
              teamId={teamId}
              currentUserId={currentUserId}
              assignedCoachId={role === 'coach' ? currentUserId : null}
              onCreated={(goal) => { setGoals((current) => [goal, ...current]); setShowNewGoal(false) }}
              onCancel={() => setShowNewGoal(false)}
            />
          </div>
        ) : null}
        {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {loading ? (
          <p className="mt-5 text-sm text-slate-400">Loading goals…</p>
        ) : goals.length === 0 && !showNewGoal ? (
          <div className="ui-empty mt-5"><p className="font-semibold text-slate-700">No development goals yet</p><p className="mt-1">Add a focused goal when the next priority is agreed.</p></div>
        ) : (
          <div className="mt-4 space-y-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                updates={updatesByGoal.get(goal.id) ?? []}
                currentUserId={currentUserId}
                onChanged={(changed) => setGoals((current) => current.map((item) => item.id === changed.id ? changed : item))}
                onArchived={(goalId) => setGoals((current) => current.filter((item) => item.id !== goalId))}
              />
            ))}
          </div>
        )}
      </section>

      <section className="ui-panel p-5">
        <PlayerReviewsPanel playerId={playerId} playerName={playerName} teamId={teamId} coachId={currentUserId} />
      </section>
      {role === 'admin' ? <p className="px-1 text-xs text-slate-400">Admin access uses the same player record and history as the coach workspace.</p> : null}
    </section>
  )
}
