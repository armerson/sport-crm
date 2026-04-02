import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import {
  subscribeToAttendanceForPlayers,
  subscribeToEventsForTeams,
  subscribeToParentPlayers,
  subscribeToTeamsByIds,
  updateAttendanceResponse,
} from '../services/parentClub.ts'
import type { AttendanceRecord, AttendanceStatus, EventRecord, PlayerRecord, TeamRecord } from '../types/club.ts'

function getParentErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useParentClubData(childIds: string[]) {
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingAttendance, setLoadingAttendance] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    const unsubscribe = subscribeToParentPlayers(
      childIds,
      (nextPlayers) => {
        setPlayers(nextPlayers)
        setLoadingPlayers(false)
        setError(null)
      },
      (message) => {
        setError(message)
        setLoadingPlayers(false)
      },
    )

    return unsubscribe
  }, [childIds])

  const teamIds = useMemo(
    () => [...new Set(players.flatMap((player) => player.teams))],
    [players],
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    const unsubscribe = subscribeToTeamsByIds(
      teamIds,
      (nextTeams) => {
        setTeams(nextTeams)
        setLoadingTeams(false)
        setError(null)
      },
      (message) => {
        setError(message)
        setLoadingTeams(false)
      },
    )

    return unsubscribe
  }, [teamIds])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    const unsubscribe = subscribeToEventsForTeams(
      teamIds,
      (nextEvents) => {
        setEvents(nextEvents)
        setLoadingEvents(false)
        setError(null)
      },
      (message) => {
        setError(message)
        setLoadingEvents(false)
      },
    )

    return unsubscribe
  }, [teamIds])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    const unsubscribe = subscribeToAttendanceForPlayers(
      childIds,
      (nextAttendance) => {
        setAttendance(nextAttendance)
        setLoadingAttendance(false)
        setError(null)
      },
      (message) => {
        setError(message)
        setLoadingAttendance(false)
      },
    )

    return unsubscribe
  }, [childIds])

  const configError = !isSupabaseConfigured ? (childIds.length > 0 ? supabaseConfigError : null) : null

  return {
    players: childIds.length > 0 ? players : [],
    teams: teamIds.length > 0 ? teams : [],
    events: teamIds.length > 0 ? events : [],
    attendance: childIds.length > 0 ? attendance : [],
    loadingPlayers: childIds.length > 0 ? loadingPlayers : false,
    loadingTeams: teamIds.length > 0 ? loadingTeams : false,
    loadingEvents: teamIds.length > 0 ? loadingEvents : false,
    loadingAttendance: childIds.length > 0 ? loadingAttendance : false,
    error: configError ?? error,
    isConfigured: isSupabaseConfigured,
    isSubmitting,
    updateAttendance: async (attendanceId: string, status: AttendanceStatus) => {
      if (!isSupabaseConfigured) {
        return
      }

      setIsSubmitting(true)

      try {
        await updateAttendanceResponse(attendanceId, status)
      } catch (submitError) {
        setError(getParentErrorMessage(submitError, 'Unable to update attendance response.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
  }
}