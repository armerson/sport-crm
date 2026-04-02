import { useMemo, useState } from 'react'
import { useCoachClubData } from '../../hooks/useCoachClubData.ts'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import { formatDateTime } from '../../utils/date.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'
import type { EventType } from '../../types/club.ts'

interface CoachEventPanelProps {
  coachId: string
}

interface EventFormState {
  title: string
  type: EventType
  dateTime: string
  location: string
}

export function CoachEventPanel({ coachId }: CoachEventPanelProps) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [eventValues, setEventValues] = useState<EventFormState>({
    title: '',
    type: 'training',
    dateTime: '',
    location: '',
  })

  const {
    activeEventId,
    activeTeamId,
    attendance,
    createEvent,
    error,
    events,
    isConfigured,
    isSubmitting,
    loadingAttendance,
    loadingEvents,
    loadingTeams,
    teams,
  } = useCoachClubData(coachId, selectedTeamId, selectedEventId)
  const { players, loading: loadingPlayers } = useTeamPlayers(activeTeamId)
  const selectedTeam = teams.find((team) => team.id === activeTeamId) ?? null
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
  const isSingleTeamCoach = teams.length === 1

  async function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (!activeTeamId || !eventValues.title.trim() || !eventValues.dateTime || !eventValues.location.trim()) {
      setLocalError('Team, title, date, time, and location are required.')
      return
    }

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
      )

      setEventValues({
        title: '',
        type: 'training',
        dateTime: '',
        location: '',
      })
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  return (
    <section className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Coach action</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {isSingleTeamCoach ? 'Create events for your squad' : 'Create events by team'}
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              {loadingTeams ? 'Loading teams...' : `${teams.length} assigned ${teams.length === 1 ? 'team' : 'teams'}`}
            </p>
          </div>

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
                }))
              }
              options={[
                { label: 'Training', value: 'training' },
                { label: 'Match', value: 'match' },
              ]}
              value={eventValues.type}
            />
            <TextField
              label="Date and time"
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
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {activeTeamId
                ? `${loadingPlayers ? 'Loading' : players.length} players will get a pending attendance record when this event is created.`
                : 'Choose a team to seed attendance records for its players.'}
            </div>
            <Button className="w-full" loading={isSubmitting} type="submit">
              Create event
            </Button>
          </form>
        </article>

        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-500">Team focus</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {selectedTeam ? selectedTeam.name : 'Select a team'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {selectedTeam
              ? `${selectedTeam.ageGroup} squad with ${selectedTeam.playerCount} players and ${selectedTeam.coachCount} coaches.`
              : 'Pick a team to view its events and attendance.'}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-[#123524] p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Yes</p>
              <p className="mt-2 text-3xl font-semibold">{attendanceCounts.yes}</p>
            </div>
            <div className="rounded-3xl bg-[#f18a3f] p-4 text-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900/70">Pending</p>
              <p className="mt-2 text-3xl font-semibold">{attendanceCounts.pending}</p>
            </div>
            <div className="rounded-3xl bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">No</p>
              <p className="mt-2 text-3xl font-semibold">{attendanceCounts.no}</p>
            </div>
          </div>
        </article>
      </section>

      {!isConfigured ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured yet. Add your project values to .env.local before using coach workflows.
        </div>
      ) : null}

      {activeError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{activeError}</div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Live club data</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Events and attendance</h2>
          </div>
          <div className="w-full max-w-sm">
            <SelectField
              label="Active event"
              onChange={(event) => setSelectedEventId(event.target.value)}
              options={[
                { label: activeTeamId ? 'Choose an event' : 'Select a team first', value: '' },
                ...events.map((clubEvent) => ({
                  label: `${clubEvent.title} · ${formatDateTime(clubEvent.dateTime)}`,
                  value: clubEvent.id,
                })),
              ]}
              value={activeEventId}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-950">Upcoming events</h3>
              <p className="text-sm text-slate-500">{loadingEvents ? 'Loading...' : `${events.length} scheduled`}</p>
            </div>
            <div className="mt-4 space-y-3">
              {events.length > 0 ? (
                events.map((clubEvent) => (
                  <button
                    key={clubEvent.id}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      activeEventId === clubEvent.id
                        ? 'border-[#123524] bg-[#123524] text-white'
                        : 'border-transparent bg-white text-slate-800 hover:border-slate-200'
                    }`}
                    onClick={() => setSelectedEventId(clubEvent.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{clubEvent.title}</p>
                        <p className={`text-sm ${activeEventId === clubEvent.id ? 'text-white/75' : 'text-slate-500'}`}>
                          {formatDateTime(clubEvent.dateTime)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          activeEventId === clubEvent.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {clubEvent.type}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm ${activeEventId === clubEvent.id ? 'text-white/80' : 'text-slate-600'}`}>
                      {clubEvent.location}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No events yet for this team.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-950">Attendance responses</h3>
              <p className="text-sm text-slate-500">{loadingAttendance ? 'Loading...' : `${attendance.length} records`}</p>
            </div>
            <div className="mt-4 space-y-3">
              {attendance.length > 0 ? (
                attendance.map((entry) => {
                  const player = playersById.get(entry.playerId)

                  return (
                    <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-950">{player?.name ?? 'Unknown player'}</p>
                        <p className="text-sm text-slate-500">{player?.dob || 'DOB not set'}</p>
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
                        {entry.status}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  {activeEventId ? 'Attendance will appear here once records exist.' : 'Select an event to inspect attendance.'}
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </section>
  )
}