import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useAttendanceStats } from '../../hooks/useAttendanceStats.ts'
import { useCoachClubData } from '../../hooks/useCoachClubData.ts'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import { PlayerProfileCard } from '../players/PlayerProfileCard.tsx'
import { formatDate, formatDateTime } from '../../utils/date.ts'
import { Button } from '../ui/Button.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { SuccessMessage } from '../ui/SuccessMessage.tsx'
import { TabNav } from '../ui/TabNav.tsx'
import { TextField } from '../ui/TextField.tsx'
import type { EventType, RecurrencePattern } from '../../types/club.ts'

const TeamMessagesPanel = lazy(async () => {
  const module = await import('../messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

interface CoachEventPanelProps {
  coachId: string
  profile: import('../../types/auth.ts').UserProfile
  activeTab: CoachTab
  onTabChange: (tab: CoachTab) => void
}

interface EventFormState {
  title: string
  type: EventType
  dateTime: string
  location: string
  recurring: boolean
  recurrencePattern: RecurrencePattern
  recurrenceWeeks: number
}

export type CoachTab = 'schedule' | 'create' | 'stats' | 'squad' | 'messages'

const COACH_TABS = [
  { label: 'Schedule', value: 'schedule' as CoachTab },
  { label: 'Create event', value: 'create' as CoachTab },
  { label: 'Squad', value: 'squad' as CoachTab },
  { label: 'Stats', value: 'stats' as CoachTab },
  { label: 'Messages', value: 'messages' as CoachTab },
] as const

const WEEK_OPTIONS = Array.from({ length: 19 }, (_, i) => ({
  label: `${i + 2} sessions`,
  value: String(i + 2),
}))

function SectionFallback() {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
      Loading messages...
    </div>
  )
}

function RecurringBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Recurring
    </span>
  )
}

