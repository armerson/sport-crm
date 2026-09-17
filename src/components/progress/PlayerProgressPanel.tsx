import { useCallback, useEffect, useState } from 'react'
import {
  buildReportSnapshot,
  createPlayerAchievement,
  createPlayerReport,
  DEFAULT_CARD_PERMISSIONS,
  fetchCardPermissions,
  fetchPlayerAchievements,
  fetchPlayerReports,
  publishPlayerReport,
  saveCardPermissions,
  type AchievementType,
  type CardPermissions,
  type PlayerAchievement,
  type PlayerReport,
  type RecordVisibility,
  type ReportSnapshot,
} from '../../services/playerProgress.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'

interface Props { playerId: string; currentUserId: string; role: 'admin' | 'coach' }

const ACHIEVEMENT_TYPES = ['development', 'testing', 'pathway', 'attendance', 'team', 'other'] as const
const VISIBILITY_OPTIONS = [
  { value: 'internal', label: 'Coaches only' },
  { value: 'player', label: 'Player visible' },
  { value: 'parent', label: 'Player and parent visible' },
]
const CARD_FIELDS: Array<{ key: keyof Omit<CardPermissions, 'approvedAt'>; label: string }> = [
  { key: 'showPhoto', label: 'Photo' }, { key: 'showAgeGroup', label: 'Age / year group' },
  { key: 'showTeam', label: 'Team' }, { key: 'showPosition', label: 'Position' },
  { key: 'showPathwayStage', label: 'Pathway stage' }, { key: 'showAttendance', label: 'Attendance' },
  { key: 'showDevelopmentProgress', label: 'Development progress' },
  { key: 'showPerformanceMetrics', label: 'Performance metrics' }, { key: 'showAchievements', label: 'Achievements' },
]

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(`${dob}T00:00:00`)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1
  return age
}

