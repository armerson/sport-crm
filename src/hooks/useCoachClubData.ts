import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { fetchTeamParentIds, sendPushToUsers } from '../lib/pushNotifications.ts'
import {
  createEventWithAttendance,
  deleteEvent,
  deleteEventSeries,
  updateEvent,
  subscribeToAttendanceForEvent,
  subscribeToCoachTeams,
  subscribeToEventsForTeam,
  subscribeToResultsForTeam,
  upsertResult,
} from '../services/coachClub.ts'
import type { AttendanceRecord, EventFormInput, EventRecord, RecurrenceOptions, ResultFormInput, ResultRecord, TeamRecord } from '../types/club.ts'

function getCoachErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useCoachClubData(coachId: string, selectedTeamId: string, selectedEventId: string) {
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [results, setResults] = useState<ResultRecord[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(Boolean(selectedTeamId))
  const [loadingAttendance, setLoadingAttendance] = useState(Boolean(selectedEventId))
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeTeamId = selectedTeamId || (teams.length === 1 ? teams[0]?.id ?? '' : '')
  const activeEventId = events.some((event) => event.id === selectedEventId) ? selectedEventId : (events[0]?.id ?? '')

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

  const resultByEventId = new Map(results.map((r) => [r.eventId, r]))

  return {
    activeEventId,
    activeTeamId,
    teams,
    events,
    attendance,
    results,
    resultByEventId,
    loadingTeams,
    loadingEvents,
    loadingAttendance,
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
  }
}
