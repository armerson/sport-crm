import { useEffect, useState } from 'react'
import { createPathwayStage, fetchPathwayStages, updatePathwayStage, type PathwayStage } from '../../services/playerPathway.ts'
import type { TeamRecord } from '../../types/club.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'

export function PathwayStagesManager({ teams }: { teams: TeamRecord[] }) {
  const [stages, setStages] = useState<PathwayStage[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [linkedTeamId, setLinkedTeamId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPathwayStages(true).then(setStages).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load pathway stages.'))
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      const stage = await createPathwayStage({ name, description, linkedTeamId: linkedTeamId || null })
      setStages((current) => [...current, stage].sort((left, right) => left.sortOrder - right.sortOrder))
      setName(''); setDescription(''); setLinkedTeamId(''); setShowForm(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to add pathway stage.') }
    finally { setSaving(false) }
  }

  async function toggleActive(stage: PathwayStage) {
    try {
      await updatePathwayStage(stage.id, { active: !stage.active })
      setStages((current) => current.map((item) => item.id === stage.id ? { ...item, active: !item.active } : item))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update pathway stage.') }
  }

  const teamById = new Map(teams.map((team) => [team.id, team]))
  return (
    <div>
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">Club pathway</h2><p className="mt-1 text-sm text-slate-500">Stages describe progression and do not change a player's registered team.</p></div>{!showForm ? <Button type="button" onClick={() => setShowForm(true)}>Add stage</Button> : null}</div>
      {showForm ? <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4"><TextField label="Stage name" value={name} onChange={(event) => setName(event.target.value)} placeholder="U19 Development" required /><label className="block text-sm font-semibold text-slate-700">Description<textarea rows={3} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-normal outline-none focus:border-[var(--ui-accent)]" /></label><SelectField label="Linked team (optional)" value={linkedTeamId} options={[{ value: '', label: 'No linked team' }, ...teams.map((team) => ({ value: team.id, label: team.name }))]} onChange={(event) => setLinkedTeamId(event.target.value)} />{error ? <p className="text-sm text-rose-600">{error}</p> : null}<div className="flex gap-2"><Button type="submit" loading={saving} disabled={!name.trim()}>Add stage</Button><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button></div></form> : null}
      {error && !showForm ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {stages.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No pathway stages configured yet.</div> : <div className="mt-5 space-y-2">{stages.map((stage, index) => <article key={stage.id} className={`flex items-center gap-3 rounded-2xl border p-4 ${stage.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ui-accent)] text-sm font-bold text-white">{index + 1}</div><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{stage.name}</p><p className="text-xs text-slate-500">{stage.linkedTeamId ? `Linked to ${teamById.get(stage.linkedTeamId)?.name ?? 'team'}` : 'Independent pathway stage'}</p>{stage.description ? <p className="mt-1 text-sm text-slate-600">{stage.description}</p> : null}</div><Button type="button" variant="ghost" onClick={() => void toggleActive(stage)}>{stage.active ? 'Deactivate' : 'Restore'}</Button></article>)}</div>}
    </div>
  )
}
