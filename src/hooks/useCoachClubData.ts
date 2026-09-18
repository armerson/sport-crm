import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { fetchAttendanceRecipientsByPlayer, fetchTeamParentIds, sendPushToUsers } from '../lib/pushNotifications.ts'
import {
  castMotmVote,
  coachUpdateAttendance,
  computeMotmTally,
  createEventWithAttendance,
  deleteEvent,
  deleteEventSeries,
  removeLineupPlayer,
  recordAttendanceReminders,
  subscribeToAttendanceForEvent,
  subscribeToAttendanceCountsForTeam,
  subscribeToAttendanceRemindersForEvent,
  subscribeToCoachTeams,
  subscribeToEventsForTeam,
  subscribeToEventsForTeams,
  subscribeToLineupForEvent,
  subscribeToMotmVotes,
  subscribeToResultsForTeam,
  syncCometFixtures,
  updateEvent,
  upsertLineupPlayer,
  upsertResult,
  type AttendanceCounts,
} from '../services/coachClub.ts'
import type { AttendanceRecord, AttendanceReminderRecord, EventFormInput, EventRecord, LineupEntry, MotmTally, MotmVote, RecurrenceOptions, ResultFormInput, ResultRecord, TeamRecord } from '../types/club.ts'

function getCoachErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useCoachClubData(coachId: string, selectedTeamId: string, selectedEventId: string) {
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [attendanceReminders, setAttendanceReminders] = useState<AttendanceReminderRecord[]>([])
  const [results, setResults] = useState<ResultRecord[]>([])
  const [attendanceCounts, setAttendanceCounts] = useState<Map<string, AttendanceCounts>>(new Map())
  const [lineup, setLineup] = useState<LineupEntry[]>([])
  const [motmVotes, setMotmVotes] = useState<MotmVote[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingAttendance, setLoadingAttendance] = useState(Boolean(selectedEventId))
  const [loadingLineup, setLoadingLineup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeTeamId = selectedTeamId || (teams.length === 1 ? teams[0]?.id ?? '' : '')
  const activeEventId = events.some((event) => event.id === selectedEventId) ? selectedEventId : ''
  const activeEventType = events.find((e) => e.id === activeEventId)?.type

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingTeams(false)
      setError(supabaseConfigError)
      return undefined
    }

    setError(null)

    const unsubscribe = subscribeToCoachTeams(
      coachId,
      (nextTeams) => {
        setTeams(nextTeams)
        setLoadingTeams(false)
      },
      (message) => {
        setError(message)
        setLoadingTeams(false)
      },
    )

    return unsubscribe
  }, [coachId])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setEvents([])
      setLoadingEvents(false)
      setError(supabaseConfigError)
      return undefined
    }

    setLoadingEvents(true)

    // Single-team coach or explicit team selection → subscribe to one team
    if (activeTeamId) {
      const unsubscribe = subscribeToEventsForTeam(
        activeTeamId,
        (nextEvents) => { setEvents(nextEvents); setLoadingEvents(false) },
        (message) => { setError(message); setLoadingEvents(false) },
      )
      return unsubscribe
    }

    // Multi-team coach with no specific team chosen → show all their teams' events
    if (teams.length > 1) {
      const allIds = teams.map((t) => t.id)
      const unsubscribe = subscribeToEventsForTeams(
        allIds,
        (nextEvents) => { setEvents(nextEvents); setLoadingEvents(false) },
        (message) => { setError(message); setLoadingEvents(false) },
      )
      return unsubscribe
    }

    // No teams yet (still loading)
    setEvents([])
    setLoadingEvents(false)
    return undefined
  }, [activeTeamId, teams])

  // Results + attendance counts stay live for every visible team so a multi-team
  // coach gets useful totals before choosing a squad.
  useEffect(() => {
    if (!isSupabaseConfigured) { setResults([]); setAttendanceCounts(new Map()); return undefined }
    const teamIds = activeTeamId ? [activeTeamId] : teams.map((team) => team.id)
    if (teamIds.length === 0) { setResults([]); setAttendanceCounts(new Map()); return undefined }

    const resultsByTeam = new Map<string, ResultRecord[]>()
    const countsByTeam = new Map<string, Map<string, AttendanceCounts>>()
    const publishResults = () => setResults([...resultsByTeam.values()].flat())
    const publishCounts = () => setAttendanceCounts(new Map([...countsByTeam.values()].flatMap((counts) => [...counts.entries()])))
    const unsubscribers = teamIds.flatMap((teamId) => [
      subscribeToResultsForTeam(teamId, (next) => { resultsByTeam.set(teamId, next); publishResults() }, () => undefined),
      subscribeToAttendanceCountsForTeam(teamId, (next) => { countsByTeam.set(teamId, next); publishCounts() }, () => undefined),
    ])
    return () => { unsubscribers.forEach((unsubscribe) => unsubscribe()) }
  }, [activeTeamId, teams])

  useEffect(() => {
    if (!activeEventId) {
      setAttendance([])
      setLoadingAttendance(false)
      return undefined
    }

    if (!isSupabaseConfigured) {
      setAttendance([])
      setLoadingAttendance(false)
      setError(supabaseConfigError)
      return undefined
    }

    setLoadingAttendance(true)

    const unsubscribe = subscribeToAttendanceForEvent(
      activeEventId,
      (nextAttendance) => {
        setAttendance(nextAttendance)
        setLoadingAttendance(false)
      },
      (message) => {
        setError(message)
        setLoadingAttendance(false)
      },
    )

    return unsubscribe
  }, [activeEventId])

  useEffect(() => {
    if (!activeEventId || !isSupabaseConfigured) {
      setAttendanceReminders([])
      return undefined
    }
    return subscribeToAttendanceRemindersForEvent(
      activeEventId,
      setAttendanceReminders,
      () => undefined,
    )
  }, [activeEventId])

  // Lineup subscription — only for match events
  useEffect(() => {
    if (!activeEventId || activeEventType !== 'match' || !isSupabaseConfigured) {
      setLineup([])
      setLoadingLineup(false)
      return undefined
    }

    setLoadingLineup(true)

    return subscribeToLineupForEvent(
      activeEventId,
      (nextLineup) => {
        setLineup(nextLineup)
        setLoadingLineup(false)
      },
      () => {
        setLoadingLineup(false) // non-critical
      },
    )
  }, [activeEventId, activeEventType])

  // MOTM votes — only for past match events
  const activeEventIsPastMatch =
    activeEventType === 'match' &&
    !!events.find((e) => e.id === activeEventId && new Date(e.dateTime) < new Date())

  useEffect(() => {
    if (!activeEventId || !activeEventIsPastMatch || !isSupabaseConfigured) {
      setMotmVotes([])
      return undefined
    }
    return subscribeToMotmVotes(
      activeEventId,
      (next) => setMotmVotes(next),
      () => undefined, // non-critical
    )
  }, [activeEventId, activeEventIsPastMatch])

  const resultByEventId = new Map(results.map((r) => [r.eventId, r]))

  return {
    activeEventId,
    activeTeamId,
    teams,
    events,
    attendance,
    attendanceReminders,
    results,
    resultByEventId,
    attendanceCounts,
    lineup,
    motmVotes,
    loadingTeams,
    loadingEvents,
    loadingAttendance,
    loadingLineup,
    error,
    isSubmitting,
    isConfigured: isSupabaseConfigured,
    createEvent: async (input: EventFormInput, playerIds: string[], recurrence?: RecurrenceOptions) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        const { count } = await createEventWithAttendance(input, playerIds, recurrence)

        // One push notification regardless of how many sessions were created
        void fetchTeamParentIds(input.teamId).then((parentIds) => {
          if (!parentIds.length) return
          const teamName = teams.find((t) => t.id === input.teamId)?.name ?? 'your team'
          const typeLabel = input.type === 'match' ? 'Match' : 'Training'
          const recurringLabel = recurrence ? ` (${count} sessions)` : ''
          void sendPushToUsers(
            parentIds,
            `${typeLabel}: ${input.title}${recurringLabel}`,
            `${teamName} — ${new Date(input.dateTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`,
            '/',
          )
        })
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to create event.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    updateEvent: async (eventId: string, input: Partial<import('../types/club.ts').EventFormInput>) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await updateEvent(eventId, input)
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to update event.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    deleteEvent: async (eventId: string) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await deleteEvent(eventId)
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to delete event.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    deleteEventSeries: async (recurrenceGroupId: string, fromDateTime: string) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await deleteEventSeries(recurrenceGroupId, fromDateTime)
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to cancel series.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    syncComet: async (teamId: string) => {
      if (!isSupabaseConfigured) throw new Error(supabaseConfigError)
      setIsSubmitting(true)
      setError(null)
      try {
        const result = await syncCometFixtures(teamId)
        let notified = 0
        if (result.changes.length > 0) {
          const parentIds = await fetchTeamParentIds(teamId)
          if (parentIds.length > 0) {
            const teamName = teams.find((team) => team.id === teamId)?.name ?? 'Team'
            const summaries = result.changes.slice(0, 2).map((change) => `${change.title}: ${change.summary}`)
            const remaining = result.changes.length - summaries.length
            const body = `${summaries.join(' · ')}${remaining > 0 ? ` · ${remaining} more update${remaining === 1 ? '' : 's'}` : ''}`
            const sent = await sendPushToUsers(parentIds, `${teamName} fixture update`, body, '/')
            if (sent) notified = parentIds.length
          }
        }
        return { ...result, notified }
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to sync COMET fixtures.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    saveResult: async (eventId: string, input: ResultFormInput) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return }
      setIsSubmitting(true)
      setError(null)
      try {
        await upsertResult(eventId, input)
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to save result.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    /**
     * Add/update/remove a player from the lineup for the active event.
     * @param inSquad  true = add/update, false = remove
     * @param isStarting  true = starter, false = substitute (ignored when inSquad is false)
     */
    toggleLineup: async (playerId: string, inSquad: boolean, isStarting: boolean) => {
      if (!isSupabaseConfigured || !activeEventId) return
      try {
        if (inSquad) {
          await upsertLineupPlayer(activeEventId, playerId, isStarting)
        } else {
          await removeLineupPlayer(activeEventId, playerId)
        }
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to update lineup.'))
      }
    },

    /** Compute sorted Man of the Match tally from current votes + player names. */
    motmTally: (playerNames: Map<string, string>): MotmTally[] =>
      computeMotmTally(motmVotes, playerNames),

    /** Cast or change the current user's MOTM vote for the active event. */
    voteMotm: async (voterId: string, playerId: string) => {
      if (!isSupabaseConfigured || !activeEventId) return
      try {
        await castMotmVote(activeEventId, voterId, playerId)
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to cast vote.'))
      }
    },

    /**
     * Send a push notification to parents of players who have not yet responded
     * to the given event. Returns the count of parents notified.
     */
    updateAttendance: async (attendanceId: string, status: AttendanceRecord['status']) => {
      // Optimistic update
      setAttendance((prev) => prev.map((a) => a.id === attendanceId ? { ...a, status } : a))
      try {
        await coachUpdateAttendance(attendanceId, status)
      } catch {
        // Realtime will correct state on error
      }
    },

    sendAttendanceReminder: async (eventId: string, eventTitle: string, selectedPlayerIds: string[]) => {
      const selected = new Set(selectedPlayerIds)
      const pendingPlayerIds = attendance
        .filter((a) => a.eventId === eventId && a.status === 'pending' && selected.has(a.playerId))
        .map((a) => a.playerId)

      if (!pendingPlayerIds.length) return { recipients: 0, players: 0, skipped: 0, sentAt: null }

      const recipientsByPlayer = await fetchAttendanceRecipientsByPlayer(pendingPlayerIds)
      const linkedPlayerIds = pendingPlayerIds.filter((playerId) => (recipientsByPlayer.get(playerId)?.length ?? 0) > 0)
      const recipientIds = [...new Set(linkedPlayerIds.flatMap((playerId) => recipientsByPlayer.get(playerId) ?? []))]
      if (!recipientIds.length) return { recipients: 0, players: 0, skipped: pendingPlayerIds.length, sentAt: null }

      const recorded = await sendPushToUsers(
        recipientIds,
        'Attendance reminder',
        `Please confirm attendance for: ${eventTitle}`,
        '/',
      )
      if (!recorded) throw new Error('The reminder could not be sent.')

      const sentAt = await recordAttendanceReminders(eventId, linkedPlayerIds, coachId)
      return { recipients: recipientIds.length, players: linkedPlayerIds.length, skipped: pendingPlayerIds.length - linkedPlayerIds.length, sentAt }
    },
  }
}
