import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createReminderHandler } from './handler.ts'

type EventRow = {
  id: string
  title: string
  date_time: string
  meet_time: string | null
  team_id: string
  teams: { name: string } | { name: string }[] | null
}

function teamName(row: EventRow) {
  const team = Array.isArray(row.teams) ? row.teams[0] : row.teams
  return team?.name?.trim() || 'Team'
}

function eventTime(row: EventRow) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(row.meet_time ?? row.date_time))
}

const expectedSecret = Deno.env.get('COMET_SYNC_SECRET') ?? ''
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(createReminderHandler({
  isInternal(request) {
    const supplied = request.headers.get('x-cron-secret') ?? ''
    return expectedSecret.length >= 32 && supplied === expectedSecret
  },
  async run() {
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Club data service is not configured.')
    const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const now = Date.now()
    const earliest = new Date(now + 20 * 60 * 60 * 1000).toISOString()
    const latestKickoff = new Date(now + 36 * 60 * 60 * 1000).toISOString()

    const { data: rawEvents, error: eventsError } = await service
      .from('events')
      .select('id, title, date_time, meet_time, team_id, teams(name)')
      .gte('date_time', earliest)
      .lte('date_time', latestKickoff)
      .neq('event_status', 'cancelled')
      .order('date_time')
    if (eventsError) throw eventsError

    const events = ((rawEvents ?? []) as EventRow[]).filter((event) => {
      const hoursUntil = (new Date(event.meet_time ?? event.date_time).getTime() - now) / 3_600_000
      return hoursUntil >= 20 && hoursUntil <= 25
    })
    if (events.length === 0) return { events: 0, players: 0, recipients: 0 }

    const eventIds = events.map((event) => event.id)
    const [{ data: pendingRows, error: pendingError }, { data: sentRows, error: sentError }] = await Promise.all([
      service.from('attendance').select('event_id, player_id').in('event_id', eventIds).eq('status', 'pending'),
      service.from('attendance_reminders').select('event_id, player_id').in('event_id', eventIds),
    ])
    if (pendingError) throw pendingError
    if (sentError) throw sentError

    const sent = new Set((sentRows ?? []).map((row) => `${row.event_id}:${row.player_id}`))
    const due = (pendingRows ?? []).filter((row) => !sent.has(`${row.event_id}:${row.player_id}`))
    const playerIds = [...new Set(due.map((row) => row.player_id))]
    if (playerIds.length === 0) return { events: events.length, players: 0, recipients: 0 }

    const [parentResult, playerResult] = await Promise.all([
      service.from('player_parents').select('player_id, parent_id').in('player_id', playerIds),
      service.from('profiles').select('id, linked_player_id').in('linked_player_id', playerIds),
    ])
    if (parentResult.error) throw parentResult.error
    if (playerResult.error) throw playerResult.error

    const usersByPlayer = new Map<string, Set<string>>()
    const addUser = (playerId: string, userId: string) => {
      const users = usersByPlayer.get(playerId) ?? new Set<string>()
      users.add(userId)
      usersByPlayer.set(playerId, users)
    }
    for (const link of parentResult.data ?? []) addUser(link.player_id, link.parent_id)
    for (const profile of playerResult.data ?? []) {
      if (profile.linked_player_id) addUser(profile.linked_player_id, profile.id)
    }

    let remindedPlayers = 0
    const notifiedUsers = new Set<string>()
    for (const event of events) {
      const dueForEvent = due.filter((row) => row.event_id === event.id)
      const userIds = [...new Set(dueForEvent.flatMap((row) => [...(usersByPlayer.get(row.player_id) ?? [])]))]
      if (userIds.length === 0) continue

      const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
          'x-internal-secret': expectedSecret,
        },
        body: JSON.stringify({
          userIds,
          title: `${teamName(event)} availability`,
          body: `Please confirm attendance for ${event.title} before ${eventTime(event)}.`,
          url: '/',
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) throw new Error(`Notification delivery returned ${response.status}.`)

      const { error: recordError } = await service.from('attendance_reminders').insert(
        dueForEvent.map((row) => ({ event_id: row.event_id, player_id: row.player_id })),
      )
      if (recordError) throw recordError
      remindedPlayers += dueForEvent.length
      userIds.forEach((userId) => notifiedUsers.add(userId))
    }

    return { events: events.length, players: remindedPlayers, recipients: notifiedUsers.size }
  },
}))
