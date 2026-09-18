import { useEffect, useMemo, useState } from 'react'
import { fetchDevelopmentGoals, linkGoalToPathwayStage, type DevelopmentGoal } from '../../services/playerDevelopment.ts'
import {
  advancePlayerPathway,
  createPathwayOpportunity,
  createPathwayRecommendation,
  fetchPathwayStages,
  fetchPathwayTeams,
  fetchPlayerPathway,
  type OpportunityType,
  type PathwayHistory,
  type PathwayOpportunity,
  type PathwayRecommendation,
  type PathwayStage,
  type PathwayTeam, type PathwayVisibility,
} from '../../services/playerPathway.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'

const VISIBILITY_OPTIONS = [
  { value: 'internal', label: 'Coaches only' },
  { value: 'player', label: 'Player visible' },
  { value: 'parent', label: 'Player and parent visible' },
]
const OPPORTUNITY_OPTIONS = [
  { value: 'training', label: 'Training with higher team' },
  { value: 'appearance', label: 'Appearance at higher level' },
  { value: 'trial', label: 'Trial' },
  { value: 'call_up', label: 'Call-up' },
]

export function PlayerPathwayPanel({ playerId, playerName, currentUserId }: { playerId: string; playerName: string; currentUserId: string }) {
  const [stages, setStages] = useState<PathwayStage[]>([])
  const [history, setHistory] = useState<PathwayHistory[]>([])
  const [recommendations, setRecommendations] = useState<PathwayRecommendation[]>([])
  const [opportunities, setOpportunities] = useState<PathwayOpportunity[]>([])
  const [teams, setTeams] = useState<PathwayTeam[]>([])
  const [goals, setGoals] = useState<DevelopmentGoal[]>([])
  const [readinessGoalId, setReadinessGoalId] = useState('')
  const [mode, setMode] = useState<'progress' | 'recommend' | 'opportunity' | null>(null)
  const [stageId, setStageId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [recommendation, setRecommendation] = useState('')
  const [notes, setNotes] = useState('')
  const [visibility, setVisibility] = useState<PathwayVisibility>('parent')
  const [teamId, setTeamId] = useState('')
  const [opportunityType, setOpportunityType] = useState<OpportunityType>('training')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [nextStages, nextTeams, pathway, nextGoals] = await Promise.all([fetchPathwayStages(), fetchPathwayTeams(), fetchPlayerPathway(playerId), fetchDevelopmentGoals(playerId)])
    setStages(nextStages); setHistory(pathway.history); setRecommendations(pathway.recommendations); setOpportunities(pathway.opportunities)
    setTeams(nextTeams)
    setGoals(nextGoals)
    setStageId((current) => current || nextStages[0]?.id || '')
    setTeamId((current) => current || nextTeams[0]?.id || '')
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchPathwayStages(), fetchPathwayTeams(), fetchPlayerPathway(playerId), fetchDevelopmentGoals(playerId)]).then(([nextStages, nextTeams, pathway, nextGoals]) => {
      if (cancelled) return
      setStages(nextStages); setTeams(nextTeams); setGoals(nextGoals); setHistory(pathway.history); setRecommendations(pathway.recommendations); setOpportunities(pathway.opportunities)
      setStageId(nextStages[0]?.id ?? ''); setTeamId(nextTeams[0]?.id ?? '')
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load pathway.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [playerId])

  const currentHistory = history.find((item) => item.isCurrent) ?? null
  const currentStage = stages.find((stage) => stage.id === currentHistory?.stageId) ?? null
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages])
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])

  function resetForm() { setMode(null); setRecommendation(''); setNotes(''); setDate(new Date().toISOString().slice(0, 10)); setVisibility('parent') }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      if (mode === 'progress') await advancePlayerPathway({ playerId, stageId, startedOn: date, recommendation, notes, visibility })
      if (mode === 'recommend') await createPathwayRecommendation({ playerId, stageId, recommendation, reviewDate: date, recommendedBy: currentUserId })
      if (mode === 'opportunity') await createPathwayOpportunity({ playerId, teamId, stageId, type: opportunityType, occurredOn: date, outcome: recommendation, notes, visibility, recordedBy: currentUserId })
      await load(); resetForm()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save pathway update.') }
    finally { setSaving(false) }
  }

  async function linkReadinessGoal() {
    if (!readinessGoalId || !stageId) return
    setSaving(true); setError(null)
    try {
      await linkGoalToPathwayStage(readinessGoalId, stageId)
      setGoals((current) => current.map((goal) => goal.id === readinessGoalId ? { ...goal, readinessForStageId: stageId } : goal))
      setReadinessGoalId('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to link readiness goal.') }
    finally { setSaving(false) }
  }

  return (
    <section className="ui-module">
      <div className="ui-module-header"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-accent)]">Player pathway</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{playerName}</h3><p className="mt-1 text-sm text-slate-500">Progression is tracked separately from registered team membership.</p></div><div className="ui-metric min-w-40 !bg-white text-right"><p className="ui-metric-label">Current stage</p><p className="ui-metric-value">{currentStage?.name ?? 'Not set'}</p></div></div></div>
      <div className="ui-module-body">
      {loading ? <p className="mt-5 text-sm text-slate-400">Loading pathway…</p> : null}
      {!loading && stages.length === 0 ? <div className="ui-empty mt-5"><p className="font-semibold text-slate-700">Club pathway not configured</p><p className="mt-1">An administrator needs to add the club’s pathway stages first.</p></div> : null}
      {stages.length > 0 ? <div className="mt-5 overflow-x-auto pb-2"><div className="flex min-w-max items-center">{stages.map((stage, index) => { const reached = history.some((item) => item.stageId === stage.id); const current = currentStage?.id === stage.id; return <div key={stage.id} className="flex items-center"><div className={`w-32 rounded-2xl border px-3 py-3 text-center ${current ? 'border-[var(--ui-accent)] bg-[var(--ui-accent)] text-white' : reached ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-500'}`}><p className="text-xs font-bold uppercase tracking-wide">Stage {index + 1}</p><p className="mt-1 text-sm font-semibold">{stage.name}</p></div>{index < stages.length - 1 ? <div className={`h-0.5 w-8 ${reached ? 'bg-emerald-300' : 'bg-slate-200'}`} /> : null}</div> })}</div></div> : null}
      {stages.length > 0 && !mode ? <div className="mt-5 flex flex-wrap gap-2"><Button type="button" onClick={() => setMode('progress')}>{currentStage ? 'Progress stage' : 'Set current stage'}</Button><Button type="button" variant="secondary" onClick={() => setMode('recommend')}>Add recommendation</Button><Button type="button" variant="secondary" onClick={() => setMode('opportunity')}>Record opportunity</Button></div> : null}
      {stages.length > 0 && goals.length > 0 && !mode ? <div className="mt-5 rounded-2xl bg-slate-50 p-4"><h4 className="font-semibold text-slate-900">Readiness goals</h4><p className="mt-1 text-xs text-slate-500">Connect an existing development goal to a pathway stage.</p><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><SelectField label="Development goal" value={readinessGoalId} options={[{ value: '', label: 'Choose a goal' }, ...goals.map((goal) => ({ value: goal.id, label: goal.title }))]} onChange={(event) => setReadinessGoalId(event.target.value)} /><SelectField label="Readiness for" value={stageId} options={stages.map((stage) => ({ value: stage.id, label: stage.name }))} onChange={(event) => setStageId(event.target.value)} /><Button className="self-end" type="button" loading={saving} disabled={!readinessGoalId || !stageId} onClick={() => void linkReadinessGoal()}>Link goal</Button></div>{goals.some((goal) => goal.readinessForStageId) ? <div className="mt-3 flex flex-wrap gap-2">{goals.filter((goal) => goal.readinessForStageId).map((goal) => <span key={goal.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">{goal.title} → {stageById.get(goal.readinessForStageId ?? '')?.name ?? 'Stage'}</span>)}</div> : null}</div> : null}
      {mode ? <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4"><h4 className="font-semibold text-slate-900">{mode === 'progress' ? 'Update pathway stage' : mode === 'recommend' ? 'Coach recommendation' : 'Higher-level opportunity'}</h4><SelectField label={mode === 'progress' ? 'New stage' : 'Pathway stage'} value={stageId} options={stages.map((stage) => ({ value: stage.id, label: stage.name }))} onChange={(event) => setStageId(event.target.value)} />{mode === 'opportunity' ? <><SelectField label="Opportunity team" value={teamId} options={teams.map((team) => ({ value: team.id, label: team.name }))} onChange={(event) => setTeamId(event.target.value)} /><SelectField label="Opportunity type" value={opportunityType} options={OPPORTUNITY_OPTIONS} onChange={(event) => setOpportunityType(event.target.value as OpportunityType)} /></> : null}<TextField label={mode === 'recommend' ? 'Review date' : 'Date'} type="date" value={date} onChange={(event) => setDate(event.target.value)} /><label className="block text-sm font-semibold text-slate-700">{mode === 'opportunity' ? 'Outcome' : 'Coach recommendation'}<textarea rows={3} required={mode === 'recommend'} maxLength={2000} value={recommendation} onChange={(event) => setRecommendation(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-normal outline-none focus:border-[var(--ui-accent)]" /></label>{mode !== 'recommend' ? <label className="block text-sm font-semibold text-slate-700">Notes<textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-normal outline-none focus:border-[var(--ui-accent)]" /></label> : null}{mode !== 'recommend' ? <SelectField label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={(event) => setVisibility(event.target.value as PathwayVisibility)} /> : null}{error ? <p className="text-sm text-rose-600">{error}</p> : null}<div className="flex gap-2"><Button type="submit" loading={saving} disabled={!stageId || (mode === 'opportunity' && !teamId)}>Save</Button><Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button></div></form> : null}
      {error && !mode ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {(history.length > 0 || opportunities.length > 0 || recommendations.length > 0) ? <div className="mt-6 grid gap-4 lg:grid-cols-2"><div><h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Progression history</h4><div className="mt-3 space-y-3">{history.map((item) => <article key={item.id} className="border-l-2 border-[var(--ui-accent)] pl-4"><p className="font-semibold text-slate-900">{stageById.get(item.stageId)?.name ?? 'Pathway stage'}</p><p className="text-xs text-slate-500">From {new Date(`${item.startedOn}T00:00:00`).toLocaleDateString('en-GB')}{item.endedOn ? ` to ${new Date(`${item.endedOn}T00:00:00`).toLocaleDateString('en-GB')}` : ' · Current'}</p>{item.recommendation ? <p className="mt-1 text-sm text-slate-600">{item.recommendation}</p> : null}</article>)}</div></div><div><h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Opportunities & recommendations</h4><div className="mt-3 space-y-3">{opportunities.map((item) => <article key={item.id} className="rounded-2xl bg-slate-50 p-3"><p className="font-semibold capitalize text-slate-900">{item.type.replace('_', '-')} · {teamById.get(item.opportunityTeamId)?.name ?? 'Higher team'}</p><p className="text-xs text-slate-500">{new Date(`${item.occurredOn}T00:00:00`).toLocaleDateString('en-GB')}</p>{item.outcome ? <p className="mt-1 text-sm text-slate-600">{item.outcome}</p> : null}</article>)}{recommendations.map((item) => <article key={item.id} className="rounded-2xl bg-amber-50 p-3"><p className="font-semibold text-amber-900">Recommended: {stageById.get(item.recommendedStageId)?.name ?? 'Pathway stage'}</p><p className="mt-1 text-sm text-amber-800">{item.recommendation}</p></article>)}</div></div></div> : null}
      </div>
    </section>
  )
}
