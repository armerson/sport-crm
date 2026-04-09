import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.ts'
import { useParentClubData } from '../../hooks/useParentClubData.ts'
import { registerChildrenForCurrentUser } from '../../services/parentSelfRegister.ts'
import { fetchPublicClubPlayerFields } from '../../services/clubPlayerFields.ts'
import { ClubPlayerFieldEditor } from '../shared/ClubPlayerFieldEditor.tsx'
import type { ClubPlayerField } from '../../types/clubPlayerFields.ts'
import { FamilyBillingCard } from './FamilyBillingCard.tsx'
import { PostFeed } from '../posts/PostFeed.tsx'
import { PlayerProfileCard } from '../players/PlayerProfileCard.tsx'
import { ReviewCard } from '../reviews/ReviewCard.tsx'
import { LocationMapCard } from '../ui/LocationPicker.tsx'
import { MotmVotingCard } from '../shared/MotmVotingCard.tsx'
import { EventComments } from '../events/EventComments.tsx'
import { fetchPublishedReviewsForPlayer, type PlayerReview } from '../../services/playerReviews.ts'
import type { UserProfile } from '../../types/auth.ts'
import type { AttendanceStatus } from '../../types/club.ts'
import { formatDateTimeRelative, dateBox, shortenAddress, groupByWeek } from '../../utils/date.ts'
import { EventTypeChip } from '../ui/EventTypeChip.tsx'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TabNav } from '../ui/TabNav.tsx'
import { TextField } from '../ui/TextField.tsx'

