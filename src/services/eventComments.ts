import { supabase } from '../lib/supabase.ts'

export interface EventComment {
  id: string
  eventId: string
  authorId: string | null
  authorName: string
  body: string
  createdAt: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function mapComment(row: Record<string, unknown>): EventComment {
  const authorObj = row.author_name as Record<string, unknown> | null
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    authorId: (row.author_id as string | null) ?? null,
    authorName: (authorObj?.name as string | null) ?? 'Unknown',
    body: row.body as string,
    createdAt: row.created_at as string,
  }
}

export async function fetchEventComments(eventId: string): Promise<EventComment[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('event_comments')
    .select('*, author_name:profiles!author_id(name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapComment(r as Record<string, unknown>))
}

export async function addEventComment(
  eventId: string,
  authorId: string,
  body: string,
): Promise<EventComment> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('event_comments')
    .insert({ event_id: eventId, author_id: authorId, body: body.trim() })
    .select('*, author_name:profiles!author_id(name)')
    .single()
  if (error) throw new Error(error.message)
  return mapComment(data as Record<string, unknown>)
}

export async function deleteEventComment(commentId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('event_comments').delete().eq('id', commentId)
  if (error) throw new Error(error.message)
}
