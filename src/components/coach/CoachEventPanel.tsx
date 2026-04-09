import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useAttendanceStats } from '../../hooks/useAttendanceStats.ts'
import { useCoachClubData } from '../../hooks/useCoachClubData.ts'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import { MotmVotingCard } from '../shared/MotmVotingCard.tsx'
import { EventComments } from '../events/EventComments.tsx'
import { PlayerProfileCard } from '../players/PlayerProfileCard.tsx'
import { PlayerReviewsPanel } from '../reviews/PlayerReviewsPanel.tsx'
import { InviteButton } from '../shared/InviteButton.tsx'
import { LocationPicker, LocationMapCard } from '../ui/LocationPicker.tsx'
import { formatDate, formatDateTimeRelative, dateBox, shortenAddress, groupByWeek } from '../../utils/date.ts'
import { EventTypeChip } from '../ui/EventTypeChip.tsx'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { SuccessMessage } from '../ui/SuccessMessage.tsx'
import { TabNav } from '../ui/TabNav.tsx'
import { TextField } from '../ui/TextField.tsx'
import type { EventType, RecurrencePattern } from '../../types/club.ts'

import { PostFeed } from '../posts/PostFeed.tsx'
import { MatchStatsPanel } from './MatchStatsPanel.tsx'
import { fetchSeasonStats } from '../../services/playerMatchStats.ts'

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
  opponent: string
  recurring: boolean
  recurrencePattern: RecurrencePattern
  recurrenceWeeks: number
}

export type CoachTab = 'schedule' | 'create' | 'stats' | 'squad' | 'messages' | 'feed'

