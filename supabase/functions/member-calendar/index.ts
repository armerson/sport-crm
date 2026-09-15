import { createClient } from 'npm:@supabase/supabase-js@2.101.1'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function icsDate(value: Date): string {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function fold(line: string): string {
  const chunks: string[] = []
  let rest = line
  while (new TextEncoder().encode(rest).length > 73) {
    let end = Math.min(70, rest.length)
    while (end > 1 && new TextEncoder().encode(rest.slice(0, end)).length > 73) end -= 1
    chunks.push(rest.slice(0, end))
    rest = ` ${rest.slice(end)}`
  }
  chunks.push(rest)
  return chunks.join('\r\n')
}

function response(message: string, status: number, contentType = 'text/plain; charset=utf-8') {
  return new Response(message, { status, headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' } })
}

Deno.serve(async (request) => {
  if (request.method !== 'GET') return response('Method not allowed.', 405)
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!uuid.test(token)) return response('Calendar link is invalid.', 404)

  const { data: feed } = await supabase.from('calendar_feed_tokens').select('user_id').eq('token', token).maybeSingle()
  if (!feed) return response('Calendar link is invalid or has been replaced.', 404)

  const { data: profile } = await supabase.from('profiles').select('roles, linked_player_id').eq('id', feed.user_id).maybeSingle()
  if (!profile) return response('Calendar link is invalid or has been replaced.', 404)

  let teamIds: string[] = []
  if (Array.isArray(profile.roles) && profile.roles.includes('admin')) {
    const { data } = await supabase.from('teams').select('id').is('archived_at', null)
    teamIds = (data ?? []).map((row) => row.id)
  } else {
    const [{ data: coached }, { data: children }] = await Promise.all([
      supabase.from('team_coaches').select('team_id').eq('coach_id', feed.user_id),
      supabase.from('player_parents').select('player_id').eq('parent_id', feed.user_id),
    ])
    const playerIds = [...new Set([
      ...(children ?? []).map((row) => row.player_id),
      ...(profile.linked_player_id ? [profile.linked_player_id] : []),
    ])]
    const { data: memberships } = playerIds.length
      ? await supabase.from('player_teams').select('team_id').in('player_id', playerIds)
      : { data: [] }
    teamIds = [...new Set([...(coached ?? []).map((row) => row.team_id), ...(memberships ?? []).map((row) => row.team_id)])]
  }

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events, error } = teamIds.length
    ? await supabase
      .from('events')
      .select('id, title, type, date_time, meet_time, end_time, location, competition, opponent, event_status, teams(name, age_group)')
      .in('team_id', teamIds)
      .or('event_status.is.null,event_status.neq.cancelled')
      .gte('date_time', from)
      .order('date_time')
    : { data: [], error: null }

  if (error) return response('Calendar is temporarily unavailable.', 500)

  const appUrl = (Deno.env.get('APP_BASE_URL') ?? 'https://sports-crm-dun.vercel.app').replace(/\/$/, '')
  const now = icsDate(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClubOS//Member Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ClubOS schedule',
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const event of events ?? []) {
    const start = new Date(event.date_time)
    const durationMinutes = event.type === 'match' ? 120 : 90
    const end = event.end_time ? new Date(event.end_time) : new Date(start.getTime() + durationMinutes * 60 * 1000)
    const team = Array.isArray(event.teams) ? event.teams[0] : event.teams
    const details = [team?.name, team?.age_group, event.competition, event.opponent ? `Opponent: ${event.opponent}` : null]
      .filter(Boolean).join(' · ')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@clubos`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `LOCATION:${escapeIcs(event.location ?? '')}`,
      `DESCRIPTION:${escapeIcs(details)}`,
      ...(event.meet_time ? [`X-CLUBOS-MEET-TIME:${icsDate(new Date(event.meet_time))}`] : []),
      `URL:${appUrl}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')

  return new Response(lines.map(fold).join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="clubos-schedule.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  })
})