function PlayerCard({ snapshot, permissions, shareable }: { snapshot: ReportSnapshot; permissions: CardPermissions; shareable: boolean }) {
  const show = (key: keyof Omit<CardPermissions, 'approvedAt'>) => !shareable || permissions[key]
  const completed = snapshot.goals.filter((goal) => goal.status === 'achieved').length
  const progress = snapshot.goals.length > 0
    ? Math.round(snapshot.goals.reduce((sum, goal) => sum + goal.progress, 0) / snapshot.goals.length)
    : null
  const age = ageFromDob(snapshot.player.dob)

  return (
    <article className={`overflow-hidden rounded-[1.25rem] border shadow-lg ${shareable ? 'border-slate-200 bg-white text-slate-900' : 'border-slate-800 bg-slate-950 text-white'}`}>
      <div className={`p-5 sm:p-6 ${shareable ? 'bg-gradient-to-br from-white to-slate-100' : 'bg-gradient-to-br from-[var(--ui-accent)] to-slate-950'}`}>
        <div className="flex items-center gap-4">
          {show('showPhoto') && snapshot.player.photoUrl ? (
            <img src={snapshot.player.photoUrl} alt="" className={`h-20 w-20 rounded-2xl object-cover ring-2 sm:h-24 sm:w-24 ${shareable ? 'ring-white shadow-md' : 'ring-white/50'}`} />
          ) : (
            <div className={`flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold ${shareable ? 'bg-white text-[var(--ui-accent)] shadow-sm' : 'bg-white/15 text-white'}`}>{snapshot.player.name.charAt(0)}</div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-xs font-bold uppercase tracking-[0.16em] ${shareable ? 'text-slate-500' : 'text-white/65'}`}>{shareable ? 'Approved preview' : 'Internal profile'}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${shareable ? 'bg-emerald-50 text-emerald-700' : 'bg-white/15 text-white/80'}`}>{shareable ? 'Private by default' : 'Club only'}</span>
            </div>
            <h3 className="mt-1 truncate text-2xl font-bold tracking-tight">{snapshot.player.name}</h3>
            <p className={`mt-1 text-sm ${shareable ? 'text-slate-500' : 'text-white/70'}`}>{[show('showAgeGroup') && age != null ? `Age ${age}` : null, show('showPosition') ? snapshot.player.position : null].filter(Boolean).join(' · ') || 'Player profile'}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
        {show('showTeam') ? <CardMetric label="Team" value={snapshot.teams.join(', ') || 'Not assigned'} shareable={shareable} /> : null}
        {show('showPathwayStage') ? <CardMetric label="Pathway" value={snapshot.pathway.currentStage ?? 'Not set'} shareable={shareable} /> : null}
        {show('showAttendance') ? <CardMetric label="Attendance" value={snapshot.attendance.rate == null ? 'No data' : `${snapshot.attendance.rate}%`} shareable={shareable} /> : null}
        {show('showDevelopmentProgress') ? <CardMetric label="Development" value={progress == null ? 'No goals' : `${progress}% · ${completed} achieved`} shareable={shareable} /> : null}
        {show('showPerformanceMetrics') ? snapshot.testing.slice(0, 2).map((metric) => <CardMetric key={metric.test} label={metric.test} value={`${metric.latest} ${metric.unit}`} shareable={shareable} />) : null}
        {show('showAchievements') ? <CardMetric label="Achievements" value={snapshot.achievements.length > 0 ? snapshot.achievements.slice(0, 2).map((item) => item.title).join(', ') : 'None recorded'} shareable={shareable} /> : null}
      </div>
    </article>
  )
}

function CardMetric({ label, value, shareable }: { label: string; value: string; shareable: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${shareable ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.07]'}`}>
      <p className={`text-xs font-semibold ${shareable ? 'text-slate-500' : 'text-white/50'}`}>{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function ReportView({ report }: { report: PlayerReport }) {
  const { snapshot } = report
  return (
    <div className="mt-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-raised)] p-4 text-sm text-slate-700">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ui-metric"><p className="ui-metric-label">Attendance</p><p className="ui-metric-value">{snapshot.attendance.rate == null ? 'No data' : `${snapshot.attendance.rate}%`}</p><p className="mt-1 text-xs text-slate-500">{snapshot.attendance.attended}/{snapshot.attendance.recorded} recorded</p></div>
        <div className="ui-metric"><p className="ui-metric-label">Goals</p><p className="ui-metric-value">{snapshot.goals.length}</p><p className="mt-1 text-xs text-slate-500">captured in snapshot</p></div>
        <div className="ui-metric"><p className="ui-metric-label">Pathway</p><p className="ui-metric-value">{snapshot.pathway.currentStage ?? 'Not set'}</p></div>
      </div>
      {snapshot.latestAssessment ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="font-semibold text-slate-900">Strengths</p><p className="mt-1 whitespace-pre-wrap">{snapshot.latestAssessment.strengths ?? 'Not recorded'}</p></div><div><p className="font-semibold text-slate-900">Development priorities</p><p className="mt-1 whitespace-pre-wrap">{snapshot.latestAssessment.priorities ?? 'Not recorded'}</p></div></div> : null}
      {report.coachComment ? <div className="mt-4 border-t border-[var(--ui-border)] pt-4"><p className="font-semibold text-slate-900">Coach comment</p><p className="mt-1 whitespace-pre-wrap leading-6">{report.coachComment}</p></div> : null}
      <p className="mt-4 text-xs text-slate-400">Snapshot created {new Date(snapshot.generatedAt).toLocaleString('en-GB')}</p>
    </div>
  )
}

export function PlayerProgressPanel({ playerId, currentUserId, role }: Props) {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null)
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([])
  const [reports, setReports] = useState<PlayerReport[]>([])
  const [permissions, setPermissions] = useState<CardPermissions>(DEFAULT_CARD_PERMISSIONS)
  const [mode, setMode] = useState<'achievement' | 'report' | 'permissions' | null>(null)
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<AchievementType>('development')
  const [visibility, setVisibility] = useState<RecordVisibility>('parent')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const reload = useCallback(async () => {
    const [nextSnapshot, nextAchievements, nextReports, nextPermissions] = await Promise.all([
      buildReportSnapshot(playerId),
      fetchPlayerAchievements(playerId),
      fetchPlayerReports(playerId),
      fetchCardPermissions(playerId),
    ])
    setSnapshot(nextSnapshot)
    setAchievements(nextAchievements)
    setReports(nextReports)
    setPermissions(nextPermissions)
  }, [playerId])

  useEffect(() => {
    setError(null)
    void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load player progress.'))
  }, [reload])

  async function saveAchievement(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await createPlayerAchievement(playerId, currentUserId, { title, description, type, awardedOn: date, visibility })
      setAchievements((items) => [created, ...items])
      setTitle('')
      setDescription('')
      setMode(null)
      setSnapshot(await buildReportSnapshot(playerId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save achievement.')
    } finally {
      setSaving(false)
    }
  }

  async function saveReport(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const report = await createPlayerReport(playerId, currentUserId, { title, periodStart, periodEnd, coachComment: description })
      setReports((items) => [report, ...items])
      setTitle('')
      setDescription('')
      setMode(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create report.')
    } finally {
      setSaving(false)
    }
  }

  async function savePermissions() {
    setSaving(true)
    setError(null)
    try {
      await saveCardPermissions(playerId, currentUserId, permissions)
      setPermissions((current) => ({ ...current, approvedAt: new Date().toISOString() }))
      setMode(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save card permissions.')
    } finally {
      setSaving(false)
    }
  }

  async function publish(report: PlayerReport, nextVisibility: 'player' | 'parent') {
    setSaving(true)
    setError(null)
    try {
      await publishPlayerReport(report.id, nextVisibility)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to publish report.')
    } finally {
      setSaving(false)
    }
  }

  if (!snapshot) return <section className="ui-module"><div className="ui-module-body"><p className="text-sm text-slate-500">{error ?? 'Loading player card and reports…'}</p></div></section>

  const approvedFieldCount = CARD_FIELDS.filter((field) => permissions[field.key]).length

  return (
    <section className="ui-module">
      <div className="ui-module-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-accent)]">Player progress</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Cards, achievements and reports</h3><p className="mt-1 max-w-2xl text-sm text-slate-500">Internal information stays within ClubOS. Shareable fields require explicit approval and no public link is created.</p></div>
          <div className="ui-metric min-w-36 !bg-white text-right"><p className="ui-metric-label">Approved fields</p><p className="ui-metric-value">{approvedFieldCount}/{CARD_FIELDS.length}</p></div>
        </div>
      </div>
      <div className="ui-module-body space-y-6">
        <div className="grid gap-5 xl:grid-cols-2"><PlayerCard snapshot={snapshot} permissions={permissions} shareable={false} /><PlayerCard snapshot={snapshot} permissions={permissions} shareable /></div>
        <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setMode('achievement')}>Add achievement</Button><Button type="button" variant="secondary" onClick={() => setMode('report')}>Create report snapshot</Button>{role === 'admin' ? <Button type="button" variant="secondary" onClick={() => setMode('permissions')}>Approved card fields</Button> : null}</div>

        {mode === 'permissions' ? <div className="ui-form-surface"><h4 className="font-semibold text-slate-900">Shareable card field approval</h4><p className="mt-1 text-sm text-slate-500">Fields default to off. Approval changes the preview only and does not publish anything.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{CARD_FIELDS.map((field) => <label key={field.key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--ui-border)] bg-white px-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--ui-accent)]" checked={permissions[field.key]} onChange={(event) => setPermissions((current) => ({ ...current, [field.key]: event.target.checked }))} />{field.label}</label>)}</div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" loading={saving} onClick={() => void savePermissions()}>Save approval</Button><Button type="button" variant="secondary" onClick={() => setMode(null)}>Cancel</Button></div></div> : null}

        {mode === 'achievement' ? <form onSubmit={(event) => void saveAchievement(event)} className="ui-form-surface space-y-3"><div><h4 className="font-semibold text-slate-900">New achievement</h4><p className="mt-1 text-sm text-slate-500">Recognise meaningful individual progress without ranking players.</p></div><TextField label="Title" value={title} required onChange={(event) => setTitle(event.target.value)} /><div className="grid gap-3 sm:grid-cols-3"><SelectField label="Type" value={type} options={ACHIEVEMENT_TYPES.map((item) => ({ value: item, label: item.charAt(0).toUpperCase() + item.slice(1) }))} onChange={(event) => setType(event.target.value as AchievementType)} /><TextField label="Awarded on" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><SelectField label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={(event) => setVisibility(event.target.value as RecordVisibility)} /></div><label className="block text-sm font-semibold text-slate-700">Description<textarea className="ui-input mt-1.5 min-h-24 resize-y" rows={3} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="flex flex-wrap gap-2"><Button type="submit" loading={saving} disabled={!title.trim()}>Save achievement</Button><Button type="button" variant="secondary" onClick={() => setMode(null)}>Cancel</Button></div></form> : null}

        {mode === 'report' ? <form onSubmit={(event) => void saveReport(event)} className="ui-form-surface space-y-3"><div><h4 className="font-semibold text-slate-900">Create progress report snapshot</h4><p className="mt-1 text-sm text-slate-500">Captured attendance, goals, assessment, testing and pathway information will remain unchanged historically.</p></div><TextField label="Report title" value={title} required onChange={(event) => setTitle(event.target.value)} /><div className="grid gap-3 sm:grid-cols-2"><TextField label="Period start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /><TextField label="Period end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div><label className="block text-sm font-semibold text-slate-700">Coach comment<textarea className="ui-input mt-1.5 min-h-28 resize-y" rows={4} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="flex flex-wrap gap-2"><Button type="submit" loading={saving} disabled={!title.trim()}>Create draft</Button><Button type="button" variant="secondary" onClick={() => setMode(null)}>Cancel</Button></div></form> : null}

        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <div><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Achievements</h4><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{achievements.length}</span></div><div className="mt-3 space-y-2">{achievements.length === 0 ? <div className="ui-empty"><p className="font-semibold text-slate-700">No achievements yet</p><p className="mt-1">Add one when a meaningful milestone is reached.</p></div> : achievements.map((item) => <article key={item.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-amber-950">{item.title}</p><p className="mt-1 text-xs capitalize text-amber-700">{item.type} · {new Date(`${item.awardedOn}T00:00:00`).toLocaleDateString('en-GB')}</p></div><span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold capitalize text-amber-700">{item.visibility}</span></div>{item.description ? <p className="mt-2 text-sm leading-6 text-amber-900">{item.description}</p> : null}</article>)}</div></div>
          <div><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Historical reports</h4><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{reports.length}</span></div><div className="mt-3 space-y-2">{reports.length === 0 ? <div className="ui-empty"><p className="font-semibold text-slate-700">No report snapshots yet</p><p className="mt-1">Create a snapshot at the end of a review period.</p></div> : reports.map((report) => { const expanded = expandedReportId === report.id; return <article key={report.id} className="rounded-xl border border-[var(--ui-border)] bg-white p-4"><button type="button" className="w-full text-left" aria-expanded={expanded} onClick={() => setExpandedReportId((id) => id === report.id ? null : report.id)}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{report.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{new Date(report.createdAt).toLocaleDateString('en-GB')}</span><span className={`rounded-full px-2 py-0.5 font-semibold capitalize ${report.status === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{report.status}</span></div></div><span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500">{expanded ? '−' : '+'}</span></div></button>{expanded ? <><ReportView report={report} />{report.status === 'draft' ? <div className="mt-3 flex flex-wrap gap-2"><Button type="button" loading={saving} onClick={() => void publish(report, 'player')}>Publish to player</Button><Button type="button" variant="secondary" loading={saving} onClick={() => void publish(report, 'parent')}>Publish to player & parent</Button></div> : null}</> : null}</article> })}</div></div>
        </div>
      </div>
    </section>
  )
}