const COACH_TABS = [
  { label: 'Schedule', value: 'schedule' as CoachTab },
  { label: 'Create event', value: 'create' as CoachTab },
  { label: 'Squad', value: 'squad' as CoachTab },
  { label: 'Stats', value: 'stats' as CoachTab },
  { label: 'Feed', value: 'feed' as CoachTab },
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

// ── Coach event card with overflow menu ──────────────────────────
function CoachEventCard({
  event,
  active,
  counts,
  onSelect,
  onEdit,
  onDelete,
  onDeleteSeries,
}: {
  event: import('../../types/club.ts').EventRecord
  active: boolean
  counts?: { yes: number; pending: number; no: number }
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onDeleteSeries?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmSeries, setConfirmSeries] = useState(false)
  const box = dateBox(event.dateTime)
  const isPast = new Date(event.dateTime) < new Date()
  const shortAddr = shortenAddress(event.location)
  const hasCounts = counts && (counts.yes + counts.pending + counts.no) > 0

  return (
    <div
      className={`relative rounded-2xl border transition ${
        active
          ? 'border-[#123524] bg-[#123524] text-white'
          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
      }`}
    >
      {/* Main clickable row */}
      <button className="w-full px-4 py-3 text-left" onClick={onSelect} type="button">
        <div className="flex min-w-0 items-start gap-3">
          {/* Date box */}
          <div className={`flex w-10 shrink-0 flex-col items-center rounded-xl py-1.5 ${active ? 'bg-white/15' : isPast ? 'bg-slate-100' : 'bg-[#123524]/8'}`}>
            <span className={`text-[9px] font-bold uppercase tracking-widest ${active ? 'text-white/70' : isPast ? 'text-slate-400' : 'text-[#123524]/70'}`}>{box.month}</span>
            <span className={`text-lg font-bold leading-tight ${active ? 'text-white' : isPast ? 'text-slate-500' : 'text-[#123524]'}`}>{box.day}</span>
          </div>
          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5 pr-6">
              <p className="truncate text-sm font-semibold leading-snug">{event.title}</p>
              {event.recurrenceGroupId ? <RecurringBadge /> : null}
            </div>
            <p className={`text-xs ${active ? 'text-white/70' : 'text-slate-500'}`}>
              {formatDateTimeRelative(event.dateTime)}
            </p>
            {shortAddr ? (
              <p className={`truncate text-xs ${active ? 'text-white/60' : 'text-slate-400'}`}>{shortAddr}</p>
            ) : null}
            {/* Availability counts */}
            {hasCounts && (
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className={`flex items-center gap-1 text-xs font-semibold ${active ? 'text-emerald-300' : 'text-emerald-600'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {counts!.yes}
                </span>
                {counts!.pending > 0 && (
                  <span className={`flex items-center gap-1 text-xs font-semibold ${active ? 'text-amber-300' : 'text-amber-600'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {counts!.pending}
                  </span>
                )}
                <span className={`flex items-center gap-1 text-xs font-semibold ${active ? 'text-red-300' : 'text-red-500'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  {counts!.no}
                </span>
                <EventTypeChip type={event.type} onDark={active} />
              </div>
            )}
            {!hasCounts && (
              <div className="mt-1"><EventTypeChip type={event.type} onDark={active} /></div>
            )}
          </div>
        </div>
      </button>

      {/* ··· overflow menu trigger */}
      <button
        type="button"
        aria-label="Event options"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); setConfirmDelete(false); setConfirmSeries(false) }}
        className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition ${
          active ? 'text-white/60 hover:bg-white/15 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className={`absolute right-2 top-9 z-20 min-w-[160px] rounded-2xl border py-1 shadow-xl ${active ? 'border-white/20 bg-[#1a4a33]' : 'border-slate-100 bg-white'}`}>
          <button
            type="button"
            onClick={() => { onEdit(); setMenuOpen(false) }}
            className={`flex w-full items-center gap-2 px-4 py-2 text-sm font-medium ${active ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          {onDeleteSeries && !confirmSeries && (
            <button
              type="button"
              onClick={() => setConfirmSeries(true)}
              className={`flex w-full items-center gap-2 px-4 py-2 text-sm font-medium ${active ? 'text-amber-300 hover:bg-white/10' : 'text-amber-600 hover:bg-amber-50'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              Cancel series
            </button>
          )}
          {confirmSeries && (
            <div className="px-3 py-2 space-y-1">
              <p className={`text-xs ${active ? 'text-white/70' : 'text-slate-500'}`}>Cancel all future sessions?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { onDeleteSeries!(); setMenuOpen(false) }} className="flex-1 rounded-lg bg-amber-500 py-1 text-xs font-bold text-white">Yes</button>
                <button type="button" onClick={() => setConfirmSeries(false)} className={`flex-1 rounded-lg py-1 text-xs font-semibold ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>No</button>
              </div>
            </div>
          )}
          {!confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`flex w-full items-center gap-2 px-4 py-2 text-sm font-medium ${active ? 'text-red-300 hover:bg-white/10' : 'text-red-500 hover:bg-red-50'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete
            </button>
          )}
          {confirmDelete && (
            <div className="px-3 py-2 space-y-1">
              <p className={`text-xs ${active ? 'text-white/70' : 'text-slate-500'}`}>Delete this event?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { onDelete(); setMenuOpen(false) }} className="flex-1 rounded-lg bg-red-500 py-1 text-xs font-bold text-white">Delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={`flex-1 rounded-lg py-1 text-xs font-semibold ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dismiss menu on outside click */}
      {menuOpen && (
        <button
          type="button"
          aria-hidden
          className="fixed inset-0 z-10"
          onClick={() => setMenuOpen(false)}
          tabIndex={-1}
        />
      )}
    </div>
  )
}

/** Tiny side-effect component that fetches season match stats when the Stats tab opens. */
function StatsFetcher({ teamId, onData }: { teamId: string; onData: (s: import('../../types/club.ts').PlayerMatchStat[]) => void }) {
  useEffect(() => {
    fetchSeasonStats(teamId).then(onData).catch(() => undefined)
  }, [teamId, onData])
  return null
}

export function CoachEventPanel({ coachId, profile, activeTab, onTabChange }: CoachEventPanelProps) {
  const setActiveTab = (tab: CoachTab) => {
    if (tab !== 'create') setCreateTeamId('')
    onTabChange(tab)
  }
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [squadViewPlayerId, setSquadViewPlayerId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [createTeamId, setCreateTeamId] = useState('')
  const [editValues, setEditValues] = useState<Pick<EventFormState, 'title' | 'type' | 'dateTime' | 'location' | 'opponent'>>({
    title: '',
    type: 'training',
    dateTime: '',
    location: '',
    opponent: '',
  })
  const [eventValues, setEventValues] = useState<EventFormState>({
    title: '',
    type: 'training',
    dateTime: '',
    location: '',
    opponent: '',
    recurring: false,
    recurrencePattern: 'weekly',
    recurrenceWeeks: 6,
  })
  const [eventLocationMeta, setEventLocationMeta] = useState<{ placeId?: string; lat?: number; lng?: number }>({})
  const [editLocationMeta, setEditLocationMeta] = useState<{ placeId?: string; lat?: number; lng?: number }>({})
  const [resultValues, setResultValues] = useState({ homeScore: '', awayScore: '', notes: '' })
  const [resultError, setResultError] = useState<string | null>(null)
  const [showResultForm, setShowResultForm] = useState(false)
  const [seasonMatchStats, setSeasonMatchStats] = useState<import('../../types/club.ts').PlayerMatchStat[]>([])
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderMsg, setReminderMsg] = useState<string | null>(null)

  const {
    activeEventId,
    activeTeamId,
    attendance,
    createEvent,
    updateAttendance,
    updateEvent,
    deleteEvent,
    deleteEventSeries,
    error,
    events,
    isConfigured,
    isSubmitting,
    lineup,
    loadingAttendance,
    loadingEvents,
    loadingLineup,
    loadingTeams,
    resultByEventId,
    attendanceCounts,
    saveResult,
    sendAttendanceReminder,
    teams,
    toggleLineup,
  } = useCoachClubData(coachId, selectedTeamId, selectedEventId)

  const { players, loading: loadingPlayers } = useTeamPlayers(activeTeamId)
  const { stats, loading: loadingStats } = useAttendanceStats(activeTeamId)
  const selectedTeam = teams.find((team) => team.id === activeTeamId) ?? null
  const activeEvent = events.find((e) => e.id === activeEventId) ?? null
  const isPastMatch = activeEvent?.type === 'match' && new Date(activeEvent.dateTime) < new Date()
  const existingResult = isPastMatch ? resultByEventId.get(activeEventId) : undefined
  const isSingleTeamCoach = teams.length === 1

  const activeEventCounts = useMemo(
    () => ({
      yes: attendance.filter((entry) => entry.status === 'yes').length,
      no: attendance.filter((entry) => entry.status === 'no').length,
      pending: attendance.filter((entry) => entry.status === 'pending').length,
    }),
    [attendance],
  )

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])

  const lineupByPlayerId = useMemo(() => new Map(lineup.map((e) => [e.playerId, e])), [lineup])
  const playersInLineup = useMemo(
    () =>
      players
        .filter((p) => lineupByPlayerId.has(p.id))
        .map((p) => ({ player: p, entry: lineupByPlayerId.get(p.id)! }))
        .sort((a, b) => (b.entry.isStarting ? 1 : 0) - (a.entry.isStarting ? 1 : 0)),
    [players, lineupByPlayerId],
  )
  const playersNotInLineup = useMemo(
    () => players.filter((p) => !lineupByPlayerId.has(p.id)),
    [players, lineupByPlayerId],
  )

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
          placeId: eventLocationMeta.placeId,
          lat: eventLocationMeta.lat,
          lng: eventLocationMeta.lng,
          opponent: eventValues.opponent,
        },
        players.map((player) => player.id),
        recurrence,
      )

      setEventValues({ title: '', type: 'training', dateTime: '', location: '', recurring: false, recurrencePattern: 'weekly', recurrenceWeeks: 6, opponent: '' })
      setEventLocationMeta({})
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
    setEditValues({ title: event.title, type: event.type, dateTime: localDt, location: event.location, opponent: event.opponent ?? '' })
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
        placeId: editLocationMeta.placeId,
        lat: editLocationMeta.lat,
        lng: editLocationMeta.lng,
        opponent: editValues.opponent,
      })
      setSuccessMessage('Event updated.')
      setEditingEventId(null)
      setEditLocationMeta({})
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
    setResultError(null)
  }, [activeEventId])

  async function handleSaveResult(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResultError(null)
    const home = parseInt(resultValues.homeScore, 10)
    const away = parseInt(resultValues.awayScore, 10)
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setResultError('Please enter valid scores (numbers ≥ 0).')
      return
    }
    try {
      await saveResult(activeEventId, {
        homeScore: home,
        awayScore: away,
        notes: resultValues.notes.trim(),
      })
      setShowResultForm(false)
      setResultError(null)
      setSuccessMessage('Result saved.')
    } catch (err) {
      setResultError(err instanceof Error ? err.message : 'Unable to save result. Please try again.')
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

          <div className="grid min-w-0 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            {/* On mobile: event list is hidden when an event is selected (replaced by attendance panel) */}
            <article className={`min-w-0 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-lg shadow-slate-900/5 backdrop-blur-sm ${activeEventId ? 'hidden xl:block' : ''}`}>
              {/* Team photo header */}
              {(() => {
                const displayTeam = selectedTeam ?? (isSingleTeamCoach ? teams[0] : null)
                if (!displayTeam?.photoUrl) return null
                return (
                  <div className="relative h-32 w-full overflow-hidden sm:h-40">
                    <img src={displayTeam.photoUrl} alt={displayTeam.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-base font-bold text-white drop-shadow">{displayTeam.name}</p>
                        <p className="text-xs text-white/75">{displayTeam.ageGroup} · {displayTeam.playerCount} players</p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  {(() => {
                    const displayTeam = selectedTeam ?? (isSingleTeamCoach ? teams[0] : null)
                    if (displayTeam?.photoUrl) return null
                    return (
                      <>
                        <h2 className="text-xl font-semibold text-slate-950">
                          {displayTeam?.name ?? 'Events'}
                        </h2>
                        {displayTeam ? (
                          <p className="mt-1 text-sm text-slate-500">{displayTeam.ageGroup} · {displayTeam.playerCount} players</p>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-500">{loadingEvents ? 'Loading...' : `${events.length} events`}</p>
                  {(activeTeamId || isSingleTeamCoach) ? (
                    <button
                      type="button"
                      onClick={() => { setCreateTeamId(activeTeamId || teams[0]?.id || ''); setActiveTab('create') }}
                      title="Create event"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#123524] text-white shadow-sm transition hover:bg-[#1a4a33] active:scale-95"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-5">
                {events.length > 0 ? (
                  groupByWeek(events, true).map(({ bucket, label, items: bucketEvents }) => (
                    <div key={bucket}>
                      <p className={`mb-2 text-[11px] font-bold uppercase tracking-widest ${bucket === 'past' ? 'text-slate-400' : bucket === 'today' ? 'text-[#123524]' : 'text-slate-500'}`}>
                        {label}
                      </p>
                      <div className="space-y-2">
                        {bucketEvents.map((clubEvent) => (
                          <CoachEventCard
                            key={clubEvent.id}
                            event={clubEvent}
                            active={activeEventId === clubEvent.id}
                            counts={attendanceCounts.get(clubEvent.id)}
                            onSelect={() => setSelectedEventId(clubEvent.id)}
                            onEdit={() => startEditingEvent(clubEvent.id)}
                            onDelete={() => { void handleDeleteEvent(clubEvent.id) }}
                            onDeleteSeries={clubEvent.recurrenceGroupId
                              ? () => { void handleDeleteSeries(clubEvent.recurrenceGroupId!, clubEvent.dateTime, clubEvent.id) }
                              : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                    <p className="text-2xl">📅</p>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      {activeTeamId || isSingleTeamCoach ? 'No events yet for this team.' : 'Select a team to see its schedule.'}
                    </p>
                    {activeTeamId || isSingleTeamCoach ? (
                      <button
                        className="mt-3 text-sm font-semibold text-[#123524] underline underline-offset-2"
                        onClick={() => setActiveTab('create')}
                        type="button"
                      >
                        Create the first event →
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
              </div>{/* end p-5 */}
            </article>

            <article className="min-w-0 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
              {/* Mobile back button — shown only when an event is selected */}
              {activeEventId && (
                <button
                  type="button"
                  onClick={() => setSelectedEventId('')}
                  className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[#123524] xl:hidden"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back to events
                </button>
              )}

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
                    {editValues.type === 'match' && (
                      <TextField
                        label="Opponent"
                        onChange={(e) => setEditValues((c) => ({ ...c, opponent: e.target.value }))}
                        placeholder="e.g. Riverside FC"
                        value={editValues.opponent}
                      />
                    )}
                    <TextField
                      label="Date and time"
                      onChange={(e) => setEditValues((c) => ({ ...c, dateTime: e.target.value }))}
                      type="datetime-local"
                      value={editValues.dateTime}
                    />
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Location</label>
                      <LocationPicker
                        value={editValues.location}
                        onChange={({ address, placeId, lat, lng }) => {
                          setEditValues((c) => ({ ...c, location: address }))
                          setEditLocationMeta({ placeId: placeId ?? undefined, lat: lat ?? undefined, lng: lng ?? undefined })
                        }}
                        placeholder="Search pitch, ground, or address…"
                      />
                    </div>
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

              {/* Location map for active event */}
              {activeEvent?.location && (
                <div className="mt-3">
                  <LocationMapCard location={activeEvent.location} placeId={activeEvent.placeId} lat={activeEvent.lat} lng={activeEvent.lng} />
                </div>
              )}

              {activeEventId ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-[#123524] p-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Going</p>
                      <p className="mt-2 text-3xl font-semibold">{activeEventCounts.yes}</p>
                    </div>
                    <div className="rounded-3xl bg-[#f18a3f] p-4 text-slate-950">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900/70">Pending</p>
                      <p className="mt-2 text-3xl font-semibold">{activeEventCounts.pending}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-950 p-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Not going</p>
                      <p className="mt-2 text-3xl font-semibold">{activeEventCounts.no}</p>
                    </div>
                  </div>

                  {/* Attendance reminder */}
                  {activeEventCounts.pending > 0 && activeEvent && (
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={sendingReminder}
                        onClick={() => {
                          setSendingReminder(true)
                          setReminderMsg(null)
                          void sendAttendanceReminder(activeEventId, activeEvent.title).then((count) => {
                            setReminderMsg(
                              count > 0
                                ? `Reminder sent to ${count} parent${count === 1 ? '' : 's'}.`
                                : 'No parents with push notifications enabled.'
                            )
                          }).finally(() => setSendingReminder(false))
                        }}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                      >
                        {sendingReminder ? 'Sending…' : `Remind ${activeEventCounts.pending} pending`}
                      </button>
                      {reminderMsg && (
                        <p className="text-xs font-medium text-slate-500">{reminderMsg}</p>
                      )}
                    </div>
                  )}

                  {attendance.length > 0 && !loadingAttendance && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
                        onClick={() => {
                          attendance.forEach((a) => { if (a.status !== 'yes') void updateAttendance(a.id, 'yes') })
                        }}
                      >
                        ✓ Mark all present
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                        onClick={() => {
                          attendance.forEach((a) => { if (a.status !== 'pending') void updateAttendance(a.id, 'pending') })
                        }}
                      >
                        Reset all
                      </button>
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
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
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Present"
                                onClick={() => void updateAttendance(entry.id, entry.status === 'yes' ? 'pending' : 'yes')}
                                className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition active:scale-95 ${
                                  entry.status === 'yes'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'bg-slate-200 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'
                                }`}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                title="Absent"
                                onClick={() => void updateAttendance(entry.id, entry.status === 'no' ? 'pending' : 'no')}
                                className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition active:scale-95 ${
                                  entry.status === 'no'
                                    ? 'bg-rose-500 text-white shadow-sm'
                                    : 'bg-slate-200 text-slate-400 hover:bg-rose-100 hover:text-rose-500'
                                }`}
                              >
                                ✕
                              </button>
                            </div>
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
                    <form className="space-y-3" onSubmit={(e) => void handleSaveResult(e)}>
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          label={selectedTeam?.name ?? 'Us'}
                          min="0"
                          onChange={(e) => setResultValues((c) => ({ ...c, homeScore: e.target.value }))}
                          type="number"
                          value={resultValues.homeScore}
                        />
                        <TextField
                          label={activeEvent?.opponent ?? 'Opponent'}
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
                      {resultError && (
                        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{resultError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button className="flex-1" loading={isSubmitting} type="submit">
                          Save result
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => { setShowResultForm(false); setResultError(null) }}
                          type="button"
                          variant="secondary"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : existingResult ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-xs font-semibold text-slate-500">{selectedTeam?.name ?? 'Us'}</span>
                        <p className="text-3xl font-bold tabular-nums text-slate-950">
                          {existingResult.homeScore}–{existingResult.awayScore}
                        </p>
                        <span className="text-xs font-semibold text-slate-500">{activeEvent?.opponent ?? 'Opponent'}</span>
                      </div>
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

              {/* MOTM voting tally — coach sees read-only view */}
              {activeEventId && isPastMatch ? (
                <MotmVotingCard
                  eventId={activeEventId}
                  isPastMatch={isPastMatch}
                  players={players}
                  currentUserId={profile.id}
                  readOnly
                />
              ) : null}

              {/* Player match stats — enter goals/assists/cards after a match */}
              {activeEventId && isPastMatch && activeTeamId ? (
                <MatchStatsPanel
                  eventId={activeEventId}
                  teamId={activeTeamId}
                  attendingPlayers={attendance
                    .filter((a) => a.status === 'yes')
                    .map((a) => ({ id: a.playerId, name: players.find((p) => p.id === a.playerId)?.name ?? 'Player' }))}
                />
              ) : null}


              {/* Event comments — visible when an event is selected */}
              {activeEventId ? (
                <EventComments eventId={activeEventId} currentUserId={profile.id} isAdmin />
              ) : null}

              {/* Match Squad — shown for any match event when one is selected */}
              {activeEventId && activeEvent?.type === 'match' ? (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Match Squad</h3>
                    <p className="text-xs text-slate-400">
                      {playersInLineup.filter((e) => e.entry.isStarting).length} starting ·{' '}
                      {playersInLineup.filter((e) => !e.entry.isStarting).length} subs
                    </p>
                  </div>

                  {loadingLineup ? (
                    <p className="text-sm text-slate-500">Loading lineup...</p>
                  ) : (
                    <div className="space-y-2">
                      {playersInLineup.map(({ player, entry }) => (
                        <div key={player.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="flex-1 truncate text-sm font-medium text-slate-950">{player.name}</p>
                          {/* Starter / Sub segmented toggle */}
                          <div className="flex overflow-hidden rounded-xl border border-slate-200 text-xs font-semibold">
                            <button
                              className={`px-2.5 py-1 transition ${entry.isStarting ? 'bg-[#123524] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                              onClick={() => void toggleLineup(player.id, true, true)}
                              type="button"
                            >
                              Start
                            </button>
                            <button
                              className={`px-2.5 py-1 transition ${!entry.isStarting ? 'bg-[#f18a3f] text-slate-900' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                              onClick={() => void toggleLineup(player.id, true, false)}
                              type="button"
                            >
                              Sub
                            </button>
                          </div>
                          {/* Remove */}
                          <button
                            aria-label="Remove from squad"
                            className="text-lg leading-none text-slate-300 transition hover:text-rose-400"
                            onClick={() => void toggleLineup(player.id, false, false)}
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      {playersNotInLineup.length > 0 ? (
                        <>
                          {playersInLineup.length > 0 ? (
                            <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                              Not selected
                            </p>
                          ) : null}
                          {playersNotInLineup.map((player) => (
                            <div key={player.id} className="flex items-center gap-2 rounded-2xl bg-slate-50/60 px-3 py-2">
                              <p className="flex-1 truncate text-sm text-slate-600">{player.name}</p>
                              <button
                                className="text-xs font-semibold text-[#123524] hover:underline"
                                onClick={() => void toggleLineup(player.id, true, true)}
                                type="button"
                              >
                                + Add
                              </button>
                            </div>
                          ))}
                        </>
                      ) : null}

                      {players.length === 0 ? (
                        <p className="text-sm text-slate-400">No players in this team yet.</p>
                      ) : null}
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
        /* ── Multi-team: show photo picker first ── */
        !isSingleTeamCoach && !createTeamId ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Which team?</h2>
              <p className="mt-1 text-sm text-slate-500">Select the team you want to create an event for.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => { setCreateTeamId(team.id); setSelectedTeamId(team.id) }}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[#123524]/40 hover:shadow-md active:scale-[0.97]"
                >
                  {team.photoUrl ? (
                    <img src={team.photoUrl} alt={team.name} className="h-28 w-full object-cover transition group-hover:opacity-90 sm:h-32" />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-[#123524]/10 to-[#123524]/5 sm:h-32">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#123524" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                      </svg>
                    </div>
                  )}
                  <div className="p-3 text-left">
                    <p className="truncate text-sm font-bold text-slate-900">{team.name}</p>
                    <p className="truncate text-xs text-slate-500">{team.ageGroup}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : (
        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          {!isSingleTeamCoach && (
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCreateTeamId('')}
                className="flex items-center gap-1.5 text-sm font-medium text-[#123524] hover:opacity-70"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Teams
              </button>
              <span className="text-sm text-slate-400">·</span>
              <span className="text-sm font-semibold text-slate-700">{teams.find(t => t.id === createTeamId)?.name}</span>
            </div>
          )}
          <h2 className="text-xl font-semibold text-slate-950">
            {isSingleTeamCoach ? 'Create an event for your squad' : 'New event'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {`${loadingPlayers ? 'Loading' : players.length} players will receive a pending attendance record.`}
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleCreateEvent}>
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
            {eventValues.type === 'match' && (
              <TextField
                label="Opponent"
                onChange={(e) => setEventValues((c) => ({ ...c, opponent: e.target.value }))}
                placeholder="e.g. Riverside FC"
                value={eventValues.opponent}
              />
            )}
            <TextField
              label={eventValues.type === 'training' && eventValues.recurring ? 'First session date and time' : 'Date and time'}
              onChange={(event) => setEventValues((current) => ({ ...current, dateTime: event.target.value }))}
              type="datetime-local"
              value={eventValues.dateTime}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Location</label>
              <LocationPicker
                value={eventValues.location}
                onChange={({ address, placeId, lat, lng }) => {
                  setEventValues((c) => ({ ...c, location: address }))
                  setEventLocationMeta({ placeId: placeId ?? undefined, lat: lat ?? undefined, lng: lng ?? undefined })
                }}
                placeholder="Search pitch, ground, or address…"
              />
            </div>

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
        )
      ) : null}

      {/* STATS TAB — fetch season match stats when tab is active */}
      {activeTab === 'stats' && activeTeamId ? (
        <StatsFetcher teamId={activeTeamId} onData={setSeasonMatchStats} />
      ) : null}

      {activeTab === 'stats' ? (
        <section className="space-y-5">
        {/* Season record */}
        {(() => {
          const now = new Date()
          const pastMatches = events.filter((e) => e.type === 'match' && new Date(e.dateTime) < now)
          const matchesWithResults = pastMatches.filter((e) => resultByEventId.has(e.id))

          let w = 0, d = 0, l = 0, gf = 0, ga = 0
          for (const match of matchesWithResults) {
            const r = resultByEventId.get(match.id)!
            gf += r.homeScore
            ga += r.awayScore
            if (r.homeScore > r.awayScore) w++
            else if (r.homeScore === r.awayScore) d++
            else l++
          }
          const played = matchesWithResults.length
          const pts = w * 3 + d

          // Last 5 results newest-first
          const recentFive = [...matchesWithResults]
            .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
            .slice(0, 5)
            .reverse()

          if (pastMatches.length === 0) return null

          return (
            <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Season record</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {selectedTeam?.name ?? 'Team'} · {played} of {pastMatches.length} match{pastMatches.length === 1 ? '' : 'es'} with results
                  </p>
                </div>
                <span className="rounded-full bg-[#123524]/10 px-3 py-1 text-sm font-bold text-[#123524]">
                  {pts} pts
                </span>
              </div>

              <div className="mt-5 grid grid-cols-5 divide-x divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50 text-center">
                {[
                  { label: 'P', value: played },
                  { label: 'W', value: w },
                  { label: 'D', value: d },
                  { label: 'L', value: l },
                  { label: 'GD', value: gf - ga > 0 ? `+${gf - ga}` : gf - ga },
                ].map(({ label, value }) => (
                  <div key={label} className="py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">Form</p>
                {recentFive.length === 0 ? (
                  <p className="text-xs text-slate-400">No results yet</p>
                ) : (
                  recentFive.map((match) => {
                    const r = resultByEventId.get(match.id)!
                    const outcome = r.homeScore > r.awayScore ? 'W' : r.homeScore === r.awayScore ? 'D' : 'L'
                    const colour = outcome === 'W' ? 'bg-emerald-500 text-white' : outcome === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'
                    return (
                      <span key={match.id} title={`${match.title} — ${r.homeScore}–${r.awayScore}`} className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${colour}`}>
                        {outcome}
                      </span>
                    )
                  })
                )}
              </div>

              {/* Results list */}
              {matchesWithResults.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Match history</p>
                  {[...matchesWithResults]
                    .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
                    .map((match) => {
                      const r = resultByEventId.get(match.id)!
                      const outcome = r.homeScore > r.awayScore ? 'W' : r.homeScore === r.awayScore ? 'D' : 'L'
                      const colour = outcome === 'W' ? 'text-emerald-600' : outcome === 'D' ? 'text-amber-600' : 'text-rose-600'
                      return (
                        <div key={match.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{match.title}</p>
                            <p className="text-xs text-slate-500">{new Date(match.dateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold tabular-nums text-slate-900">{r.homeScore}–{r.awayScore}</span>
                            <span className={`text-sm font-bold ${colour}`}>{outcome}</span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </article>
          )
        })()}

        {/* Top scorers card */}
        {(() => {
          if (seasonMatchStats.length === 0) return null
          // Aggregate per player
          const totals = new Map<string, { goals: number; assists: number; playerId: string }>()
          for (const s of seasonMatchStats) {
            const prev = totals.get(s.playerId) ?? { goals: 0, assists: 0, playerId: s.playerId }
            totals.set(s.playerId, { playerId: s.playerId, goals: prev.goals + s.goals, assists: prev.assists + s.assists })
          }
          const sorted = [...totals.values()]
            .filter((t) => t.goals + t.assists > 0)
            .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
          if (sorted.length === 0) return null
          return (
            <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-slate-950">Top scorers</h2>
              <p className="mt-0.5 text-sm text-slate-500">Season goals &amp; assists</p>
              <div className="mt-4 space-y-2">
                {sorted.map((t, i) => {
                  const playerName = stats.find((s) => s.playerId === t.playerId)?.playerName
                    ?? players.find((p) => p.id === t.playerId)?.name ?? 'Player'
                  return (
                    <div key={t.playerId} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                      <p className="flex-1 truncate font-medium text-slate-900">{playerName}</p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-bold text-slate-900">{t.goals} <span className="font-normal text-slate-400">goals</span></span>
                        <span className="font-bold text-slate-900">{t.assists} <span className="font-normal text-slate-400">ast</span></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })()}

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
        </section>
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

          {activeTeamId ? (
            <InviteButton teamId={activeTeamId} teamName={selectedTeam?.name ?? ''} role="parent" />
          ) : null}

          {!activeTeamId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Select a team to view the squad.
            </div>
          ) : loadingPlayers ? (
            <div className="text-sm text-slate-400">Loading players…</div>
          ) : players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              No players in this team yet. Use the invite link above to bring parents on board.
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
              <PlayerReviewsPanel
                playerId={squadViewPlayerId}
                playerName={players.find((p) => p.id === squadViewPlayerId)?.name ?? ''}
                teamId={activeTeamId}
                coachId={profile.id}
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
      {activeTab === 'feed' ? (
        <PostFeed profile={profile} teamIds={teams.map((t) => t.id)} />
      ) : null}

      {activeTab === 'messages' ? (
        <Suspense fallback={<SectionFallback />}>
          <TeamMessagesPanel profile={profile} />
        </Suspense>
      ) : null}
    </section>
  )
}
