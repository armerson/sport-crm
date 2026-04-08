import { Suspense, lazy, useMemo, useState } from 'react'
import { useParentClubData } from '../../hooks/useParentClubData.ts'
import { FamilyBillingCard } from './FamilyBillingCard.tsx'
import { PostFeed } from '../posts/PostFeed.tsx'
import { PlayerProfileCard } from '../players/PlayerProfileCard.tsx'
import { LocationMapCard } from '../ui/LocationPicker.tsx'
import { MotmVotingCard } from '../shared/MotmVotingCard.tsx'
import type { UserProfile } from '../../types/auth.ts'
import type { AttendanceStatus } from '../../types/club.ts'
import { formatDateTime } from '../../utils/date.ts'
import { SelectField } from '../ui/SelectField.tsx'
import { TabNav } from '../ui/TabNav.tsx'

const TeamMessagesPanel = lazy(async () => {
  const module = await import('../messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

interface ParentPortalProps {
  profile: UserProfile
  activeTab: ParentTab
  onTabChange: (tab: ParentTab) => void
}

export type ParentTab = 'schedule' | 'messages' | 'billing' | 'children' | 'feed'

const PARENT_TABS = [
  { label: 'Schedule', value: 'schedule' as ParentTab },
  { label: 'My children', value: 'children' as ParentTab },
  { label: 'Feed', value: 'feed' as ParentTab },
  { label: 'Billing', value: 'billing' as ParentTab },
  { label: 'Messages', value: 'messages' as ParentTab },
] as const

function SectionFallback() {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
      Loading messages...
    </div>
  )
}

export function EventList({
  eventsToShow,
  emptyLabel,
  teamById,
  attendanceByEvent,
  isSubmitting,
  onAttendanceResponse,
  resultByEventId = new Map(),
  currentUserId = '',
}: {
  eventsToShow: import('../../types/club.ts').EventRecord[]
  emptyLabel: string
  teamById: Map<string, import('../../types/club.ts').TeamRecord>
  attendanceByEvent: Map<string, import('../../types/club.ts').AttendanceRecord>
  isSubmitting: boolean
  onAttendanceResponse: (attendanceId: string, status: AttendanceStatus) => void
  resultByEventId?: Map<string, import('../../types/club.ts').ResultRecord>
  currentUserId?: string
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
        const isPast = new Date(event.dateTime) < new Date()
        const result = isPast && event.type === 'match' ? resultByEventId.get(event.id) : undefined

        return (
          <article key={event.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-950">{event.title}</h3>
                  <span className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {event.type}
                  </span>
                  {result ? (
                    <span className="rounded-full bg-[#123524] px-3 py-0.5 text-xs font-bold tabular-nums text-white">
                      {result.homeScore} — {result.awayScore}
                    </span>
                  ) : null}
                </div>
                {team ? (
                  <p className="text-sm text-slate-500">{team.name}{team.ageGroup ? ` · ${team.ageGroup}` : ''}</p>
                ) : null}
                <p className="text-sm text-slate-600">{formatDateTime(event.dateTime)}</p>
                <p className="text-sm text-slate-600">{event.location}</p>
                {event.location && (
                  <div className="mt-2">
                    <LocationMapCard location={event.location} placeId={event.placeId} lat={event.lat} lng={event.lng} />
                  </div>
                )}
              </div>

              {!isPast && attendanceRecord && (
                <div className="shrink-0">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onAttendanceResponse(attendanceRecord.id, attendanceRecord.status === 'yes' ? 'pending' : 'yes')}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition active:scale-95 ${
                        attendanceRecord.status === 'yes'
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                          : 'border-2 border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
                      } disabled:opacity-50`}
                    >
                      <span>✓</span> Going
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onAttendanceResponse(attendanceRecord.id, attendanceRecord.status === 'no' ? 'pending' : 'no')}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition active:scale-95 ${
                        attendanceRecord.status === 'no'
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-200'
                          : 'border-2 border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-500'
                      } disabled:opacity-50`}
                    >
                      <span>✕</span> Can't go
                    </button>
                  </div>
                </div>
              )}
              {isPast && attendanceRecord && (
                <div className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-bold ${
                  attendanceRecord.status === 'yes' ? 'bg-emerald-100 text-emerald-700' :
                  attendanceRecord.status === 'no' ? 'bg-rose-100 text-rose-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {attendanceRecord.status === 'yes' ? 'Attended' : attendanceRecord.status === 'no' ? 'Missed' : 'No response'}
                </div>
              )}
            </div>

            {/* MOTM voting — past matches only */}
            {isPast && event.type === 'match' && currentUserId ? (
              <MotmVotingCard
                eventId={event.id}
                isPastMatch={isPast}
                teamId={event.teamId}
                currentUserId={currentUserId}
              />
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

export function ParentPortal({ profile, activeTab, onTabChange }: ParentPortalProps) {
  const setActiveTab = onTabChange
  const [selectedChildId, setSelectedChildId] = useState('')
  const { attendance, error, events, isConfigured, isSubmitting, loadingAttendance, loadingEvents, loadingPlayers, players, resultByEventId, teams, updateAttendance } =
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

  const upcomingEvents = useMemo(() => {
    const cutoff = new Date()
    return childEvents.filter((event) => new Date(event.dateTime) >= cutoff)
  }, [childEvents])
  const pastEvents = useMemo(() => {
    const cutoff = new Date()
    return childEvents.filter((event) => new Date(event.dateTime) < cutoff).reverse()
  }, [childEvents])

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
      <div className="hidden sm:block">
        <TabNav tabs={PARENT_TABS} active={activeTab} onChange={setActiveTab} />
      </div>

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
                    resultByEventId={resultByEventId}
                    currentUserId={profile.id}
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
                      resultByEventId={resultByEventId}
                      currentUserId={profile.id}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </section>
      ) : null}

      {/* CHILDREN PROFILES TAB */}
      {activeTab === 'children' ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">My children</h2>
            <p className="mt-1 text-sm text-slate-500">
              View and manage your {players.length === 1 ? "child's" : "children's"} profiles, emergency contacts, and identity documents.
            </p>
          </div>

          {loadingPlayers ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              No children linked to your account yet. Contact the club admin.
            </div>
          ) : (
            players.map((child) => (
              <PlayerProfileCard
                key={child.id}
                playerId={child.id}
                role="parent"
                currentUserId={profile.id}
              />
            ))
          )}
        </section>
      ) : null}

      {/* BILLING TAB */}
      {activeTab === 'billing' ? (
        <FamilyBillingCard profile={profile} players={players} />
      ) : null}

      {/* FEED TAB */}
      {activeTab === 'feed' ? (
        <PostFeed profile={profile} teamIds={teams.map((t) => t.id)} />
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
