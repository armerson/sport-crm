import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import {
  approvePendingPlayerToTeam,
  assignCoachToTeam,
  linkParentToPlayer,
  movePlayerToTeam,
  rejectPendingRegistration,
  removePlayerFromClub,
  unlinkParentFromPlayer,
} from '../services/adminActions.ts'
import { provisionClubUser } from '../services/provisioning.ts'
import {
  subscribeToParents,
  subscribeToCoaches,
  subscribeToGroups,
  subscribeToTeams,
  subscribeToAllEvents,
  subscribeToPendingPlayers,
  addPlayerToTeam,
  createGroup,
  createTeam,
  deleteGroup,
  deleteTeam,
  updateGroup,
  updateTeam,
} from '../services/adminClub.ts'
import type { PendingRegistration } from '../services/adminClub.ts'
import type { UserProfile } from '../types/auth.ts'
import type { EventRecord, GroupFormInput, GroupRecord, PlayerFormInput, TeamFormInput, TeamRecord } from '../types/club.ts'
import type { ProvisionableRole } from '../services/provisioning.ts'

function getAdminErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useAdminClubData() {
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [coaches, setCoaches] = useState<UserProfile[]>([])
  const [parents, setParents] = useState<UserProfile[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Coaches + parents are deferred: only fetched when the Manage tab is first opened.
  // This removes them from the initial loading barrier so Overview appears faster.
  const [loadContacts, setLoadContacts] = useState(false)

  // Core data — always loaded, controls the loading spinner
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(supabaseConfigError)
      return undefined
    }

    setError(null)

    let pending = 4

    const markLoaded = () => {
      pending -= 1
      if (pending <= 0) setLoading(false)
    }

    const teamsSubscription = subscribeToTeams(
      (nextTeams) => { setTeams(nextTeams); markLoaded() },
      (message) => { setError(message); markLoaded() },
    )

    const eventsSubscription = subscribeToAllEvents(
      (nextEvents) => { setEvents(nextEvents); markLoaded() },
      (message) => { setError(message); markLoaded() },
    )

    const groupsSubscription = subscribeToGroups(
      (nextGroups) => { setGroups(nextGroups); markLoaded() },
      (message) => { setError(message); markLoaded() },
    )

    const pendingSubscription = subscribeToPendingPlayers(
      (next) => { setPendingRegistrations(next); markLoaded() },
      (message) => { setError(message); markLoaded() },
    )

    return () => {
      teamsSubscription()
      eventsSubscription()
      groupsSubscription()
      pendingSubscription()
    }
  }, [])

  // Contacts — deferred until Manage tab is opened for the first time
  useEffect(() => {
    if (!loadContacts || !isSupabaseConfigured) return undefined

    const coachesSubscription = subscribeToCoaches(
      (nextCoaches) => setCoaches(nextCoaches),
      (message) => setError(message),
    )

    const parentsSubscription = subscribeToParents(
      (nextParents) => setParents(nextParents),
      (message) => setError(message),
    )

    return () => {
      coachesSubscription()
      parentsSubscription()
    }
  }, [loadContacts])

  return {
    teams,
    coaches,
    parents,
    events,
    groups,
    pendingRegistrations,
    loading,
    error,
    isConfigured: isSupabaseConfigured,
    isSubmitting,
    triggerLoadContacts: () => setLoadContacts(true),
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
    updateTeam: async (teamId: string, input: TeamFormInput) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await updateTeam(teamId, input)
        // Optimistic update — realtime will confirm later
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId
              ? { ...t, name: input.name, ageGroup: input.ageGroup, isSenior: input.isSenior === true }
              : t,
          ),
        )
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to update team.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    deleteTeam: async (teamId: string) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await deleteTeam(teamId)
        // Optimistic removal — realtime will confirm later
        setTeams((prev) => prev.filter((t) => t.id !== teamId))
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to delete team.'))
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
    movePlayer: async (playerId: string, fromTeamId: string, toTeamId: string) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return }
      setIsSubmitting(true)
      setError(null)
      try {
        await movePlayerToTeam(playerId, fromTeamId, toTeamId)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to move player.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    removePlayer: async (playerId: string) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return }
      setIsSubmitting(true)
      setError(null)
      try {
        await removePlayerFromClub(playerId)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to remove player.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    provisionUser: async (name: string, email: string, roles: ProvisionableRole[]) => {
      setIsSubmitting(true)
      setError(null)

      try {
        return await provisionClubUser({
          name,
          email,
          roles,
          redirectOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        })
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to provision account.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    createGroup: async (input: GroupFormInput, teamIds: string[] = []) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return undefined }
      setIsSubmitting(true)
      setError(null)
      try {
        return await createGroup(input, teamIds)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to create group.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    updateGroup: async (groupId: string, input: GroupFormInput, teamIds: string[]) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return }
      setIsSubmitting(true)
      setError(null)
      try {
        await updateGroup(groupId, input, teamIds)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to update group.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    deleteGroup: async (groupId: string) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return }
      setIsSubmitting(true)
      setError(null)
      try {
        await deleteGroup(groupId)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to delete group.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    approvePendingPlayer: async (playerId: string, teamId: string) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return }
      setIsSubmitting(true)
      setError(null)
      try {
        await approvePendingPlayerToTeam(playerId, teamId)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to approve registration.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    rejectPendingRegistration: async (playerId: string) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return }
      setIsSubmitting(true)
      setError(null)
      try {
        await rejectPendingRegistration(playerId)
      } catch (submitError) {
        setError(getAdminErrorMessage(submitError, 'Unable to reject registration.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
  }
}