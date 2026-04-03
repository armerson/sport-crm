import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { fetchTeamParentIds, sendPushToUsers } from '../lib/pushNotifications.ts'
import { subscribeToTeams } from '../services/adminClub.ts'
import { subscribeToCoachTeams } from '../services/coachClub.ts'
import { subscribeToUserProfilesByIds, subscribeToMessagesForTeam, sendTeamMessage } from '../services/messages.ts'
import { subscribeToParentPlayers, subscribeToTeamsByIds } from '../services/parentClub.ts'
import type { UserProfile } from '../types/auth.ts'
import type { MessageRecord, TeamRecord } from '../types/club.ts'

function getMessagingErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useTeamMessages(profile: UserProfile, selectedTeamId: string) {
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [senders, setSenders] = useState<UserProfile[]>([])
  const [childTeamIds, setChildTeamIds] = useState<string[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeTeamId = selectedTeamId || (teams.length === 1 ? teams[0]?.id ?? '' : '')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingTeams(false)
      setError(supabaseConfigError)
      return undefined
    }

    if (profile.role === 'admin') {
      const unsubscribe = subscribeToTeams(
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
    }

    if (profile.role === 'coach') {
      const unsubscribe = subscribeToCoachTeams(
        profile.id,
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
    }

    const unsubscribePlayers = subscribeToParentPlayers(
      profile.children,
      (players) => {
        setChildTeamIds([...new Set(players.flatMap((player) => player.teams))])
      },
      (message) => {
        setError(message)
        setLoadingTeams(false)
      },
    )

    return unsubscribePlayers
  }, [profile])

  useEffect(() => {
    if (!isSupabaseConfigured || profile.role !== 'parent') {
      return undefined
    }

    const unsubscribe = subscribeToTeamsByIds(
      childTeamIds,
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
  }, [childTeamIds, profile.role])

  useEffect(() => {
    if (!isSupabaseConfigured || !activeTeamId) {
      setMessages([])
      setLoadingMessages(false)
      return undefined
    }

    setLoadingMessages(true)

    const unsubscribe = subscribeToMessagesForTeam(
      activeTeamId,
      (nextMessages) => {
        setMessages(nextMessages)
        setLoadingMessages(false)
        setError(null)
      },
      (message) => {
        setError(message)
        setLoadingMessages(false)
      },
    )

    return unsubscribe
  }, [activeTeamId])

  const senderIds = useMemo(
    () => [...new Set(messages.map((message) => message.senderId).filter(Boolean))],
    [messages],
  )

  useEffect(() => {
    if (!isSupabaseConfigured || senderIds.length === 0) {
      setSenders([])
      return undefined
    }

    const unsubscribe = subscribeToUserProfilesByIds(
      senderIds,
      (nextSenders) => {
        setSenders(nextSenders)
      },
      (message) => {
        setError(message)
      },
    )

    return unsubscribe
  }, [senderIds])

  return {
    teams,
    activeTeamId,
    messages,
    senders,
    loadingTeams,
    loadingMessages,
    error,
    isConfigured: isSupabaseConfigured,
    isSubmitting,
    sendMessage: async (teamId: string, content: string) => {
      if (!isSupabaseConfigured) {
        setError(supabaseConfigError)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await sendTeamMessage({
          teamId,
          senderId: profile.id,
          content,
        })

        // Fire-and-forget: notify parents (and coaches already have the app open)
        void fetchTeamParentIds(teamId).then((parentIds) => {
          const recipientIds = parentIds.filter((id) => id !== profile.id)
          if (!recipientIds.length) return
          const teamName = teams.find((t) => t.id === teamId)?.name ?? 'your team'
          void sendPushToUsers(
            recipientIds,
            `New message in ${teamName}`,
            `${profile.name}: ${content.slice(0, 80)}${content.length > 80 ? '…' : ''}`,
            '/',
          )
        })
      } catch (submitError) {
        setError(getMessagingErrorMessage(submitError, 'Unable to send message.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
  }
}