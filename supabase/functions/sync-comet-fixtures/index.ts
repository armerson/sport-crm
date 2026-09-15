import { createClient } from 'jsr:@supabase/supabase-js@2'

type CometMatch = {
  matchId?: number | string
  date?: string
  kickoff?: string
  home?: string
  away?: string
  venue?: 'home' | 'away'
  status?: 'played' | 'postponed' | 'upcoming'
  competition?: string
  ground?: string
  homeScore?: number
  awayScore?: number
}

function corsFor(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = /^https:\/\/.+/i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsFor(request) },
  })
}

function localKickoffIso(date: string, kickoff: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(kickoff)) return null
  const [year, month, day] = date.split('-').map(Number)
  const lastSunday = (monthIndex: number) => {
    const value = new Date(Date.UTC(year, monthIndex + 1, 0))
    return value.getUTCDate() - value.getUTCDay()
  }
  const isBst = (month > 3 && month < 10) || (month === 3 && day >= lastSunday(2)) || (month === 10 && day < lastSunday(9))
  const parsed = new Date(`${date}T${kickoff}:00${isBst ? '+01:00' : '+00:00'}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, 300) : fallback
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsFor(request) })
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const feedBase = (Deno.env.get('COMET_FEED_URL') ?? 'https://www.ambassadorsfc.org/api/comet').trim()
  const authHeader = request.headers.get('Authorization') ?? ''
  const expectedInternalSecret = Deno.env.get('COMET_SYNC_SECRET') ?? ''
  const suppliedInternalSecret = request.headers.get('x-internal-secret') ?? ''
  const isInternal = expectedInternalSecret.length >= 32 && suppliedInternalSecret === expectedInternalSecret

  if (!supabaseUrl || !serviceRoleKey) return json(request, { error: 'Club data service is not configured.' }, 500)
  if (!authHeader) return json(request, { error: 'Please sign in again before syncing.' }, 401)

  let feedUrl: URL
  try {
    feedUrl = new URL(feedBase)
    if (feedUrl.protocol !== 'https:' || feedUrl.username || feedUrl.password) throw new Error('invalid')
  } catch {
    return json(request, { error: 'The club COMET feed is not configured correctly.' }, 500)
  }

  let payload: { teamId?: string }
  try { payload = await request.json() } catch { return json(request, { error: 'Invalid request.' }, 400) }
  const teamId = cleanText(payload.teamId)
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return json(request, { error: 'Choose a valid team.' }, 400)

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let actorId: string | null = null
  let actorName = 'Automated COMET sync'
  if (!isInternal) {
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const { data: userData, error: userError } = await service.auth.getUser(jwt)
    if (userError || !userData.user) return json(request, { error: 'Please sign in again before syncing.' }, 401)
    actorId = userData.user.id

    const [{ data: profile }, { data: coachLink }] = await Promise.all([
      service.from('profiles').select('name, roles').eq('id', actorId).maybeSingle(),
      service.from('team_coaches').select('team_id').eq('team_id', teamId).eq('coach_id', actorId).maybeSingle(),
    ])
    const roles = Array.isArray(profile?.roles) ? profile.roles : []
    if (!roles.includes('admin') && !coachLink) return json(request, { error: 'Only this team’s coaches or a club admin can sync fixtures.' }, 403)
    actorName = cleanText(profile?.name, 'Club member')
  }

  const { data: team, error: teamError } = await service
    .from('teams')
    .select('id, name, comet_team_id, comet_competition_id, archived_at')
    .eq('id', teamId)
    .maybeSingle()
  if (teamError || !team) return json(request, { error: 'Team could not be found.' }, 404)
  if (team.archived_at) return json(request, { error: 'Restore this team before syncing fixtures.' }, 400)
  if (!team.comet_team_id || !team.comet_competition_id) {
    return json(request, { error: 'Ask a club admin to add the COMET team and competition IDs first.' }, 400)
  }

  const recordSync = async (status: 'success' | 'error', count: number | null, error: string | null) => {
    await service.from('teams').update({
      comet_last_synced_at: new Date().toISOString(),
      comet_last_sync_status: status,
      comet_last_sync_error: error,
      comet_last_sync_count: count,
    }).eq('id', teamId)
  }

  feedUrl.search = ''
  feedUrl.searchParams.set('type', 'matches')
  feedUrl.searchParams.set('teamId', String(team.comet_team_id))
  feedUrl.searchParams.set('compId', String(team.comet_competition_id))

  let matches: CometMatch[]
  try {
    const response = await fetch(feedUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`Feed returned ${response.status}`)
    const body: unknown = await response.json()
    if (!Array.isArray(body) || body.length > 250) throw new Error('Unexpected feed response')
    matches = body as CometMatch[]
  } catch (error) {
    console.error('COMET feed error', error instanceof Error ? error.message : error)
    await recordSync('error', null, 'The COMET feed was unavailable.')
    return json(request, { error: 'The COMET feed is temporarily unavailable. Try again shortly.' }, 502)
  }

  const valid = matches.flatMap((match) => {
    const externalId = String(match.matchId ?? '').trim()
    const dateTime = localKickoffIso(cleanText(match.date), cleanText(match.kickoff, '15:00'))
    const home = cleanText(match.home)
    const away = cleanText(match.away)
    const homeAway = match.venue === 'home' ? 'home' : match.venue === 'away' ? 'away' : null
    if (!externalId || !dateTime || !home || !away || !homeAway) return []
    const opponent = homeAway === 'home' ? away : home
    return [{
      match,
      event: {
        team_id: teamId,
        title: `${home} v ${away}`,
        type: 'match',
        date_time: dateTime,
        location: cleanText(match.ground, 'Venue TBC'),
        opponent,
        event_status: match.status === 'postponed' ? 'cancelled' : 'confirmed',
        external_source: 'comet',
        external_id: externalId,
        competition: cleanText(match.competition) || null,
        home_away: homeAway,
      },
    }]
  })

  if (valid.length === 0) {
    await recordSync('success', 0, null)
    return json(request, { synced: 0, added: 0, updated: 0, results: 0, changes: [] })
  }

  const { data: existing } = await service
    .from('events')
    .select('external_id, title, date_time, location, event_status')
    .eq('team_id', teamId)
    .eq('external_source', 'comet')
  const existingIds = new Set((existing ?? []).map((row) => String(row.external_id)))
  const existingById = new Map((existing ?? []).map((row) => [String(row.external_id), row]))
  const changes = valid.flatMap(({ event }) => {
    const previous = existingById.get(event.external_id)
    if (!previous) return []
    const details: string[] = []
    if (new Date(previous.date_time).getTime() !== new Date(event.date_time).getTime()) {
      const kickoff = new Date(event.date_time).toLocaleString('en-GB', {
        timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
      details.push(`kick-off changed to ${kickoff}`)
    }
    if (previous.location !== event.location) details.push(`venue changed to ${event.location}`)
    if (previous.title !== event.title) details.push(`fixture changed to ${event.title}`)
    if (previous.event_status !== event.event_status) {
      details.push(event.event_status === 'cancelled' ? 'fixture postponed or cancelled' : 'fixture reinstated')
    }
    return details.length ? [{ externalId: event.external_id, title: event.title, summary: details.join('; ') }] : []
  })

  const { data: syncedEvents, error: eventError } = await service
    .from('events')
    .upsert(valid.map((item) => item.event), { onConflict: 'team_id,external_source,external_id' })
    .select('id, external_id')
  if (eventError || !syncedEvents) {
    await recordSync('error', null, 'Fixtures could not be saved.')
    return json(request, { error: eventError?.message ?? 'Fixtures could not be saved.' }, 500)
  }

  const eventByExternalId = new Map(syncedEvents.map((row) => [String(row.external_id), String(row.id)]))
  const resultRows = valid.flatMap(({ match, event }) => {
    if (match.status !== 'played' || !Number.isInteger(match.homeScore) || !Number.isInteger(match.awayScore)) return []
    const eventId = eventByExternalId.get(event.external_id)
    return eventId ? [{ event_id: eventId, home_score: match.homeScore, away_score: match.awayScore, updated_at: new Date().toISOString() }] : []
  })
  if (resultRows.length) {
    const { error } = await service.from('results').upsert(resultRows, { onConflict: 'event_id' })
    if (error) {
      await recordSync('error', null, 'Results could not be saved.')
      return json(request, { error: `Fixtures synced, but results could not be saved: ${error.message}` }, 500)
    }
  }

  const { data: playerLinks } = await service.from('player_teams').select('player_id').eq('team_id', teamId)
  const attendanceRows = syncedEvents.flatMap((event) => (playerLinks ?? []).map((link) => ({ event_id: event.id, player_id: link.player_id, status: 'pending' })))
  if (attendanceRows.length) {
    const { error } = await service.from('attendance').upsert(attendanceRows, { onConflict: 'event_id,player_id', ignoreDuplicates: true })
    if (error) {
      await recordSync('error', null, 'Attendance could not be prepared.')
      return json(request, { error: `Fixtures synced, but attendance could not be prepared: ${error.message}` }, 500)
    }
  }

  const added = valid.filter(({ event }) => !existingIds.has(event.external_id)).length
  const updated = valid.length - added
  await recordSync('success', valid.length, null)
  if (actorId) {
    await service.from('audit_logs').insert({
      actor_id: actorId,
      actor_name: actorName,
      action: 'sync_comet_fixtures',
      target_type: 'team',
      target_id: teamId,
      summary: `${team.name}: synced ${valid.length} COMET fixtures (${added} new, ${updated} updated).`,
    })
  }

  return json(request, { synced: valid.length, added, updated, results: resultRows.length, changes })
})
