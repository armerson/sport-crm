import { Suspense, lazy, useMemo, useState } from 'react'
import { useCoachClubData } from '../../hooks/useCoachClubData.ts'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import { formatDate, formatDateTime } from '../../utils/date.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { SuccessMessage } from '../ui/SuccessMessage.tsx'
import { TabNav } from '../ui/TabNav.tsx'
import { TextField } from '../ui/TextField.tsx'
import type { EventType } from '../../types/club.ts'

const TeamMessagesPanel = lazy(async () => {
  const module = await import('../messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

interface CoachEventPanelProps {
  coachId: string
  profile: import('../../types/auth.ts').UserProfile
}

interface EventFormState {
  title: string
  type: EventType
  dateTime: string
  location: string
}

type CoachTab = 'schedule' | 'create' | 'messages'

const COACH_TABS = [
  { label: 'Schedule', value: 'schedule' as CoachTab },
  { label: 'Create event', value: 'create' as CoachTab },
  { label: 'Messages', value: 'messages' as CoachTab },
] as const

function SectionFallback() {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
      Loading messages...
    </div>
  )
}

export function CoachEventPanel({ coachId, profile }: CoachEventPanelProps) {
  const [activeTab, setActiveTab] = useState<CoachTab>('schedule')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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

      setEventValues({ title: '', type: 'training', dateTime: '', location: '' })
      setSuccessMessage('Event created. Players have been given a pending attendance record.')
      setActiveTab('schedule')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  return (
    <section className="space-y-5">
      <TabNav tabs={COACH_TABS} active={activeTab} onChange={setActiveTab} />

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
                    <button
                      key={clubEvent.id}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        activeEventId === clubEvent.id
                          ? 'border-[#123524] bg-[#123524] text-white'
                          : 'border-transparent bg-slate-50 text-slate-800 hover:border-slate-200 hover:bg-white'
                      }`}
                      onClick={() => setSelectedEventId(clubEvent.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{clubEvent.title}</p>
                          <p className={`mt-0.5 text-sm ${activeEventId === clubEvent.id ? 'text-white/75' : 'text-slate-500'}`}>
                            {formatDateTime(clubEvent.dateTime)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                            activeEventId === clubEvent.id ? 'bg-white/15 text-white' : 'bg-white text-slate-600'
                          }`}
                        >
                          {clubEvent.type}
                        </span>
                      </div>
                      <p className={`mt-1.5 text-sm ${activeEventId === clubEvent.id ? 'text-white/70' : 'text-slate-500'}`}>
                        {clubEvent.location}
                      </p>
                    </button>
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
            <Button className="w-full" loading={isSubmitting} type="submit">
              Create event
            </Button>
          </form>
        </article>
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
