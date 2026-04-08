import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.ts'

function storageKey(profileId: string) {
  return `msgs_last_read_${profileId}`
}

function getLastRead(profileId: string): Date {
  const stored = localStorage.getItem(storageKey(profileId))
  return stored ? new Date(stored) : new Date(0)
}

export function markMessagesRead(profileId: string) {
  localStorage.setItem(storageKey(profileId), new Date().toISOString())
}

/**
 * Returns true if any message across the given teamIds arrived after the user
 * last opened the Messages tab. Uses a lightweight Supabase realtime channel.
 */
export function useUnreadMessages(profileId: string, teamIds: string[]): boolean {
  const [hasUnread, setHasUnread] = useState(false)
  const lastChecked = useRef<Date>(getLastRead(profileId))

  useEffect(() => {
    if (!supabase || teamIds.length === 0) return

    // Re-read stored timestamp each time teamIds change
    lastChecked.current = getLastRead(profileId)

    // Check existing messages since last read (one-shot query)
    void supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds)
      .gt('created_at', lastChecked.current.toISOString())
      .then(({ count }) => {
        if ((count ?? 0) > 0) setHasUnread(true)
      })

    // Subscribe to new messages in realtime
    const channel = supabase
      .channel(`unread-msgs-${profileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const teamId = (payload.new as Record<string, unknown>).team_id as string
          if (teamIds.includes(teamId)) {
            setHasUnread(true)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [profileId, teamIds.join(',')])

  return hasUnread
}
