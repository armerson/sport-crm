import { useEffect, useState } from 'react'
import { createTestDefinition, fetchTestCategories, fetchTestDefinitions, type TestCategory, type TestDefinition } from '../../services/performanceTesting.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'

export function TestDefinitionsManager() {
  const [tests, setTests] = useState<TestDefinition[]>([])
  const [categories, setCategories] = useState<TestCategory[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [direction, setDirection] = useState('higher')
  const [decimalPlaces, setDecimalPlaces] = useState('2')
  const [minimumAge, setMinimumAge] = useState('')
  const [maximumAge, setMaximumAge] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchTestDefinitions(), fetchTestCategories()]).then(([nextTests, nextCategories]) => {
      setTests(nextTests); setCategories(nextCategories); setCategoryId(nextCategories[0]?.id ?? '')
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load tests.'))
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError(null)
    try {
      const created = await createTestDefinition({
        categoryId, name, unit, description, higherIsBetter: direction === 'higher',
        decimalPlaces: Number(decimalPlaces), minimumAge: minimumAge ? Number(minimumAge) : null,
        maximumAge: maximumAge ? Number(maximumAge) : null,
      })
      setTests((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)))
      setName(''); setUnit(''); setDescription(''); setMinimumAge(''); setMaximumAge(''); setShowForm(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create test.')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">Performance tests</h2><p className="mt-1 text-sm text-slate-500">Configure the tests coaches can use in testing events.</p></div>{!showForm ? <Button type="button" onClick={() => setShowForm(true)}>Add test</Button> : null}</div>
      {showForm ? (
        <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2"><TextField label="Test name" value={name} onChange={(event) => setName(event.target.value)} required /><SelectField label="Category" value={categoryId} options={categories.map((category) => ({ value: category.id, label: category.name }))} onChange={(event) => setCategoryId(event.target.value)} /><TextField label="Unit" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="seconds, cm, %" required /><SelectField label="Better result" value={direction} options={[{ value: 'higher', label: 'Higher is better' }, { value: 'lower', label: 'Lower is better' }]} onChange={(event) => setDirection(event.target.value)} /><TextField label="Minimum age (optional)" type="number" min="3" max="100" value={minimumAge} onChange={(event) => setMinimumAge(event.target.value)} /><TextField label="Maximum age (optional)" type="number" min="3" max="100" value={maximumAge} onChange={(event) => setMaximumAge(event.target.value)} /><SelectField label="Decimal places" value={decimalPlaces} options={[0,1,2,3,4].map((value) => ({ value: String(value), label: String(value) }))} onChange={(event) => setDecimalPlaces(event.target.value)} /></div>
          <label className="block text-sm font-semibold text-slate-700">Description<textarea rows={3} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-normal outline-none focus:border-[var(--ui-accent)]" /></label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}<div className="flex gap-2"><Button type="submit" loading={saving} disabled={!name.trim() || !unit.trim() || !categoryId}>Create test</Button><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </form>
      ) : null}
      {error && !showForm ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{tests.map((test) => <article key={test.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{test.name}</p><p className="mt-1 text-xs text-slate-500">{test.categoryName} · {test.unit}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{test.higherIsBetter ? 'Higher ↑' : 'Lower ↓'}</span></div>{test.description ? <p className="mt-2 text-sm text-slate-600">{test.description}</p> : null}</article>)}</div>
    </div>
  )
}
