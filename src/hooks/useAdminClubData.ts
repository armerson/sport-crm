import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { assignCoachToTeam, linkParentToPlayer, unlinkParentFromPlayer } from '../services/adminActions.ts'
import { provisionClubUser } from '../services/provisioning.ts'
import {
  subscribeToParents,
  subscribeToCoaches,
  subscribeToTeams,
  subscribeToAllEvents,
  addPlayerToTeam,
  createTeam,
} from '../services/adminClub.ts'
import type { UserProfile } from '../types/auth.ts'
import type { EventRecord, PlayerFormInput, TeamFormInput, TeamRecord } from '../types/club.ts'
import type { ProvisionableRole } from '../services/provisioning.ts'

function getAdminErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useAdminClubData() {
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [coaches, setCoaches] = useState<UserProfile[]>([])
  const [parents, setParents] = useState<UserProfile[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(supabaseConfigError)
      return undefined
    }

    setError(null)

    let pendingSubscriptions = 4

    const markLoaded = () => {
      pendingSubscriptions -= 1

      if (pendingSubscriptions <= 0) {
        setLoading(false)
      }
    }

    const teamsSubscription = subscribeToTeams(
      (nextTeams) => {
        setTeams(nextTeams)
        markLoaded()
      },
      (message) => {
        setError(message)
        markLoaded()
      },
    )

    const coachesSubscription = subscribeToCoaches(
      (nextCoaches) => {
        setCoaches(nextCoaches)
        markLoaded()
      },
      (message) => {
        setError(message)
        markLoaded()
      },
    )

    const parentsSubscription = subscribeToParents(
      (nextParents) => {
        setParents(nextParents)
        markLoaded()
      },
      (message) => {
        setError(message)
        markLoaded()
      },
    )

    const eventsSubscription = subscribeToAllEvents(
      (nextEvents) => {
        setEvents(nextEvents)
        markLoaded()
      },
      (message) => {
        setError(message)
        markLoaded()
      },
    )

    return () => {
      teamsSubscription()
      coachesSubscription()
      parentsSubscription()
      eventsSubscription()
    }
  }, [])

  return {
    teams,
    coaches,
    parents,
    events,
    loading,
    error,
    isConfigured: isSupabaseConfigured,
    isSubmitting,
    createTeam: async (input: TeamFormInput) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await createTeam(input)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to create team.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    addPlayer: async (input: PlayerFormInput) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await addPlayerToTeam(input)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to add player.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    assignCoach: async (teamId: string, coachId: string) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await assignCoachToTeam(teamId, coachId)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to assign coach.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    linkParent: async (playerId: string, parentId: string) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await linkParentToPlayer(playerId, parentId)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to link parent to player.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    unlinkParent: async (playerId: string, parentId: string) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await unlinkParentFromPlayer(playerId, parentId)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to unlink parent from player.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    provisionUser: async (name: string, email: string, roles: ProvisionableRole[]) => {
      setIsSubmitting(true)
      setError(null)

      try {
        return await provisionClubUser({ name, email, roles })
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to provision account.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
  }
}