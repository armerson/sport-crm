import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { fetchParentIdsForPlayers, fetchTeamParentIds, sendPushToUsers } from '../lib/pushNotifications.ts'
import {
  castMotmVote,
  coachUpdateAttendance,
  computeMotmTally,
  createEventWithAttendance,
  deleteEvent,
  deleteEventSeries,
  removeLineupPlayer,
  subscribeToAttendanceForEvent,
  subscribeToCoachTeams,
  subscribeToEventsForTeam,
  subscribeToLineupForEvent,
  subscribeToMotmVotes,
  subscribeToResultsForTeam,
  updateEvent,
  upsertLineupPlayer,
  upsertResult,
} from '../services/coachClub.ts'
import type { AttendanceRecord, EventFormInput, EventRecord, LineupEntry, MotmTally, MotmVote, RecurrenceOptions, ResultFormInput, ResultRecord, TeamRecord } from '../types/club.ts'

function getCoachErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useCoachClubData(coachId: string, selectedTeamId: string, selectedEventId: string) {
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [results, setResults] = useState<ResultRecord[]>([])
  const [lineup, setLineup] = useState<LineupEntry[]>([])
  const [motmVotes, setMotmVotes] = useState<MotmVote[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(Boolean(selectedTeamId))
  const [loadingAttendance, setLoadingAttendance] = useState(Boolean(selectedEventId))
  const [loadingLineup, setLoadingLineup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeTeamId = selectedTeamId || (teams.length === 1 ? teams[0]?.id ?? '' : '')
  const activeEventId = events.some((event) => event.id === selectedEventId) ? selectedEventId : (events[0]?.id ?? '')
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
    if (!activeTeamId) {
      setEvents([])
      setLoadingEvents(false)
      return undefined
    }

    if (!isSupabaseConfigured) {
      setEvents([])
      setLoadingEvents(false)
      setError(supabaseConfigError)
      return undefined
    }

    setLoadingEvents(true)

    const unsubscribe = subscribeToEventsForTeam(
      activeTeamId,
      (nextEvents) => {
        setEvents(nextEvents)
        setLoadingEvents(false)
      },
      (message) => {
        setError(message)
        setLoadingEvents(false)
      },
    )

    return unsubscribe
  }, [activeTeamId])

  // Results subscription — lives alongside the events subscription
  useEffect(() => {
    if (!activeTeamId || !isSupabaseConfigured) { setResults([]); return undefined }
    return subscribeToResultsForTeam(
      activeTeamId,
      (next) => setResults(next),
      () => undefined, // non-critical, silently ignore errors
    )
  }, [activeTeamId])

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
    results,
    resultByEventId,
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

    sendAttendanceReminder: async (eventId: string, eventTitle: string): Promise<number> => {
      const pendingPlayerIds = attendance
        .filter((a) => a.eventId === eventId && a.status === 'pending')
        .map((a) => a.playerId)

      if (!pendingPlayerIds.length) return 0

      const parentIds = await fetchParentIdsForPlayers(pendingPlayerIds)
      if (!parentIds.length) return 0

      await sendPushToUsers(
        parentIds,
        'Attendance reminder',
        `Please confirm your child's attendance for: ${eventTitle}`,
        '/',
      )

      return parentIds.length
    },
  }
}
