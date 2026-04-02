import { useMemo, useState } from 'react'
import { useParentClubData } from '../../hooks/useParentClubData.ts'
import type { UserProfile } from '../../types/auth.ts'
import type { AttendanceStatus } from '../../types/club.ts'
import { formatDateTime } from '../../utils/date.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'

interface ParentPortalProps {
  profile: UserProfile
}

export function ParentPortal({ profile }: ParentPortalProps) {
  const [selectedChildId, setSelectedChildId] = useState('')
  const { attendance, error, events, isConfigured, isSubmitting, loadingAttendance, loadingEvents, loadingPlayers, players, teams, updateAttendance } =
    useParentClubData(profile.children)

  const activeChildId = selectedChildId || (players.length === 1 ? players[0]?.id ?? '' : '')
  const activeChild = players.find((player) => player.id === activeChildId) ?? null
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const attendanceByEvent = useMemo(
    () => new Map(attendance.filter((entry) => entry.playerId === activeChildId).map((entry) => [entry.eventId, entry])),
    [activeChildId, attendance],
  )

  const childEvents = useMemo(() => {
    if (!activeChild) {
      return []
    }

    return events
      .filter((event) => activeChild.teams.includes(event.teamId))
      .sort((left, right) => left.dateTime.localeCompare(right.dateTime))
  }, [activeChild, events])

  async function handleAttendanceResponse(attendanceId: string, status: AttendanceStatus) {
    try {
      await updateAttendance(attendanceId, status)
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  return (
    <section className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Parent view</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {players.length === 1 ? 'Your child’s schedule' : 'Choose a child'}
              </h2>
            </div>
            <p className="text-sm text-slate-500">{loadingPlayers ? 'Loading children...' : `${players.length} linked ${players.length === 1 ? 'child' : 'children'}`}</p>
          </div>

          {players.length > 1 ? (
            <div className="mt-5">
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

          <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-slate-950">{activeChild ? activeChild.name : 'No child selected'}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {activeChild
                ? `${activeChild.teams.length} ${activeChild.teams.length === 1 ? 'team' : 'teams'} linked to this player.`
                : 'Select a child to review events and attendance.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeChild ? (
                activeChild.teams.map((teamId) => (
                  <span key={teamId} className="rounded-full bg-[#123524] px-3 py-1 text-xs font-semibold text-white">
                    {teamById.get(teamId)?.name ?? 'Team'}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">No team assignment yet.</span>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-500">Attendance snapshot</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Response status</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-[#123524] p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Yes</p>
              <p className="mt-2 text-3xl font-semibold">
                {attendance.filter((entry) => entry.playerId === activeChildId && entry.status === 'yes').length}
              </p>
            </div>
            <div className="rounded-3xl bg-[#f18a3f] p-4 text-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900/70">Pending</p>
              <p className="mt-2 text-3xl font-semibold">
                {attendance.filter((entry) => entry.playerId === activeChildId && entry.status === 'pending').length}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">No</p>
              <p className="mt-2 text-3xl font-semibold">
                {attendance.filter((entry) => entry.playerId === activeChildId && entry.status === 'no').length}
              </p>
            </div>
          </div>
        </article>
      </section>

      {!isConfigured ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured yet. Add your project values to .env.local before using the parent portal.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Upcoming events</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Events for {activeChild?.name ?? 'your child'}</h2>
          </div>
          <p className="text-sm text-slate-500">
            {loadingEvents || loadingAttendance ? 'Loading schedule...' : `${childEvents.length} events available`}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {childEvents.length > 0 ? (
            childEvents.map((event) => {
              const team = teamById.get(event.teamId)
              const attendanceRecord = attendanceByEvent.get(event.id)

              return (
                <article key={event.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-slate-950">{event.title}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                          {event.type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{team?.name ?? 'Team'}{team?.ageGroup ? ` · ${team.ageGroup}` : ''}</p>
                      <p className="text-sm text-slate-600">{formatDateTime(event.dateTime)}</p>
                      <p className="text-sm text-slate-600">{event.location}</p>
                    </div>

                    <div className="min-w-72 space-y-3">
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                        Current response:{' '}
                        <span className="font-semibold capitalize text-slate-950">{attendanceRecord?.status ?? 'pending'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['yes', 'pending', 'no'] as const).map((status) => (
                          <Button
                            key={status}
                            className="px-2"
                            disabled={!attendanceRecord}
                            loading={false}
                            onClick={() => attendanceRecord && void handleAttendanceResponse(attendanceRecord.id, status)}
                            variant={attendanceRecord?.status === status ? 'primary' : 'secondary'}
                          >
                            {isSubmitting && attendanceRecord?.status !== status ? '...' : status}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              {activeChild ? 'No events available yet for this child.' : 'Select a child to review upcoming events.'}
            </div>
          )}
        </div>
      </section>
    </section>
  )
}