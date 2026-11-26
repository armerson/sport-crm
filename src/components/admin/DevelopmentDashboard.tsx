import { useEffect, useMemo, useState } from 'react'
import { fetchDevelopmentDashboard, type DevelopmentDashboardData } from '../../services/developmentDashboard.ts'
import type { PlayerRecord } from '../../types/club.ts'

interface DevelopmentDashboardProps {
  players: PlayerRecord[]
  onOpenPlayer: (playerId: string) => void
}

function formatDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function DevelopmentDashboard({ players, onOpenPlayer }: DevelopmentDashboardProps) {
  const [data, setData] = useState<DevelopmentDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void fetchDevelopmentDashboard()
      .then((next) => { if (current) { setData(next); setError(null) } })
      .catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : 'Unable to load development activity.') })
    return () => { current = false }
  }, [])

  const eligiblePlayers = useMemo(() => players.filter((player) => player.status === 'active'), [players])
  const playerById = useMemo(() => new Map(eligiblePlayers.map((player) => [player.id, player])), [eligiblePlayers])
  const today = new Date().toISOString().slice(0, 10)
  const activeGoals = data?.goals.filter((goal) => goal.status !== 'achieved' && goal.status !== 'paused') ?? []
  const overdueGoals = activeGoals.filter((goal) => goal.targetDate && goal.targetDate < today)
  const achievedRecently = data?.goals.filter((goal) => goal.status === 'achieved' && Date.parse(today) - Date.parse(goal.updatedAt) <= 30 * 86_400_000) ?? []
  const latestReviewByPlayer = new Map<string, string>()
  for (const review of data?.reviews ?? []) {
    if (!latestReviewByPlayer.has(review.playerId)) latestReviewByPlayer.set(review.playerId, review.assessmentDate)
  }
  const reviewCutoff = new Date(); reviewCutoff.setMonth(reviewCutoff.getMonth() - 4)
  const playersNeedingReview = eligiblePlayers.filter((player) => {
    const latest = latestReviewByPlayer.get(player.id)
    return !latest || new Date(`${latest}T00:00:00`) < reviewCutoff
  })
  const pathwayDue = data?.recommendations.filter((item) => item.status === 'ready' || (item.reviewDate && item.reviewDate <= today)) ?? []

  const playerName = (id: string) => playerById.get(id)?.name ?? 'Player'

  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
  if (!data) return <div className="ui-panel p-6 text-sm text-slate-500" role="status">Loading development activity…</div>

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-accent)]">Player development</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Development control centre</h2>
        <p className="mt-1 text-sm text-slate-500">Individual progress and the next coaching actions—without ranking players.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Active goals', activeGoals.length, 'text-blue-700'],
          ['Goals overdue', overdueGoals.length, overdueGoals.length ? 'text-amber-700' : 'text-slate-950'],
          ['Reviews due', playersNeedingReview.length, playersNeedingReview.length ? 'text-amber-700' : 'text-slate-950'],
          ['Pathway actions', pathwayDue.length, pathwayDue.length ? 'text-violet-700' : 'text-slate-950'],
        ].map(([label, value, tone]) => (
          <article key={String(label)} className="ui-panel p-4 sm:p-5">
            <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="ui-panel p-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-950">Needs attention</h3><p className="mt-0.5 text-xs text-slate-500">Overdue goals and player reviews</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{overdueGoals.length + playersNeedingReview.length}</span></div>
          <div className="mt-4 space-y-2">
            {overdueGoals.slice(0, 5).map((goal) => (
              <button key={goal.id} type="button" onClick={() => onOpenPlayer(goal.playerId)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-amber-50/70 px-3 py-2.5 text-left hover:bg-amber-50">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{playerName(goal.playerId)}</span><span className="block truncate text-xs text-slate-500">{goal.title} · due {formatDay(goal.targetDate!)}</span></span><span className="text-sm text-amber-700">Open →</span>
              </button>
            ))}
            {playersNeedingReview.slice(0, Math.max(0, 5 - overdueGoals.length)).map((player) => (
              <button key={`review-${player.id}`} type="button" onClick={() => onOpenPlayer(player.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100">
                <span><span className="block text-sm font-semibold text-slate-900">{player.name}</span><span className="block text-xs text-slate-500">{latestReviewByPlayer.has(player.id) ? 'Review is more than four months old' : 'No assessment recorded yet'}</span></span><span className="text-sm text-[var(--ui-accent)]">Review →</span>
              </button>
            ))}
            {overdueGoals.length === 0 && playersNeedingReview.length === 0 ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">Nothing currently needs attention.</p> : null}
          </div>
        </article>

        <article className="ui-panel p-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-950">Upcoming testing</h3><p className="mt-0.5 text-xs text-slate-500">Open and planned testing events</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{data.testingEvents.length}</span></div>
          <div className="mt-4 space-y-2">
            {data.testingEvents.slice(0, 5).map((event) => <div key={event.id} className="rounded-xl bg-slate-50 px-3 py-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-slate-900">{event.name}</p><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{event.status === 'open' ? 'Open' : 'Draft'}</span></div><p className="mt-1 text-xs text-slate-500">{formatDay(event.eventDate)}{event.location ? ` · ${event.location}` : ''}</p></div>)}
            {data.testingEvents.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No testing events are currently planned.</p> : null}
          </div>
        </article>

        <article className="ui-panel p-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-950">Pathway actions</h3><p className="mt-0.5 text-xs text-slate-500">Recommendations ready or due for review</p></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{pathwayDue.length}</span></div>
          <div className="mt-4 space-y-2">{pathwayDue.slice(0, 5).map((item) => <button key={item.id} type="button" onClick={() => onOpenPlayer(item.playerId)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-violet-50/60 px-3 py-2.5 text-left hover:bg-violet-50"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{playerName(item.playerId)}</span><span className="block truncate text-xs text-slate-500">{item.recommendation}</span></span><span className="text-sm text-violet-700">Open →</span></button>)}{pathwayDue.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No pathway reviews currently need action.</p> : null}</div>
        </article>

        <article className="ui-panel p-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-950">Recent progress</h3><p className="mt-0.5 text-xs text-slate-500">Goals achieved in the last 30 days</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{achievedRecently.length}</span></div>
          <div className="mt-4 space-y-2">{achievedRecently.slice(0, 5).map((goal) => <button key={goal.id} type="button" onClick={() => onOpenPlayer(goal.playerId)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-emerald-50/70 px-3 py-2.5 text-left hover:bg-emerald-50"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{playerName(goal.playerId)}</span><span className="block truncate text-xs text-slate-500">{goal.title}</span></span><span className="text-sm font-semibold text-emerald-700">Achieved</span></button>)}{achievedRecently.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Achieved goals will appear here.</p> : null}</div>
        </article>
      </div>
    </section>
  )
}
