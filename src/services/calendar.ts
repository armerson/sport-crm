import { requireSupabase } from './supabaseHelpers.ts'
import type { EventRecord, TeamRecord } from '../types/club.ts'

export interface CalendarFeed {
  httpsUrl: string
  webcalUrl: string
}

function feedFromToken(token: string): CalendarFeed {
  const base = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/member-calendar?token=${encodeURIComponent(token)}`
  return { httpsUrl: base, webcalUrl: base.replace(/^https:/, 'webcal:') }
}

export async function getCalendarFeed(userId: string): Promise<CalendarFeed | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('calendar_feed_tokens').select('token').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.token ? feedFromToken(data.token) : null
}

export async function createCalendarFeed(userId: string): Promise<CalendarFeed> {
  const client = requireSupabase()
  const { data, error } = await client.from('calendar_feed_tokens').insert({ user_id: userId }).select('token').single()
  if (error) throw error
  return feedFromToken(data.token)
}

export async function rotateCalendarFeed(userId: string): Promise<CalendarFeed> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('calendar_feed_tokens')
    .update({ token: crypto.randomUUID(), rotated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('token')
    .single()
  if (error) throw error
  return feedFromToken(data.token)
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function eventDates(event: EventRecord) {
  const start = new Date(event.dateTime)
  const end = event.endTime ? new Date(event.endTime) : new Date(start.getTime() + (event.type === 'match' ? 120 : 90) * 60 * 1000)
  return { start, end }
}

export function googleCalendarUrl(event: EventRecord, team?: TeamRecord): string {
  const { start, end } = eventDates(event)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatUtc(start)}/${formatUtc(end)}`,
    location: event.location,
    details: [team?.name, team?.ageGroup, event.competition, event.opponent ? `Opponent: ${event.opponent}` : null].filter(Boolean).join(' · '),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function downloadEventCalendar(event: EventRecord, team?: TeamRecord) {
  const { start, end } = eventDates(event)
  const details = [team?.name, team?.ageGroup, event.competition, event.opponent ? `Opponent: ${event.opponent}` : null].filter(Boolean).join(' · ')
  const content = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ClubOS//Event//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${event.id}@clubos`, `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(start)}`, `DTEND:${formatUtc(end)}`, `SUMMARY:${escapeIcs(event.title)}`,
    `LOCATION:${escapeIcs(event.location)}`, `DESCRIPTION:${escapeIcs(details)}`, `URL:${window.location.origin}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'club-event'}.ics`
  link.click()
  URL.revokeObjectURL(url)
}
