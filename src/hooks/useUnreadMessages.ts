import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.ts'

const readEvent = 'clubos:messages-read'
function storageKey(profileId: string) { return `msgs_last_read_${profileId}` }
function getLastRead(profileId: string): string {
  try {
    const value = localStorage.getItem(storageKey(profileId))
    if (value && Number.isFinite(Date.parse(value))) return new Date(value).toISOString()
  } catch { /* Storage is optional. */ }
  return new Date(0).toISOString()
}
function saveReadTime(profileId: string) {
  try { localStorage.setItem(storageKey(profileId), new Date().toISOString()) } catch { /* Storage is optional. */ }
}
export function markMessagesRead(profileId: string) {
  if (!profileId) return
  saveReadTime(profileId)
  window.dispatchEvent(new CustomEvent(readEvent, { detail: profileId }))
}

/** RLS supplies the user's visible conversations, including parents and players. */
export function useUnreadMessages(profileId: string, isViewingMessages = false): boolean {
  const [result, setResult] = useState<{ profileId: string; unread: boolean } | null>(null)
  useEffect(() => {
    if (!supabase || !profileId) return
    let current = true
    let revision = 0
    if (isViewingMessages) saveReadTime(profileId)
    const onRead = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== profileId) return
      revision += 1
      setResult({ profileId, unread: false })
    }
    window.addEventListener(readEvent, onRead)
    const requestRevision = revision
    void supabase.from('messages').select('id', { count: 'exact', head: true })
      .neq('sender_id', profileId).gt('created_at', getLastRead(profileId))
      .then(({ count, error }) => {
        if (current && revision === requestRevision && !error) setResult({ profileId, unread: !isViewingMessages && (count ?? 0) > 0 })
      })
    const channel = supabase.channel(`unread-msgs-${profileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new.sender_id === profileId) return
        revision += 1
        if (isViewingMessages) saveReadTime(profileId)
        else setResult({ profileId, unread: true })
      }).subscribe()
    return () => {
      current = false
      window.removeEventListener(readEvent, onRead)
      void supabase?.removeChannel(channel)
    }
  }, [profileId, isViewingMessages])
  return !isViewingMessages && result?.profileId === profileId && result.unread
}
