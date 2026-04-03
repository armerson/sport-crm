import { Suspense, lazy, useMemo, useState } from 'react'
import { useParentClubData } from '../../hooks/useParentClubData.ts'
import type { UserProfile } from '../../types/auth.ts'
import type { AttendanceStatus } from '../../types/club.ts'
import { formatDateTime } from '../../utils/date.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TabNav } from '../ui/TabNav.tsx'

const TeamMessagesPanel = lazy(async () => {
  const module = await import('../messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

interface ParentPortalProps {
  profile: UserProfile
}

type ParentTab = 'schedule' | 'messages'

const PARENT_TABS = [
  { label: 'Schedule', value: 'schedule' as ParentTab },
  { label: 'Messages', value: 'messages' as ParentTab },
] as const

function SectionFallback() {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
      Loading messages...
    </div>
  )
}

function EventList({
  eventsToShow,
  emptyLabel,
  teamById,
  attendanceByEvent,
  isSubmitting,
  onAttendanceResponse,
}: {
  eventsToShow: import('../../types/club.ts').EventRecord[]
  emptyLabel: string
  teamById: Map<string, import('../../types/club.ts').TeamRecord>
  attendanceByEvent: Map<string, import('../../types/club.ts').AttendanceRecord>
  isSubmitting: boolean
  onAttendanceResponse: (attendanceId: string, status: AttendanceStatus) => void
}) {
  if (eventsToShow.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {eventsToShow.map((event) => {
        const team = teamById.get(event.teamId)
        const attendanceRecord = attendanceByEvent.get(event.id)

        return (
          <article key={event.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-950">{event.title}</h3>
                  <span className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {event.type}
                  </span>
                </div>
                {team ? (
                  <p className="text-sm text-slate-500">{team.name}{team.ageGroup ? ` · ${team.ageGroup}` : ''}</p>
                ) : null}
                <p className="text-sm text-slate-600">{formatDateTime(event.dateTime)}</p>
                <p className="text-sm text-slate-600">{event.location}</p>
              </div>

              <div className="shrink-0 space-y-2 sm:min-w-56">
                <div className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-700">
                  Response:{' '}
                  <span className="font-semibold capitalize text-slate-950">{attendanceRecord?.status ?? 'pending'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['yes', 'pending', 'no'] as const).map((status) => (
                    <Button
                      key={status}
                      className="px-2 capitalize"
                      disabled={!attendanceRecord}
                      loading={isSubmitting && attendanceRecord?.status !== status}
                      onClick={() => attendanceRecord && onAttendanceResponse(attendanceRecord.id, status)}
                      variant={attendanceRecord?.status === status ? 'primary' : 'secondary'}
                    >
                      {status === 'yes' ? 'Going' : status === 'no' ? 'No' : 'Maybe'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function ParentPortal({ profile }: ParentPortalProps) {
  const [activeTab, setActiveTab] = useState<ParentTab>('schedule')
  const [selectedChildId, setSelectedChildId] = useState('')
  const { attendance, error, events, isConfigured, isSubmitting, loadingAttendance, loadingEvents, loadingPlayers, players, teams, updateAttendance } =
    useParentClubData(profile.children)

  const activeChildId = selectedChildId || (players.length === 1 ? (players[0]?.id ?? '') : '')
  const activeChild = players.find((player) => player.id === activeChildId) ?? null
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])

  const attendanceByEvent = useMemo(
    () => new Map(attendance.filter((entry) => entry.playerId === activeChildId).map((entry) => [entry.eventId, entry])),
    [activeChildId, attendance],
  )

  const childEvents = useMemo(() => {
    if (!activeChild) return []
    return events
      .filter((event) => activeChild.teams.includes(event.teamId))
      .sort((left, right) => left.dateTime.localeCompare(right.dateTime))
  }, [activeChild, events])

  const upcomingEvents = useMemo(() => childEvents.filter((event) => new Date(event.dateTime) >= now), [childEvents])
  const pastEvents = useMemo(() => childEvents.filter((event) => new Date(event.dateTime) < now).reverse(), [childEvents])

  const childAttendanceCounts = useMemo(() => {
    if (!activeChildId) return null
    const records = attendance.filter((entry) => entry.playerId === activeChildId)
    return {
      yes: records.filter((entry) => entry.status === 'yes').length,
      pending: records.filter((entry) => entry.status === 'pending').length,
      no: records.filter((entry) => entry.status === 'no').length,
    }
  }, [activeChildId, attendance])

  async function handleAttendanceResponse(attendanceId: string, status: AttendanceStatus) {
    try {
      await updateAttendance(attendanceId, status)
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  return (
    <section className="space-y-5">
      <TabNav tabs={PARENT_TABS} active={activeTab} onChange={setActiveTab} />

      {!isConfigured ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured. Add your project values to .env.local before using the parent portal.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' ? (
        <section className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {players.length === 1 ? "Your child's schedule" : 'Choose a child'}
                </h2>
                <p className="text-sm text-slate-500">
                  {loadingPlayers
                    ? 'Loading...'
                    : `${players.length} linked ${players.length === 1 ? 'child' : 'children'}`}
                </p>
              </div>

              {players.length > 1 ? (
                <div className="mt-4">
                  <SelectField
                    label="Child"
                    onChange={(event) => setSelectedChildId(event.target.value)}
                    options={[
                      { label: 'Choose a child', value: '' },
                      ...players.map((player) => ({ label: player.name, value: player.id })),
                    ]}
                    value={activeChildId}
                  />
                </div>
              ) : null}

              {players.length === 0 && !loadingPlayers ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No children linked to your account yet. Contact the club admin to link your child.
                </div>
              ) : null}

              {activeChild ? (
                <div className="mt-4 rounded-[1.5rem] bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{activeChild.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeChild.teams.length > 0 ? (
                      activeChild.teams.map((teamId) => (
                        <span key={teamId} className="rounded-full bg-[#123524] px-3 py-1 text-xs font-semibold text-white">
                          {teamById.get(teamId)?.name ?? 'Team'}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">No teams assigned yet.</span>
                    )}
                  </div>
                </div>
              ) : null}
            </article>

            <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Attendance summary</h2>
              {childAttendanceCounts ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-[#123524] p-4 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Going</p>
                    <p className="mt-2 text-3xl font-semibold">{childAttendanceCounts.yes}</p>
                  </div>
                  <div className="rounded-3xl bg-[#f18a3f] p-4 text-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900/70">Pending</p>
                    <p className="mt-2 text-3xl font-semibold">{childAttendanceCounts.pending}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950 p-4 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Not going</p>
                    <p className="mt-2 text-3xl font-semibold">{childAttendanceCounts.no}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  Select a child to see their attendance summary.
                </div>
              )}
            </article>
          </div>

          <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {activeChild ? `${activeChild.name}'s events` : 'Upcoming events'}
              </h2>
              <p className="text-sm text-slate-500">
                {loadingEvents || loadingAttendance ? 'Loading...' : `${childEvents.length} total`}
              </p>
            </div>

            {!activeChild && !loadingPlayers ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                Select a child above to view their schedule.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Upcoming</h3>
                  <EventList
                    eventsToShow={upcomingEvents}
                    emptyLabel={activeChild ? 'No upcoming events.' : 'Select a child to see upcoming events.'}
                    teamById={teamById}
                    attendanceByEvent={attendanceByEvent}
                    isSubmitting={isSubmitting}
                    onAttendanceResponse={handleAttendanceResponse}
                  />
                </div>

                {pastEvents.length > 0 ? (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Past events</h3>
                    <EventList
                      eventsToShow={pastEvents}
                      emptyLabel="No past events."
                      teamById={teamById}
                      attendanceByEvent={attendanceByEvent}
                      isSubmitting={isSubmitting}
                      onAttendanceResponse={handleAttendanceResponse}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </section>
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
