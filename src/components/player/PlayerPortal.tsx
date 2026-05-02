import { Suspense, lazy, useMemo } from 'react'
import { useParentClubData } from '../../hooks/useParentClubData.ts'
import { FamilyBillingCard } from '../parent/FamilyBillingCard.tsx'
import { EventList } from '../parent/ParentPortal.tsx'
import { PostFeed } from '../posts/PostFeed.tsx'
import { PlayerProfileCard } from '../players/PlayerProfileCard.tsx'
import type { UserProfile } from '../../types/auth.ts'
import type { AttendanceStatus } from '../../types/club.ts'
import { TabNav } from '../ui/TabNav.tsx'

const TeamMessagesPanel = lazy(async () => {
  const module = await import('../messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

export type PlayerTab = 'schedule' | 'profile' | 'billing' | 'messages' | 'feed'

const PLAYER_TABS = [
  { label: 'Schedule', value: 'schedule' as PlayerTab },
  { label: 'Feed', value: 'feed' as PlayerTab },
  { label: 'My profile', value: 'profile' as PlayerTab },
  { label: 'Billing', value: 'billing' as PlayerTab },
  { label: 'Messages', value: 'messages' as PlayerTab },
] as const

interface PlayerPortalProps {
  profile: UserProfile
  activeTab: PlayerTab
  onTabChange: (tab: PlayerTab) => void
}

export function PlayerPortal({ profile, activeTab, onTabChange }: PlayerPortalProps) {
  const linkedId = profile.linkedPlayerId ?? ''
  const childIds = useMemo(() => (linkedId ? [linkedId] : []), [linkedId])

  const { attendance, error, events, isConfigured, isSubmitting, loadingAttendance, loadingEvents, loadingPlayers, players, resultByEventId, teams, updateAttendance } =
    useParentClubData(childIds)

  const selfPlayer = players[0] ?? null
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])

  const attendanceByEvent = useMemo(
    () =>
      new Map(
        linkedId ? attendance.filter((entry) => entry.playerId === linkedId).map((entry) => [entry.eventId, entry]) : [],
      ),
    [linkedId, attendance],
  )

  const myEvents = useMemo(() => {
    if (!selfPlayer) return []
    return events
      .filter((event) => selfPlayer.teams.includes(event.teamId))
      .sort((left, right) => left.dateTime.localeCompare(right.dateTime))
  }, [selfPlayer, events])

  const upcomingEvents = useMemo(() => {
    const cutoff = new Date()
    return myEvents.filter((event) => new Date(event.dateTime) >= cutoff)
  }, [myEvents])

  const pastEvents = useMemo(() => {
    const cutoff = new Date()
    return myEvents.filter((event) => new Date(event.dateTime) < cutoff).reverse()
  }, [myEvents])

  const attendanceCounts = useMemo(() => {
    if (!linkedId) return null
    const records = attendance.filter((entry) => entry.playerId === linkedId)
    return {
      yes: records.filter((entry) => entry.status === 'yes').length,
      pending: records.filter((entry) => entry.status === 'pending').length,
      no: records.filter((entry) => entry.status === 'no').length,
    }
  }, [linkedId, attendance])

  async function handleAttendanceResponse(attendanceId: string, status: AttendanceStatus) {
    try {
      await updateAttendance(attendanceId, status)
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  const isPendingApproval = selfPlayer?.status === 'pending'

  return (
    <section className="space-y-5">
      <div className="hidden sm:block">
        <TabNav tabs={PLAYER_TABS} active={activeTab} onChange={onTabChange} />
      </div>

      {!isConfigured ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured. Add your project values to .env.local before using the player portal.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {!linkedId ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Finish setting up your player profile</p>
          <p className="mt-1 text-slate-600">
            If you just confirmed your email, sign out and sign back in so we can link your player record. Contact the club if this message
            persists.
          </p>
        </div>
      ) : null}

      {linkedId && isPendingApproval ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Registration pending</p>
          <p className="mt-1 text-amber-900/90">
            The club will assign you to a team soon. You can still update your profile and billing details below.
          </p>
        </div>
      ) : null}

      {activeTab === 'schedule' ? (
        <section className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Your schedule</h2>
                <p className="text-sm text-slate-500">{loadingPlayers ? 'Loading...' : selfPlayer ? 'Linked player' : 'No player row'}</p>
              </div>

              {!linkedId || (!loadingPlayers && !selfPlayer) ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  {!linkedId
                    ? 'Your player record is not linked yet. Sign out and back in after confirming your email.'
                    : 'Could not load your player record. Contact the club admin.'}
                </div>
              ) : null}

              {selfPlayer ? (
                <div className="mt-4 rounded-[1.5rem] bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{selfPlayer.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selfPlayer.teams.length > 0 ? (
                      selfPlayer.teams.map((teamId) => (
                        <span key={teamId} className="rounded-full bg-[#1565ff] px-3 py-1 text-xs font-semibold text-white">
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
              {attendanceCounts && selfPlayer ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-[#1565ff] p-4 text-white">
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
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  {selfPlayer ? 'No attendance data yet.' : 'Link your player record to see attendance.'}
                </div>
              )}
            </article>
          </div>

          <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Your events</h2>
              <p className="text-sm text-slate-500">
                {loadingEvents || loadingAttendance ? 'Loading...' : `${myEvents.length} total`}
              </p>
            </div>

            {!selfPlayer && !loadingPlayers ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                Your schedule will appear here once your player record is linked and assigned to a team.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Upcoming</h3>
                  <EventList
                    eventsToShow={upcomingEvents}
                    emptyLabel={selfPlayer ? 'No upcoming events.' : 'No events yet.'}
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

      {activeTab === 'profile' ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">My profile</h2>
            <p className="mt-1 text-sm text-slate-500">Update your playing profile, emergency contacts, and documents.</p>
          </div>

          {!linkedId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Your player profile is not linked yet. Sign out and sign back in after email confirmation.
            </div>
          ) : loadingPlayers ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : !selfPlayer ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Could not load your player record. Contact the club admin.
            </div>
          ) : (
            <PlayerProfileCard playerId={linkedId} role="player" currentUserId={profile.id} headingOverride={selfPlayer.name} />
          )}
        </section>
      ) : null}

      {activeTab === 'billing' ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Billing</h2>
            <p className="mt-1 text-sm text-slate-500">Subscriptions and fees for your player account.</p>
          </div>
          <FamilyBillingCard profile={profile} players={players} />
        </section>
      ) : null}

      {activeTab === 'feed' ? (
        <PostFeed profile={profile} teamIds={teams.map((t) => t.id)} />
      ) : null}

      {activeTab === 'messages' ? (
        <Suspense fallback={<div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">Loading messages…</div>}>
          <TeamMessagesPanel profile={profile} />
        </Suspense>
      ) : null}
    </section>
  )
}
