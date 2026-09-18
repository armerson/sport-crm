import { useEffect, useMemo, useState } from 'react'
import {
  completeTestingEvent,
  createTestingEvent,
  fetchTestDefinitions,
  fetchTestingEventResults,
  fetchTestingEvents,
  saveTestingResult,
  type TestDefinition,
  type TestResult,
  type TestingEvent,
} from '../../services/performanceTesting.ts'
import type { PlayerRecord } from '../../types/club.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'

interface TestingEventsPanelProps {
  teamId: string
  teamName: string
  players: PlayerRecord[]
  currentUserId: string
}

function NewTestingEvent({
  teamId, players, definitions, currentUserId, onCreated, onCancel,
}: {
  teamId: string
  players: PlayerRecord[]
  definitions: TestDefinition[]
  currentUserId: string
  onCreated: (event: TestingEvent) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [selectedTests, setSelectedTests] = useState<string[]>(definitions.map((test) => test.id))
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(players.map((player) => player.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTest(testId: string) {
    setSelectedTests((current) => current.includes(testId) ? current.filter((id) => id !== testId) : [...current, testId])
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayers((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId])
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || selectedTests.length === 0 || selectedPlayers.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const created = await createTestingEvent({
        name, eventDate, location, teamId,
        playerIds: selectedPlayers,
        testIds: selectedTests,
        createdBy: currentUserId,
      })
      onCreated(created)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create testing event.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border border-[var(--ui-accent)]/20 bg-white p-4">
      <TextField label="Event name" value={name} onChange={(event) => setName(event.target.value)} placeholder="December 2026 Player Testing" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required />
        <TextField label="Location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Training ground" />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Tests</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {definitions.map((test) => (
            <label key={test.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={selectedTests.includes(test.id)} onChange={() => toggleTest(test.id)} className="h-5 w-5 accent-[var(--ui-accent)]" />
              <span><span className="font-semibold text-slate-800">{test.name}</span><span className="ml-1 text-slate-400">({test.unit})</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Players</legend>
        <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
          {players.map((player) => (
            <label key={player.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={selectedPlayers.includes(player.id)} onChange={() => togglePlayer(player.id)} className="h-5 w-5 accent-[var(--ui-accent)]" />
              <span className="font-semibold text-slate-800">{player.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-slate-500">{selectedPlayers.length} of {players.length} current squad players selected.</p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" loading={saving} disabled={!name.trim() || selectedTests.length === 0 || selectedPlayers.length === 0}>Create event</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function EventEntry({
  event, players, definitions, currentUserId, onCompleted,
}: {
  event: TestingEvent
  players: PlayerRecord[]
  definitions: TestDefinition[]
  currentUserId: string
  onCompleted: () => void
}) {
  const eventTests = definitions.filter((test) => event.testIds.includes(test.id))
  const eventPlayers = players.filter((player) => event.playerIds.includes(player.id))
  const [activeTestId, setActiveTestId] = useState(eventTests[0]?.id ?? '')
  const [results, setResults] = useState<TestResult[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeTest = eventTests.find((test) => test.id === activeTestId) ?? null

  useEffect(() => {
    fetchTestingEventResults(event.id).then(setResults).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load results.'))
  }, [event.id])

  const resultByPlayer = useMemo(() => new Map(results.filter((result) => result.testDefinitionId === activeTestId).map((result) => [result.playerId, result])), [activeTestId, results])

  async function save(playerId: string) {
    if (!activeTest) return
    const raw = values[playerId] ?? String(resultByPlayer.get(playerId)?.resultValue ?? '')
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    setSavingPlayerId(playerId)
    setError(null)
    try {
      const saved = await saveTestingResult({ eventId: event.id, playerId, testDefinitionId: activeTest.id, value, testedAt: event.eventDate, recordedBy: currentUserId })
      setResults((current) => [...current.filter((result) => !(result.playerId === playerId && result.testDefinitionId === activeTest.id)), saved])
      setValues((current) => ({ ...current, [playerId]: String(saved.resultValue) }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save result.')
    } finally {
      setSavingPlayerId(null)
    }
  }

  async function complete() {
    try {
      await completeTestingEvent(event.id)
      onCompleted()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to complete event.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4">
        <h4 className="font-semibold text-slate-900">{event.name}</h4>
        <p className="mt-1 text-sm text-slate-500">{new Date(`${event.eventDate}T00:00:00`).toLocaleDateString('en-GB')} {event.location ? `· ${event.location}` : ''}</p>
      </div>
      <SelectField label="Enter results for" value={activeTestId} options={eventTests.map((test) => ({ value: test.id, label: `${test.name} (${test.unit})` }))} onChange={(input) => setActiveTestId(input.target.value)} />
      {activeTest ? (
        <div className="space-y-2">
          {eventPlayers.map((player) => {
            const saved = resultByPlayer.get(player.id)
            return (
              <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{player.name}</p>{saved ? <p className="text-xs text-emerald-700">Saved</p> : null}</div>
                <label className="flex items-center gap-2">
                  <span className="sr-only">{activeTest.name} result for {player.name}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={10 ** -activeTest.decimalPlaces}
                    value={values[player.id] ?? (saved ? String(saved.resultValue) : '')}
                    onChange={(input) => setValues((current) => ({ ...current, [player.id]: input.target.value }))}
                    className="h-11 w-28 rounded-xl border border-slate-200 px-3 text-base tabular-nums outline-none focus:border-[var(--ui-accent)]"
                  />
                  <span className="w-14 text-xs text-slate-500">{activeTest.unit}</span>
                </label>
                <Button type="button" loading={savingPlayerId === player.id} onClick={() => void save(player.id)}>Save</Button>
              </div>
            )
          })}
        </div>
      ) : null}
      {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {event.status !== 'completed' ? <Button type="button" variant="secondary" onClick={() => void complete()}>Mark event complete</Button> : null}
    </div>
  )
}

export function TestingEventsPanel({ teamId, teamName, players, currentUserId }: TestingEventsPanelProps) {
  const [events, setEvents] = useState<TestingEvent[]>([])
  const [definitions, setDefinitions] = useState<TestDefinition[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchTestingEvents(teamId), fetchTestDefinitions()])
      .then(([nextEvents, nextDefinitions]) => { if (!cancelled) { setEvents(nextEvents); setDefinitions(nextDefinitions) } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load testing events.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [teamId])

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null

  return (
    <section className="ui-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-accent)]">Performance testing</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{teamName}</h2><p className="mt-1 text-sm text-slate-500">Create an event, choose a test, then work down the squad.</p></div>
        {!creating && !selectedEvent ? <Button type="button" onClick={() => setCreating(true)}>New testing event</Button> : null}
      </div>
      {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {creating ? <div className="mt-5"><NewTestingEvent teamId={teamId} players={players} definitions={definitions} currentUserId={currentUserId} onCreated={(event) => { setEvents((current) => [event, ...current]); setSelectedEventId(event.id); setCreating(false) }} onCancel={() => setCreating(false)} /></div> : null}
      {selectedEvent ? (
        <div className="mt-5"><button type="button" onClick={() => setSelectedEventId('')} className="mb-4 min-h-11 text-sm font-semibold text-[var(--ui-accent)]">← Back to testing events</button><EventEntry event={selectedEvent} players={players} definitions={definitions} currentUserId={currentUserId} onCompleted={() => setEvents((current) => current.map((event) => event.id === selectedEvent.id ? { ...event, status: 'completed' } : event))} /></div>
      ) : null}
      {!creating && !selectedEvent ? (
        loading ? <p className="mt-5 text-sm text-slate-400">Loading testing events…</p> : events.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No testing events yet.</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{events.map((event) => <button key={event.id} type="button" onClick={() => setSelectedEventId(event.id)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--ui-accent)]"><div className="flex items-start justify-between gap-2"><p className="font-semibold text-slate-900">{event.name}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">{event.status}</span></div><p className="mt-1 text-sm text-slate-500">{new Date(`${event.eventDate}T00:00:00`).toLocaleDateString('en-GB')}</p><p className="mt-2 text-xs text-slate-400">{event.playerIds.length} players · {event.testIds.length} tests</p></button>)}</div>
      ) : null}
    </section>
  )
}