const TeamMessagesPanel = lazy(async () => {
  const module = await import('../messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

interface ParentPortalProps {
  profile: UserProfile
  activeTab: ParentTab
  onTabChange: (tab: ParentTab) => void
}

export type ParentTab = 'schedule' | 'messages' | 'billing' | 'children' | 'feed' | 'development'

const PARENT_TABS = [
  { label: 'Schedule', value: 'schedule' as ParentTab },
  { label: 'Development', value: 'development' as ParentTab },
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

/** Add a child as pending registration (linked to the signed-in parent/admin account). */
function RegisterChildForm({ className = '' }: { className?: string }) {
  const { refreshProfile } = useAuth()
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [fields, setFields] = useState<ClubPlayerField[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void fetchPublicClubPlayerFields()
      .then(setFields)
      .catch(() => setFields([]))
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSuccess(false)
    for (const f of fields) {
      if (!f.required) continue
      const v = custom[f.id] ?? ''
      if (f.fieldType === 'checkbox' && v !== 'true') {
        setFormError(`Required: ${f.label}`)
        return
      }
      if (f.fieldType !== 'checkbox' && !String(v).trim()) {
        setFormError(`Required: ${f.label}`)
        return
      }
    }
    setSubmitting(true)
    try {
      await registerChildrenForCurrentUser([
        { name, dob, custom: Object.keys(custom).length ? custom : undefined },
      ])
      await refreshProfile()
      setName('')
      setDob('')
      setCustom({})
      setSuccess(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not register child.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={className}>
      <form className="mt-4 space-y-4 text-left" onSubmit={handleSubmit}>
        <TextField label="Child's full name" onChange={(e) => setName(e.target.value)} placeholder="Alex Smith" value={name} />
        <TextField label="Date of birth" onChange={(e) => setDob(e.target.value)} type="date" value={dob} />
        {fields.length > 0 ? (
          <ClubPlayerFieldEditor fields={fields} values={custom} onChange={(id, v) => setCustom((c) => ({ ...c, [id]: v }))} />
        ) : null}
        {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
        {success ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Child added. They stay <strong>pending</strong> until a club admin assigns them to a team (Admin → Overview → pending registrations, or Manage → Add player).
          </p>
        ) : null}
        <Button className="w-full sm:w-auto" loading={submitting} type="submit">
          Register child
        </Button>
      </form>
      <p className="mt-3 text-xs text-slate-400">
        Same flow as signing up with children — you can also use the club’s public registration link if they sent one.
      </p>
    </div>
  )
}

// ── Compact collapsible parent event card ────────────────────────
function ParentEventCard({
  event,
  team,
  attendanceRecord,
  isSubmitting,
  onAttendanceResponse,
  result,
  currentUserId,
}: {
  event: import('../../types/club.ts').EventRecord
  team: import('../../types/club.ts').TeamRecord | undefined
  attendanceRecord: import('../../types/club.ts').AttendanceRecord | undefined
  isSubmitting: boolean
  onAttendanceResponse: (attendanceId: string, status: AttendanceStatus) => void
  result: import('../../types/club.ts').ResultRecord | undefined
  currentUserId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const isPast = new Date(event.dateTime) < new Date()
  const box = dateBox(event.dateTime)
  const shortAddr = shortenAddress(event.location)
  const hasDetails = !!(event.location || currentUserId)

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* ── Compact always-visible row ── */}
      <div className="flex min-w-0 items-start gap-3 px-4 py-3">
        {/* Date box */}
        <div className={`flex w-10 shrink-0 flex-col items-center rounded-xl py-1.5 ${isPast ? 'bg-slate-100' : 'bg-[#123524]/8'}`}>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isPast ? 'text-slate-400' : 'text-[#123524]/70'}`}>{box.month}</span>
          <span className={`text-lg font-bold leading-tight ${isPast ? 'text-slate-500' : 'text-[#123524]'}`}>{box.day}</span>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-slate-900">{event.title}</p>
                <EventTypeChip type={event.type} />
                {result ? (
                  <span className="rounded-full bg-[#123524] px-2 py-0.5 text-xs font-bold tabular-nums text-white">
                    {result.homeScore}–{result.awayScore}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{formatDateTimeRelative(event.dateTime)}</p>
              {team ? <p className="text-xs text-slate-400">{team.name}{team.ageGroup ? ` · ${team.ageGroup}` : ''}</p> : null}
              {shortAddr ? <p className="truncate text-xs text-slate-400">{shortAddr}</p> : null}
            </div>

            {/* Past status badge */}
            {isPast && attendanceRecord && (
              <span className={`shrink-0 self-start rounded-full px-2.5 py-0.5 text-xs font-bold ${
                attendanceRecord.status === 'yes' ? 'bg-emerald-100 text-emerald-700' :
                attendanceRecord.status === 'no' ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                {attendanceRecord.status === 'yes' ? 'Attended' : attendanceRecord.status === 'no' ? 'Missed' : '–'}
              </span>
            )}
          </div>

          {/* Upcoming attendance buttons */}
          {!isPast && attendanceRecord && (
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onAttendanceResponse(attendanceRecord.id, attendanceRecord.status === 'yes' ? 'pending' : 'yes')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${
                  attendanceRecord.status === 'yes'
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                ✓ Going
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onAttendanceResponse(attendanceRecord.id, attendanceRecord.status === 'no' ? 'pending' : 'no')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${
                  attendanceRecord.status === 'no'
                    ? 'bg-rose-500 text-white shadow-sm shadow-rose-200'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-rose-300 hover:text-rose-500'
                }`}
              >
                ✕ Can't go
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Expand toggle ── */}
      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
        >
          {expanded ? 'Less' : 'Map & comments'}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          {event.type === 'match' && event.opponent ? (
            <p className="text-sm text-slate-600">vs <span className="font-semibold">{event.opponent}</span></p>
          ) : null}
          {event.location && (
            <LocationMapCard location={event.location} placeId={event.placeId} lat={event.lat} lng={event.lng} />
          )}
          {isPast && event.type === 'match' && currentUserId ? (
            <MotmVotingCard eventId={event.id} isPastMatch={isPast} teamId={event.teamId} currentUserId={currentUserId} />
          ) : null}
          {currentUserId ? (
            <EventComments eventId={event.id} currentUserId={currentUserId} />
          ) : null}
        </div>
      )}
    </article>
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

  const grouped = groupByWeek(eventsToShow, true)

  return (
    <div className="space-y-5">
      {grouped.map(({ bucket, label, items }) => (
        <div key={bucket}>
          <p className={`mb-2 text-[11px] font-bold uppercase tracking-widest ${
            bucket === 'past' ? 'text-slate-400' : bucket === 'today' ? 'text-[#123524]' : 'text-slate-500'
          }`}>{label}</p>
          <div className="space-y-2">
            {items.map((event) => {
              const isPast = new Date(event.dateTime) < new Date()
              return (
                <ParentEventCard
                  key={event.id}
                  event={event}
                  team={teamById.get(event.teamId)}
                  attendanceRecord={attendanceByEvent.get(event.id)}
                  isSubmitting={isSubmitting}
                  onAttendanceResponse={onAttendanceResponse}
                  result={isPast && event.type === 'match' ? resultByEventId.get(event.id) : undefined}
                  currentUserId={currentUserId}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function DevelopmentTab({ players, loadingPlayers }: { players: import('../../types/club.ts').PlayerRecord[]; loadingPlayers: boolean }) {
  const [reviewsByPlayer, setReviewsByPlayer] = useState<Record<string, PlayerReview[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!players.length) { setLoading(false); return }
    Promise.all(
      players.map((p) => fetchPublishedReviewsForPlayer(p.id).then((r) => [p.id, r] as const)),
    ).then((entries) => {
      setReviewsByPlayer(Object.fromEntries(entries))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [players])

  const hasAnyReview = Object.values(reviewsByPlayer).some((r) => r.length > 0)

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Development</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review reports written by your child's coach — published at mid-season and end of season.
        </p>
      </div>

      {loadingPlayers || loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : !hasAnyReview ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center">
          <svg className="mx-auto mb-3 text-slate-300" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          <p className="text-sm font-medium text-slate-500">No reports yet</p>
          <p className="mt-1 text-xs text-slate-400">Your coach will publish a review after mid-season or end of season.</p>
        </div>
      ) : (
        players.map((child) => {
          const reviews = reviewsByPlayer[child.id] ?? []
          if (!reviews.length) return null
          return (
            <div key={child.id} className="space-y-3">
              {players.length > 1 && (
                <h3 className="text-base font-bold text-slate-800">{child.name}</h3>
              )}
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} mode="parent" />
              ))}
            </div>
          )
        })
      )}
    </section>
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
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600">
                  <p>No children linked yet. Add your child below, or ask the club to link you to an existing player.</p>
                  <RegisterChildForm className="mx-auto max-w-md" />
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
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
              <p className="text-center">No children linked yet. Register a child here or ask your club admin to link you.</p>
              <RegisterChildForm className="mx-auto mt-2 max-w-lg" />
            </div>
          ) : (
            <>
              {players.map((child) => (
                <PlayerProfileCard
                  key={child.id}
                  playerId={child.id}
                  role="parent"
                  currentUserId={profile.id}
                />
              ))}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                <h3 className="text-sm font-semibold text-slate-900">Add another child</h3>
                <p className="mt-1 text-xs text-slate-500">Creates a pending registration linked to your account.</p>
                <RegisterChildForm className="mt-2" />
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* DEVELOPMENT TAB */}
      {activeTab === 'development' ? (
        <DevelopmentTab players={players} loadingPlayers={loadingPlayers} />
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
