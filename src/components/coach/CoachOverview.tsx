import { useState } from 'react'
import type { EventRecord, TeamRecord } from '../../types/club.ts'
import { Button } from '../ui/Button.tsx'
import { formatDateTimeRelative } from '../../utils/date.ts'

interface CoachOverviewProps {
  name: string
  events: EventRecord[]
  teams: TeamRecord[]
  loading: boolean
  attendanceCounts: Map<string, { yes: number; pending: number; no: number }>
  onSelectEvent: (event: EventRecord) => void
  onCreate: () => void
  onSquad: () => void
  onMessages: () => void
}

export function CoachOverview({ name, events, teams, loading, attendanceCounts, onSelectEvent, onCreate, onSquad, onMessages }: CoachOverviewProps) {
  const [copyStatus, setCopyStatus] = useState('')
  const now = new Date()
  const upcoming = events.filter((event) => event.eventStatus !== 'cancelled' && new Date(event.dateTime) >= now)
    .sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime))
  const next = upcoming[0]
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
  const thisWeek = upcoming.filter((event) => new Date(event.dateTime) < weekEnd).length
  const weekEvents = upcoming.filter((event) => new Date(event.dateTime) < weekEnd)
  const repliesDue = weekEvents.reduce((sum, event) => sum + (attendanceCounts.get(event.id)?.pending ?? 0), 0)
  const players = new Set(teams.flatMap((team) => team.players)).size
  const nextCounts = next ? attendanceCounts.get(next.id) : undefined
  const registrationUrl = `${window.location.origin}/register`

  async function copyRegistration() {
    try {
      await navigator.clipboard.writeText(registrationUrl)
      setCopyStatus('Registration link copied. Ready to share with families.')
    } catch {
      setCopyStatus(`Copy this registration link: ${registrationUrl}`)
    }
  }

  return (
    <div className="space-y-5">
      <div className="hidden flex-wrap items-end justify-between gap-4 sm:flex">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Your coaching workspace</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Your club day, {name.split(' ')[0]}.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your squad, the plan and everyone’s availability. All in one place.</p>
        </div>
        <Button onClick={onCreate} disabled={loading || teams.length === 0}>+ Create event</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <article className="ui-feature relative overflow-hidden p-6 text-white sm:p-7">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-72 w-52 rotate-12 rounded-[50%] border-[35px] border-white/[0.035]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />Up next</div>
            {loading ? <p className="py-8 text-sm text-white/70" role="status">Loading your schedule…</p> : next ? <>
              <p className="mt-5 text-xs font-medium text-white/60">{teams.find((team) => team.id === next.teamId)?.name} · {next.type === 'match' ? 'Match' : 'Training'}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{next.title}</h2>
              <p className="mt-3 text-sm text-white/80">{formatDateTimeRelative(next.dateTime)}</p>
              <p className="mt-1 text-sm text-white/60">{next.location || 'Location to be confirmed'}</p>
              {nextCounts ? <div className="mt-5 flex flex-wrap gap-2" aria-label="Next event availability">
                <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100">{nextCounts.yes} going</span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${nextCounts.pending > 0 ? 'bg-amber-300/20 text-amber-100' : 'bg-white/10 text-white/65'}`}>{nextCounts.pending} awaiting</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/65">{nextCounts.no} unavailable</span>
              </div> : null}
              <button type="button" onClick={() => onSelectEvent(next)} className="mt-5 inline-flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-blue-50">{nextCounts?.pending ? `Review ${nextCounts.pending} response${nextCounts.pending === 1 ? '' : 's'}` : 'Open event'} <span aria-hidden="true">→</span></button>
            </> : <>
              <h2 className="mt-5 text-2xl font-semibold">{teams.length ? 'Your next session starts here.' : 'Welcome to the coaching team.'}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/70">{teams.length ? 'Add a training session or fixture so your squad can let you know who’s coming.' : 'Ask your club administrator to assign you to a team. Your squad and schedule will appear here.'}</p>
            </>}
          </div>
        </article>
        <div className="ui-panel flex flex-col p-6">
          <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-5">
            {[['Players', players], ['Next 7 days', thisWeek], ['Replies due', repliesDue]].map(([label, value]) => <div key={label}><p className={`text-2xl font-bold tabular-nums tracking-tight ${label === 'Replies due' && Number(value) > 0 ? 'text-amber-700' : 'text-slate-950'}`}>{loading ? '—' : value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}
          </div>
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Quick actions</p>
          {[{ label: 'Open squad', action: onSquad }, { label: 'Team messages', action: onMessages }, { label: 'Copy registration link', action: () => void copyRegistration() }].map(({ label, action }) => <button key={label} type="button" onClick={action} className="flex w-full items-center justify-between rounded-lg py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700">{label}<span aria-hidden="true" className="text-slate-400">↗</span></button>)}
          <p role="status" className="break-all text-xs leading-5 text-slate-500">{copyStatus}</p>
        </div>
      </div>
    </div>
  )
}
