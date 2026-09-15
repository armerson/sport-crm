import { useCallback, useEffect, useMemo, useState } from 'react'
import { requireSupabase, subscribeToTables } from '../services/supabaseHelpers.ts'

export interface MemberNotification {
  id: string
  title: string
  body: string
  url: string
  readAt: string | null
  createdAt: string
}

export function useMemberNotifications(userId: string) {
  const [items, setItems] = useState<MemberNotification[]>([])
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    if (!userId) return
    return subscribeToTables(`member-notifications-${userId}`, ['member_notifications'], async () => {
      const { data } = await requireSupabase().from('member_notifications')
        .select('id, title, body, url, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      setItems((data ?? []).map((row) => ({
        id: row.id, title: row.title, body: row.body, url: row.url,
        readAt: row.read_at, createdAt: row.created_at,
      })))
      setLoading(false)
    })
  }, [userId])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    const now = new Date().toISOString()
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })))
    await requireSupabase().from('member_notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
  }, [userId])

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString()
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: item.readAt ?? now } : item))
    await requireSupabase().from('member_notifications').update({ read_at: now }).eq('id', id).is('read_at', null)
  }, [])

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items])
  return { items, loading, unreadCount, markAllRead, markRead }
}
