import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { fetchTeamParentIds, fetchGroupRecipientIds, fetchAllClubRecipientIds, sendPushToUsers } from '../lib/pushNotifications.ts'
import { subscribeToGroups, subscribeToTeams } from '../services/adminClub.ts'
import { subscribeToCoachTeams } from '../services/coachClub.ts'
import {
  subscribeToUserProfilesByIds,
  subscribeToMessagesForTeam,
  subscribeToMessagesForGroup,
  subscribeToClubMessages,
  sendTeamMessage,
} from '../services/messages.ts'
import { subscribeToParentPlayers, subscribeToTeamsByIds } from '../services/parentClub.ts'
import type { UserProfile } from '../types/auth.ts'
import type { GroupRecord, MessageRecord, TeamRecord } from '../types/club.ts'

function getMessagingErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Target selector string format:
 *   ""             → nothing selected
 *   "club"         → club-wide broadcast
 *   "group:<uuid>" → a named group
 *   "<uuid>"       → a specific team (bare UUID, backward-compatible)
 */
function parseTarget(target: string): { kind: 'none' | 'club' | 'group' | 'team'; id: string } {
  if (!target) return { kind: 'none', id: '' }
  if (target === 'club') return { kind: 'club', id: '' }
  if (target.startsWith('group:')) return { kind: 'group', id: target.slice(6) }
  return { kind: 'team', id: target }
}

export function useTeamMessages(profile: UserProfile, selectedTarget: string) {
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [senders, setSenders] = useState<UserProfile[]>([])
  const [childTeamIds, setChildTeamIds] = useState<string[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-select the sole team when a coach/parent only has one
  const activeTarget = selectedTarget || (teams.length === 1 ? (teams[0]?.id ?? '') : '')
  const activeParsed = parseTarget(activeTarget)

  // ── Team list (role-dependent) ────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingTeams(false)
      setError(supabaseConfigError)
      return undefined
    }

    if (profile.roles.includes('admin')) {
      const unsubscribe = subscribeToTeams(
        (nextTeams) => { setTeams(nextTeams); setLoadingTeams(false); setError(null) },
        (message) => { setError(message); setLoadingTeams(false) },
      )
      return unsubscribe
    }

    if (profile.roles.includes('coach')) {
      const unsubscribe = subscribeToCoachTeams(
        profile.id,
        (nextTeams) => { setTeams(nextTeams); setLoadingTeams(false); setError(null) },
        (message) => { setError(message); setLoadingTeams(false) },
      )
      return unsubscribe
    }

    const unsubscribePlayers = subscribeToParentPlayers(
      profile.children,
      (players) => { setChildTeamIds([...new Set(players.flatMap((p) => p.teams))]) },
      (message) => { setError(message); setLoadingTeams(false) },
    )
    return unsubscribePlayers
  }, [profile])

  // Parent: resolve team IDs → team records
  useEffect(() => {
    if (!isSupabaseConfigured || !profile.roles.includes('parent')) return undefined

    const unsubscribe = subscribeToTeamsByIds(
      childTeamIds,
      (nextTeams) => { setTeams(nextTeams); setLoadingTeams(false); setError(null) },
      (message) => { setError(message); setLoadingTeams(false) },
    )
    return unsubscribe
  }, [childTeamIds, profile.roles])

  // ── Groups (admins only) ──────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !profile.roles.includes('admin')) return undefined

    const unsubscribe = subscribeToGroups(
      (nextGroups) => setGroups(nextGroups),
      (message) => setError(message),
    )
    return unsubscribe
  }, [profile.roles])

  // ── Messages (target-dependent) ──────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || activeParsed.kind === 'none') {
      setMessages([])
      setLoadingMessages(false)
      return undefined
    }

    setLoadingMessages(true)

    if (activeParsed.kind === 'team') {
      return subscribeToMessagesForTeam(
        activeParsed.id,
        (next) => { setMessages(next); setLoadingMessages(false); setError(null) },
        (msg) => { setError(msg); setLoadingMessages(false) },
      )
    }

    if (activeParsed.kind === 'group') {
      return subscribeToMessagesForGroup(
        activeParsed.id,
        (next) => { setMessages(next); setLoadingMessages(false); setError(null) },
        (msg) => { setError(msg); setLoadingMessages(false) },
      )
    }

    // club-wide
    return subscribeToClubMessages(
      (next) => { setMessages(next); setLoadingMessages(false); setError(null) },
      (msg) => { setError(msg); setLoadingMessages(false) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTarget])

  // ── Sender profiles ───────────────────────────────────────────
  const senderIds = useMemo(
    () => [...new Set(messages.map((m) => m.senderId).filter(Boolean))],
    [messages],
  )

  useEffect(() => {
    if (!isSupabaseConfigured || senderIds.length === 0) { setSenders([]); return undefined }
    return subscribeToUserProfilesByIds(
      senderIds,
      (next) => setSenders(next),
      (msg) => setError(msg),
    )
  }, [senderIds])

  return {
    teams,
    groups,
    /** The resolved active target string (includes auto-selected team). */
    activeTarget,
    /** Backward-compat alias: resolves to a team ID only when target is a team. */
    activeTeamId: activeParsed.kind === 'team' ? activeParsed.id : '',
    messages,
    senders,
    loadingTeams,
    loadingMessages,
    error,
    isConfigured: isSupabaseConfigured,
    isSubmitting,
    sendMessage: async (target: string, content: string) => {
      if (!isSupabaseConfigured) { setError(supabaseConfigError); return }

      setIsSubmitting(true)
      setError(null)

      const tp = parseTarget(target)

      try {
        await sendTeamMessage({
          teamId: tp.kind === 'team' ? tp.id : null,
          groupId: tp.kind === 'group' ? tp.id : null,
          senderId: profile.id,
          content,
        })

        // Push notifications: fire-and-forget
        const snippet = `${profile.name}: ${content.slice(0, 80)}${content.length > 80 ? '…' : ''}`
        if (tp.kind === 'team') {
          void fetchTeamParentIds(tp.id).then((parentIds) => {
            const recipients = parentIds.filter((id) => id !== profile.id)
            if (!recipients.length) return
            const teamName = teams.find((t) => t.id === tp.id)?.name ?? 'your team'
            void sendPushToUsers(recipients, `New message in ${teamName}`, snippet, '/')
          })
        } else if (tp.kind === 'group') {
          void fetchGroupRecipientIds(tp.id, profile.id).then((recipients) => {
            if (!recipients.length) return
            const groupName = groups.find((g) => g.id === tp.id)?.name ?? 'your group'
            void sendPushToUsers(recipients, `Message to ${groupName}`, snippet, '/')
          })
        } else if (tp.kind === 'club') {
          void fetchAllClubRecipientIds(profile.id).then((recipients) => {
            if (!recipients.length) return
            void sendPushToUsers(recipients, 'Club announcement', snippet, '/')
          })
        }
      } catch (submitError) {
        setError(getMessagingErrorMessage(submitError, 'Unable to send message.'))
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
  }
}
