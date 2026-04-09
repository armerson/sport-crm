import { useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import {
  subscribeToAttendanceForPlayers,
  subscribeToEventsForTeams,
  subscribeToParentPlayers,
  subscribeToResultsForTeams,
  subscribeToTeamsByIds,
  updateAttendanceResponse,
} from '../services/parentClub.ts'
import type { AttendanceRecord, AttendanceStatus, EventRecord, PlayerRecord, ResultRecord, TeamRecord } from '../types/club.ts'

/** Stable key when `profile.children` gets a new array reference with the same ids. */
function sortedChildIdsKey(ids: string[]) {
  return [...ids].sort().join('|')
}

function getParentErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useParentClubData(childIds: string[]) {
  const childIdsKey = sortedChildIdsKey(childIds)
  const stableChildIds = useMemo(() => [...childIds], [childIdsKey])

  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [results, setResults] = useState<ResultRecord[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingAttendance, setLoadingAttendance] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Track whether players have resolved at least once so we know teamIds is real
  const playersResolvedRef = useRef(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    playersResolvedRef.current = false

    const unsubscribe = subscribeToParentPlayers(
      stableChildIds,
      (nextPlayers) => {
        playersResolvedRef.current = true
        setPlayers(nextPlayers)
        setLoadingPlayers(false)
        setError(null)
      },
      (message) => {
        playersResolvedRef.current = true
        setError(message)
        setLoadingPlayers(false)
      },
    )

    return unsubscribe
  }, [stableChildIds])

  const teamIds = useMemo(
    () => [...new Set(players.flatMap((player) => player.teams))],
    [players],
  )

  // Guard: only subscribe to team-dependent data after players have resolved.
  // This prevents creating and immediately destroying "empty" Supabase channels
  // on every mount while waiting for the first players response.
  const teamIdsReady = playersResolvedRef.current

  useEffect(() => {
    if (!isSupabaseConfigured || !teamIdsReady) {
      return undefined
    }
    if (teamIds.length === 0) {
      setTeams([])
      setLoadingTeams(false)
      return undefined
    }

    const unsubscribe = subscribeToTeamsByIds(
      teamIds,
      (nextTeams) => { setTeams(nextTeams); setLoadingTeams(false); setError(null) },
      (message) => { setError(message); setLoadingTeams(false) },
    )

    return unsubscribe
  }, [teamIds, teamIdsReady])

  useEffect(() => {
    if (!isSupabaseConfigured || !teamIdsReady) {
      return undefined
    }
    if (teamIds.length === 0) {
      setEvents([])
      setLoadingEvents(false)
      return undefined
    }

    const unsubscribe = subscribeToEventsForTeams(
      teamIds,
      (nextEvents) => { setEvents(nextEvents); setLoadingEvents(false); setError(null) },
      (message) => { setError(message); setLoadingEvents(false) },
    )

    return unsubscribe
  }, [teamIds, teamIdsReady])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    const unsubscribe = subscribeToAttendanceForPlayers(
      stableChildIds,
      (nextAttendance) => { setAttendance(nextAttendance); setLoadingAttendance(false); setError(null) },
      (message) => { setError(message); setLoadingAttendance(false) },
    )

    return unsubscribe
  }, [stableChildIds])

  // Results subscription — non-critical, only starts once we have real teamIds
  useEffect(() => {
    if (!isSupabaseConfigured || !teamIdsReady || teamIds.length === 0) {
      setResults([])
      return undefined
    }
    return subscribeToResultsForTeams(
      teamIds,
      (next) => setResults(next),
      () => undefined,
    )
  }, [teamIds, teamIdsReady])

  const configError = !isSupabaseConfigured ? (stableChildIds.length > 0 ? supabaseConfigError : null) : null

  return {
    players: stableChildIds.length > 0 ? players : [],
    teams: teamIds.length > 0 ? teams : [],
    events: teamIds.length > 0 ? events : [],
    attendance: stableChildIds.length > 0 ? attendance : [],
    loadingPlayers: stableChildIds.length > 0 ? loadingPlayers : false,
    loadingTeams: stableChildIds.length > 0 ? loadingTeams : false,
    loadingEvents: stableChildIds.length > 0 ? loadingEvents : false,
    loadingAttendance: stableChildIds.length > 0 ? loadingAttendance : false,
    resultByEventId: new Map(results.map((r) => [r.eventId, r])),
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