export function CoachEventPanel({ coachId, profile, activeTab, onTabChange }: CoachEventPanelProps) {
  const setActiveTab = onTabChange
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [squadViewPlayerId, setSquadViewPlayerId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Pick<EventFormState, 'title' | 'type' | 'dateTime' | 'location'>>({
    title: '',
    type: 'training',
    dateTime: '',
    location: '',
  })
  const [eventValues, setEventValues] = useState<EventFormState>({
    title: '',
    type: 'training',
    dateTime: '',
    location: '',
    recurring: false,
    recurrencePattern: 'weekly',
    recurrenceWeeks: 6,
  })
  const [resultValues, setResultValues] = useState({ homeScore: '', awayScore: '', notes: '' })
  const [showResultForm, setShowResultForm] = useState(false)

  const {
    activeEventId,
    activeTeamId,
    attendance,
    createEvent,
    updateEvent,
    deleteEvent,
    deleteEventSeries,
    error,
    events,
    isConfigured,
    isSubmitting,
    loadingAttendance,
    loadingEvents,
    loadingTeams,
    resultByEventId,
    saveResult,
    teams,
  } = useCoachClubData(coachId, selectedTeamId, selectedEventId)

  const { players, loading: loadingPlayers } = useTeamPlayers(activeTeamId)
  const { stats, loading: loadingStats } = useAttendanceStats(activeTeamId)
  const selectedTeam = teams.find((team) => team.id === activeTeamId) ?? null
  const activeEvent = events.find((e) => e.id === activeEventId) ?? null
  const isPastMatch = activeEvent?.type === 'match' && new Date(activeEvent.dateTime) < new Date()
  const existingResult = isPastMatch ? resultByEventId.get(activeEventId) : undefined
  const isSingleTeamCoach = teams.length === 1

  const attendanceCounts = useMemo(
    () => ({
      yes: attendance.filter((entry) => entry.status === 'yes').length,
      no: attendance.filter((entry) => entry.status === 'no').length,
      pending: attendance.filter((entry) => entry.status === 'pending').length,
    }),
    [attendance],
  )

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])
  const activeError = localError ?? error

  async function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (!activeTeamId || !eventValues.title.trim() || !eventValues.dateTime || !eventValues.location.trim()) {
      setLocalError('Team, title, date/time, and location are required.')
      return
    }

    const recurrence =
      eventValues.type === 'training' && eventValues.recurring
        ? { pattern: eventValues.recurrencePattern, weeks: eventValues.recurrenceWeeks }
        : undefined

    try {
      await createEvent(
        {
          teamId: activeTeamId,
          title: eventValues.title.trim(),
          type: eventValues.type,
          dateTime: eventValues.dateTime,
          location: eventValues.location.trim(),
        },
        players.map((player) => player.id),
        recurrence,
      )

      setEventValues({ title: '', type: 'training', dateTime: '', location: '', recurring: false, recurrencePattern: 'weekly', recurrenceWeeks: 6 })
      const sessionLabel = recurrence ? `${recurrence.weeks} training sessions` : 'event'
      setSuccessMessage(`${sessionLabel.charAt(0).toUpperCase() + sessionLabel.slice(1)} created. Players have been given a pending attendance record.`)
      setActiveTab('schedule')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  function startEditingEvent(eventId: string) {
    const event = events.find((e) => e.id === eventId)
    if (!event) return
    // Convert stored ISO datetime to datetime-local format (no seconds, no Z)
    const localDt = event.dateTime ? event.dateTime.slice(0, 16) : ''
    setEditValues({ title: event.title, type: event.type, dateTime: localDt, location: event.location })
    setEditingEventId(eventId)
    setSelectedEventId(eventId)
  }

  async function handleUpdateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingEventId) return
    setLocalError(null)
    if (!editValues.title.trim() || !editValues.dateTime || !editValues.location.trim()) {
      setLocalError('Title, date/time, and location are required.')
      return
    }
    try {
      await updateEvent(editingEventId, {
        title: editValues.title.trim(),
        type: editValues.type,
        dateTime: new Date(editValues.dateTime).toISOString(),
        location: editValues.location.trim(),
      })
      setSuccessMessage('Event updated.')
      setEditingEventId(null)
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  async function handleDeleteEvent(eventId: string) {
    try {
      await deleteEvent(eventId)
      if (selectedEventId === eventId) setSelectedEventId('')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  async function handleDeleteSeries(recurrenceGroupId: string, fromDateTime: string, eventId: string) {
    try {
      await deleteEventSeries(recurrenceGroupId, fromDateTime)
      if (selectedEventId === eventId) setSelectedEventId('')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  useEffect(() => {
    setShowResultForm(false)
    setResultValues({ homeScore: '', awayScore: '', notes: '' })
  }, [activeEventId])

  async function handleSaveResult(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLocalError(null)
    const home = parseInt(resultValues.homeScore, 10)
    const away = parseInt(resultValues.awayScore, 10)
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setLocalError('Please enter valid scores (numbers ≥ 0).')
      return
    }
    try {
      await saveResult(activeEventId, {
        homeScore: home,
        awayScore: away,
        notes: resultValues.notes.trim(),
      })
      setShowResultForm(false)
      setSuccessMessage('Result saved.')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  return (
    <section className="space-y-5">
      <div className="hidden sm:block">
        <TabNav tabs={COACH_TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {!isConfigured ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured. Add your project values to .env.local before using coach workflows.
        </div>
      ) : null}

      {activeError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{activeError}</div>
      ) : null}

      <SuccessMessage message={successMessage} />

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' ? (
        <section className="space-y-5">
          {!isSingleTeamCoach ? (
            <div className="max-w-sm">
              <SelectField
                label="Team"
                onChange={(event) => { setSelectedTeamId(event.target.value); setSelectedEventId('') }}
                options={[
                  { label: loadingTeams ? 'Loading teams...' : teams.length > 0 ? 'Choose a team' : 'No teams assigned', value: '' },
                  ...teams.map((team) => ({ label: `${team.name} (${team.ageGroup})`, value: team.id })),
                ]}
                value={selectedTeamId}
              />
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    {selectedTeam ? selectedTeam.name : isSingleTeamCoach ? (teams[0]?.name ?? 'Your team') : 'Events'}
                  </h2>
                  {selectedTeam ? (
                    <p className="mt-1 text-sm text-slate-500">{selectedTeam.ageGroup} · {selectedTeam.playerCount} players</p>
                  ) : null}
                </div>
                <p className="text-sm text-slate-500">{loadingEvents ? 'Loading...' : `${events.length} events`}</p>
              </div>

              <div className="mt-4 space-y-3">
                {events.length > 0 ? (
                  events.map((clubEvent) => (
                    <div
                      key={clubEvent.id}
                      className={`rounded-2xl border px-4 py-3 transition ${
                        activeEventId === clubEvent.id
                          ? 'border-[#123524] bg-[#123524] text-white'
                          : 'border-transparent bg-slate-50 text-slate-800 hover:border-slate-200 hover:bg-white'
                      }`}
                    >
                      {/* Clickable selection area */}
                      <button
                        className="w-full text-left"
                        onClick={() => setSelectedEventId(clubEvent.id)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{clubEvent.title}</p>
                            {clubEvent.recurrenceGroupId ? <RecurringBadge /> : null}
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                              activeEventId === clubEvent.id ? 'bg-white/15 text-white' : 'bg-white text-slate-600'
                            }`}
                          >
                            {clubEvent.type}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-sm ${activeEventId === clubEvent.id ? 'text-white/75' : 'text-slate-500'}`}>
                          {formatDateTime(clubEvent.dateTime)}
                        </p>
                        <p className={`mt-1 text-sm ${activeEventId === clubEvent.id ? 'text-white/70' : 'text-slate-500'}`}>
                          {clubEvent.location}
                        </p>
                      </button>

                      {/* Actions — separate row, not nested inside the selection button */}
                      <div className={`mt-2 flex items-center justify-between border-t pt-2 ${activeEventId === clubEvent.id ? 'border-white/20' : 'border-slate-200'}`}>
                        <button
                          className={`text-xs font-semibold transition ${activeEventId === clubEvent.id ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-[#123524]'}`}
                          onClick={() => startEditingEvent(clubEvent.id)}
                          type="button"
                        >
                          Edit
                        </button>
                        <div className="flex items-center gap-4">
                        {clubEvent.recurrenceGroupId ? (
                          <ConfirmInline
                            confirmLabel="Yes, cancel remaining"
                            label="Cancel series from here"
                            onConfirm={() => { void handleDeleteSeries(clubEvent.recurrenceGroupId!, clubEvent.dateTime, clubEvent.id) }}
                          />
                        ) : null}
                        <ConfirmInline
                          confirmLabel="Yes, delete"
                          label="Delete event"
                          onConfirm={() => { void handleDeleteEvent(clubEvent.id) }}
                        />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center">
                    <p className="text-sm text-slate-500">
                      {activeTeamId || isSingleTeamCoach ? 'No events yet for this team.' : 'Select a team to see its events.'}
                    </p>
                    {activeTeamId || isSingleTeamCoach ? (
                      <button
                        className="mt-3 text-sm font-semibold text-[#123524] underline underline-offset-2"
                        onClick={() => setActiveTab('create')}
                        type="button"
                      >
                        Create the first event
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
              {editingEventId ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-slate-950">Edit event</h2>
                    <button
                      className="text-sm font-medium text-slate-500 hover:text-slate-700"
                      onClick={() => setEditingEventId(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                  <form className="mt-4 space-y-4" onSubmit={handleUpdateEvent}>
                    <TextField
                      label="Title"
                      onChange={(e) => setEditValues((c) => ({ ...c, title: e.target.value }))}
                      value={editValues.title}
                    />
                    <SelectField
                      label="Type"
                      onChange={(e) => setEditValues((c) => ({ ...c, type: e.target.value === 'match' ? 'match' : 'training' }))}
                      options={[
                        { label: 'Training', value: 'training' },
                        { label: 'Match', value: 'match' },
                      ]}
                      value={editValues.type}
                    />
                    <TextField
                      label="Date and time"
                      onChange={(e) => setEditValues((c) => ({ ...c, dateTime: e.target.value }))}
                      type="datetime-local"
                      value={editValues.dateTime}
                    />
                    <TextField
                      label="Location"
                      onChange={(e) => setEditValues((c) => ({ ...c, location: e.target.value }))}
                      value={editValues.location}
                    />
                    <Button className="w-full" loading={isSubmitting} type="submit">
                      Save changes
                    </Button>
                  </form>
                </>
              ) : (
                <>
              <h2 className="text-xl font-semibold text-slate-950">Attendance</h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeEventId ? 'Responses for the selected event.' : 'Select an event to view attendance.'}
              </p>

              {activeEventId ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-[#123524] p-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Going</p>
                      <p className="mt-2 text-3xl font-semibold">{attendanceCounts.yes}</p>
                    </div>
                    <div className="rounded-3xl bg-[#f18a3f] p-4 text-slate-950">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900/70">Pending</p>
                      <p className="mt-2 text-3xl font-semibold">{attendanceCounts.pending}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-950 p-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Not going</p>
                      <p className="mt-2 text-3xl font-semibold">{attendanceCounts.no}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {loadingAttendance ? (
                      <p className="text-sm text-slate-500">Loading responses...</p>
                    ) : attendance.length > 0 ? (
                      attendance.map((entry) => {
                        const player = playersById.get(entry.playerId)
                        return (
                          <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-950">{player?.name ?? 'Unknown player'}</p>
                              {player?.dob ? (
                                <p className="text-sm text-slate-500">{formatDate(player.dob)}</p>
                              ) : null}
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                                entry.status === 'yes'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : entry.status === 'no'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {entry.status === 'yes' ? 'Going' : entry.status === 'no' ? 'Not going' : 'Pending'}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-slate-400">No attendance records yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  Select an event on the left to see attendance responses.
                </div>
              )}

              {/* Match Result — past match events only */}
              {activeEventId && isPastMatch ? (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Match Result</h3>
                    {!showResultForm ? (
                      <button
                        className="text-xs font-semibold text-[#123524] hover:underline"
                        onClick={() => {
                          if (existingResult) {
                            setResultValues({
                              homeScore: String(existingResult.homeScore),
                              awayScore: String(existingResult.awayScore),
                              notes: existingResult.notes ?? '',
                            })
                          }
                          setShowResultForm(true)
                        }}
                        type="button"
                      >
                        {existingResult ? 'Edit result' : 'Record result'}
                      </button>
                    ) : null}
                  </div>
                  {showResultForm ? (
                    <form className="space-y-3" onSubmit={handleSaveResult}>
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          label="Home score"
                          min="0"
                          onChange={(e) => setResultValues((c) => ({ ...c, homeScore: e.target.value }))}
                          type="number"
                          value={resultValues.homeScore}
                        />
                        <TextField
                          label="Away score"
                          min="0"
                          onChange={(e) => setResultValues((c) => ({ ...c, awayScore: e.target.value }))}
                          type="number"
                          value={resultValues.awayScore}
                        />
                      </div>
                      <TextField
                        label="Notes (optional)"
                        onChange={(e) => setResultValues((c) => ({ ...c, notes: e.target.value }))}
                        value={resultValues.notes}
                      />
                      <div className="flex gap-2">
                        <Button className="flex-1" loading={isSubmitting} type="submit">
                          Save result
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => setShowResultForm(false)}
                          type="button"
                          variant="secondary"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : existingResult ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Home — Away</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-slate-950">
                        {existingResult.homeScore} — {existingResult.awayScore}
                      </p>
                      {existingResult.notes ? (
                        <p className="mt-2 text-sm text-slate-600">{existingResult.notes}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                      No result recorded yet.
                    </div>
                  )}
                </div>
              ) : null}
                </>
              )}
            </article>
          </div>
        </section>
      ) : null}

      {/* CREATE EVENT TAB */}
      {activeTab === 'create' ? (
        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-slate-950">
            {isSingleTeamCoach ? 'Create an event for your squad' : 'Create event'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {activeTeamId || isSingleTeamCoach
              ? `${loadingPlayers ? 'Loading' : players.length} players will receive a pending attendance record.`
              : 'Select a team in the Schedule tab first, then come back to create an event.'}
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleCreateEvent}>
            {!isSingleTeamCoach ? (
              <SelectField
                label="Team"
                onChange={(event) => setSelectedTeamId(event.target.value)}
                options={[
                  { label: teams.length > 0 ? 'Choose a team' : 'No teams assigned', value: '' },
                  ...teams.map((team) => ({ label: `${team.name} (${team.ageGroup})`, value: team.id })),
                ]}
                value={selectedTeamId}
              />
            ) : null}
            <TextField
              label="Event title"
              onChange={(event) => setEventValues((current) => ({ ...current, title: event.target.value }))}
              placeholder="Saturday match vs Riverside"
              value={eventValues.title}
            />
            <SelectField
              label="Event type"
              onChange={(event) =>
                setEventValues((current) => ({
                  ...current,
                  type: event.target.value === 'match' ? 'match' : 'training',
                  recurring: event.target.value === 'match' ? false : current.recurring,
                }))
              }
              options={[
                { label: 'Training', value: 'training' },
                { label: 'Match', value: 'match' },
              ]}
              value={eventValues.type}
            />
            <TextField
              label={eventValues.type === 'training' && eventValues.recurring ? 'First session date and time' : 'Date and time'}
              onChange={(event) => setEventValues((current) => ({ ...current, dateTime: event.target.value }))}
              type="datetime-local"
              value={eventValues.dateTime}
            />
            <TextField
              label="Location"
              onChange={(event) => setEventValues((current) => ({ ...current, location: event.target.value }))}
              placeholder="Main pitch"
              value={eventValues.location}
            />

            {/* Recurring toggle — training only */}
            {eventValues.type === 'training' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">Recurring training schedule</p>
                    <p className="text-sm text-slate-500">Repeat this session weekly or fortnightly</p>
                  </div>
                  <button
                    aria-checked={eventValues.recurring}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                      eventValues.recurring ? 'bg-[#123524]' : 'bg-slate-300'
                    }`}
                    onClick={() => setEventValues((current) => ({ ...current, recurring: !current.recurring }))}
                    role="switch"
                    type="button"
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        eventValues.recurring ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>

                {eventValues.recurring ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Repeat"
                      onChange={(event) =>
                        setEventValues((current) => ({
                          ...current,
                          recurrencePattern: event.target.value === 'fortnightly' ? 'fortnightly' : 'weekly',
                        }))
                      }
                      options={[
                        { label: 'Every week', value: 'weekly' },
                        { label: 'Every two weeks', value: 'fortnightly' },
                      ]}
                      value={eventValues.recurrencePattern}
                    />
                    <SelectField
                      label="Number of sessions"
                      onChange={(event) =>
                        setEventValues((current) => ({
                          ...current,
                          recurrenceWeeks: Number(event.target.value),
                        }))
                      }
                      options={WEEK_OPTIONS}
                      value={String(eventValues.recurrenceWeeks)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button className="w-full" loading={isSubmitting} type="submit">
              {eventValues.type === 'training' && eventValues.recurring
                ? `Create ${eventValues.recurrenceWeeks} training sessions`
                : 'Create event'}
            </Button>
          </form>
        </article>
      ) : null}

      {/* STATS TAB */}
      {activeTab === 'stats' ? (
        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-slate-950">Attendance Stats</h2>
          <p className="mt-1 text-sm text-slate-500">Per-player attendance rate across all past events.</p>

          {!isSingleTeamCoach && !activeTeamId ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              Select a team in the Schedule tab to view stats.
            </div>
          ) : loadingStats ? (
            <p className="mt-6 text-sm text-slate-500">Calculating stats...</p>
          ) : stats.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              No players or past events yet.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {stats.map((stat) => {
                const pct = stat.rate ?? 0
                const barColour =
                  pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                return (
                  <div key={stat.playerId} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-950">{stat.playerName}</p>
                      <p className="shrink-0 text-sm text-slate-700">
                        {stat.rate !== null ? (
                          <>
                            <span className="font-semibold">{stat.rate}%</span>
                            <span className="ml-1.5 text-slate-400">({stat.attended}/{stat.total})</span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </p>
                    </div>
                    {stat.rate !== null ? (
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${barColour}`}
                          style={{ width: `${stat.rate}%` }}
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">No past events recorded</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </article>
      ) : null}

      {/* SQUAD TAB */}
      {activeTab === 'squad' ? (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Squad</h2>
            <p className="mt-1 text-sm text-slate-500">Player profiles, emergency contacts, and identity documents for your team.</p>
          </div>

          {!isSingleTeamCoach ? (
            <div className="max-w-sm">
              <SelectField
                label="Team"
                onChange={(event) => { setSelectedTeamId(event.target.value); setSquadViewPlayerId(null) }}
                options={[
                  { label: loadingTeams ? 'Loading teams...' : teams.length > 0 ? 'Choose a team' : 'No teams assigned', value: '' },
                  ...teams.map((team) => ({ label: `${team.name} (${team.ageGroup})`, value: team.id })),
                ]}
                value={selectedTeamId}
              />
            </div>
          ) : null}

          {!activeTeamId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Select a team to view the squad.
            </div>
          ) : loadingPlayers ? (
            <div className="text-sm text-slate-400">Loading players…</div>
          ) : players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              No players in this team yet.
            </div>
          ) : squadViewPlayerId ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSquadViewPlayerId(null)}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#123524] hover:underline"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                Back to squad
              </button>
              <PlayerProfileCard
                playerId={squadViewPlayerId}
                role="coach"
                currentUserId={profile.id}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setSquadViewPlayerId(player.id)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#123524]/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#123524]/10 text-lg font-bold text-[#123524]">
                      {player.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{player.name}</p>
                      <p className="text-xs text-slate-500">{formatDate(player.dob)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-right text-xs font-semibold text-[#123524]">View profile →</p>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* MESSAGES TAB */}
      {activeTab === 'messages' ? (
        <Suspense fallback={<SectionFallback />}>
          <TeamMessagesPanel profile={profile} />
        </Suspense>
      ) : null}
    </section>
  )
}
