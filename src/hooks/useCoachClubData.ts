import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import {
  createEventWithAttendance,
  subscribeToAttendanceForEvent,
  subscribeToCoachTeams,
  subscribeToEventsForTeam,
} from '../services/coachClub.ts'
import type { AttendanceRecord, EventFormInput, EventRecord, TeamRecord } from '../types/club.ts'

function getCoachErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useCoachClubData(coachId: string, selectedTeamId: string, selectedEventId: string) {
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
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

  return {
    activeEventId,
    activeTeamId,
    teams,
    events,
    attendance,
    loadingTeams,
    loadingEvents,
    loadingAttendance,
    error,
    isSubmitting,
    isConfigured: isSupabaseConfigured,
    createEvent: async (input: EventFormInput, playerIds: string[]) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await createEventWithAttendance(input, playerIds)
      } catch (submitError) {
        setError(getCoachErrorMessage(submitError, 'Unable to create event.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
  }
}