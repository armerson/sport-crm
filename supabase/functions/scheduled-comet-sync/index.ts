import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

type SyncChange = { title?: string; summary?: string }
type SyncResult = { synced?: number; changes?: SyncChange[]; error?: string }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const expectedSecret = Deno.env.get('COMET_SYNC_SECRET') ?? ''
  const suppliedSecret = request.headers.get('x-cron-secret') ?? ''
  if (expectedSecret.length < 32 || suppliedSecret !== expectedSecret) return json({ error: 'Not authorised.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Club data service is not configured.' }, 500)

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: teams, error: teamsError } = await service
    .from('teams')
    .select('id, name')
    .is('archived_at', null)
    .not('comet_team_id', 'is', null)
    .not('comet_competition_id', 'is', null)
    .order('name')

  if (teamsError) return json({ error: 'Configured teams could not be loaded.' }, 500)

  const outcomes: Array<{ teamId: string; teamName: string; ok: boolean; synced: number; changed: number; notified: number; error?: string }> = []
  for (const team of teams ?? []) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-comet-fixtures`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
          'x-internal-secret': expectedSecret,
        },
        body: JSON.stringify({ teamId: team.id }),
        signal: AbortSignal.timeout(25_000),
      })
      const result = await response.json() as SyncResult
      if (!response.ok) throw new Error(result.error ?? `Sync returned ${response.status}`)

      const changes = Array.isArray(result.changes) ? result.changes : []
      let notified = 0
      if (changes.length > 0) {
        const { data: playerLinks } = await service.from('player_teams').select('player_id').eq('team_id', team.id)
        const playerIds = [...new Set((playerLinks ?? []).map((link) => link.player_id))]
        if (playerIds.length > 0) {
          const [familyLinks, playerProfiles] = await Promise.all([
            service.from('player_parents').select('parent_id').in('player_id', playerIds),
            service.from('profiles').select('id').in('linked_player_id', playerIds),
          ])
          const userIds = [...new Set([
            ...(familyLinks.data ?? []).map((link) => link.parent_id),
            ...(playerProfiles.data ?? []).map((profile) => profile.id),
          ])]
          if (userIds.length > 0) {
            const summaries = changes.slice(0, 2).map((change) => `${change.title ?? 'Fixture'}: ${change.summary ?? 'details changed'}`)
            const remaining = changes.length - summaries.length
            const message = `${summaries.join(' · ')}${remaining > 0 ? ` · ${remaining} more update${remaining === 1 ? '' : 's'}` : ''}`
            const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                apikey: serviceRoleKey,
                'Content-Type': 'application/json',
                'x-internal-secret': expectedSecret,
              },
              body: JSON.stringify({ userIds, title: `${team.name} fixture update`, body: message, url: '/?view=parent' }),
              signal: AbortSignal.timeout(15_000),
            })
            if (pushResponse.ok) notified = userIds.length
          }
        }
      }
      outcomes.push({ teamId: team.id, teamName: team.name, ok: true, synced: result.synced ?? 0, changed: changes.length, notified })
    } catch (error) {
      outcomes.push({
        teamId: team.id,
        teamName: team.name,
        ok: false,
        synced: 0,
        changed: 0,
        notified: 0,
        error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown sync error',
      })
    }
  }

  const failed = outcomes.filter((outcome) => !outcome.ok).length
  return json({ teams: outcomes.length, succeeded: outcomes.length - failed, failed, outcomes }, failed === outcomes.length && outcomes.length > 0 ? 502 : 200)
})
