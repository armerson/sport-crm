import { supabase, supabaseConfigError } from '../lib/supabase.ts'
import type { UserProfile, UserRole } from '../types/auth.ts'
import type { AttendanceRecord, AuditLogRecord, EventRecord, GroupRecord, LineupEntry, MessageRecord, PlayerRecord, ResultRecord, TeamRecord } from '../types/club.ts'

export function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigError)
  }

  return supabase
}

export function normalizeRoles(value: unknown): UserRole[] {
  if (Array.isArray(value)) {
    const valid = value.filter((r): r is UserRole => r === 'admin' || r === 'coach' || r === 'parent')
    return valid.length > 0 ? valid : ['parent']
  }

  // Backward-compat: handle a bare string from older rows
  if (value === 'admin' || value === 'coach') return [value]
  return ['parent']
}

function normalizeRelationIds<T extends string>(value: unknown, key: string): T[] {
  return Array.isArray(value)
    ? value
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return ''
          }

          const relationValue = (entry as Record<string, unknown>)[key]
          return typeof relationValue === 'string' ? relationValue : ''
        })
        .filter((entry): entry is T => Boolean(entry))
    : []
}

export function mapProfileRow(row: Record<string, unknown>, relations?: { teams?: string[]; children?: string[] }): UserProfile {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    name: typeof row.name === 'string' && row.name.trim().length > 0 ? row.name : 'Club member',
    email: typeof row.email === 'string' ? row.email : '',
    roles: normalizeRoles(row.roles),
    teams: relations?.teams ?? [],
    children: relations?.children ?? [],
  }
}

export function mapTeamRow(row: Record<string, unknown>): TeamRecord {
  const coaches = normalizeRelationIds<string>(row.team_coaches, 'coach_id')
  const players = normalizeRelationIds<string>(row.player_teams, 'player_id')

  return {
    id: typeof row.id === 'string' ? row.id : '',
    name: typeof row.name === 'string' ? row.name : 'Untitled team',
    ageGroup: typeof row.age_group === 'string' ? row.age_group : 'Unknown',
    coaches,
    players,
    playerCount: players.length,
    coachCount: coaches.length,
  }
}

export function mapPlayerRow(row: Record<string, unknown>): PlayerRecord {
  const parentIds = normalizeRelationIds<string>(row.player_parents, 'parent_id')
  const teams = normalizeRelationIds<string>(row.player_teams, 'team_id')

  return {
    id: typeof row.id === 'string' ? row.id : '',
    name: typeof row.name === 'string' ? row.name : 'Unnamed player',
    dob: typeof row.dob === 'string' ? row.dob : '',
    parentIds,
    teams,
    position: typeof row.position === 'string' ? row.position : null,
    photoUrl: typeof row.photo_url === 'string' ? row.photo_url : null,
    nationality: typeof row.nationality === 'string' ? row.nationality : null,
    dominantFoot: (row.dominant_foot as import('../types/club.ts').PlayerRecord['dominantFoot']) ?? null,
    jerseyNumber: typeof row.jersey_number === 'number' ? row.jersey_number : null,
    bio: typeof row.bio === 'string' ? row.bio : null,
    medicalNotes: typeof row.medical_notes === 'string' ? row.medical_notes : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export function mapEventRow(row: Record<string, unknown>): EventRecord {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    teamId: typeof row.team_id === 'string' ? row.team_id : '',
    title: typeof row.title === 'string' ? row.title : 'Untitled event',
    type: row.type === 'match' ? 'match' : 'training',
    dateTime: typeof row.date_time === 'string' ? row.date_time : '',
    location: typeof row.location === 'string' ? row.location : '',
    recurrenceGroupId: typeof row.recurrence_group_id === 'string' ? row.recurrence_group_id : null,
  }
}

export function mapAttendanceRow(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    eventId: typeof row.event_id === 'string' ? row.event_id : '',
    playerId: typeof row.player_id === 'string' ? row.player_id : '',
    status: row.status === 'yes' || row.status === 'no' ? row.status : 'pending',
  }
}

export function mapMessageRow(row: Record<string, unknown>): MessageRecord {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    teamId: typeof row.team_id === 'string' ? row.team_id : null,
    groupId: typeof row.group_id === 'string' ? row.group_id : null,
    senderId: typeof row.sender_id === 'string' ? row.sender_id : '',
    content: typeof row.content === 'string' ? row.content : '',
    timestamp: typeof row.created_at === 'string' ? row.created_at : '',
  }
}

export function mapGroupRow(row: Record<string, unknown>): GroupRecord {
  const teamIds = normalizeRelationIds<string>(row.group_teams, 'team_id')
  return {
    id: typeof row.id === 'string' ? row.id : '',
    name: typeof row.name === 'string' ? row.name : 'Untitled group',
    parentId: typeof row.parent_id === 'string' ? row.parent_id : null,
    teamIds,
  }
}

export function mapResultRow(row: Record<string, unknown>): ResultRecord {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    eventId: typeof row.event_id === 'string' ? row.event_id : '',
    homeScore: typeof row.home_score === 'number' ? row.home_score : 0,
    awayScore: typeof row.away_score === 'number' ? row.away_score : 0,
    notes: typeof row.notes === 'string' ? row.notes : '',
  }
}

export function mapLineupRow(row: Record<string, unknown>): LineupEntry {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    eventId: typeof row.event_id === 'string' ? row.event_id : '',
    playerId: typeof row.player_id === 'string' ? row.player_id : '',
    isStarting: typeof row.is_starting === 'boolean' ? row.is_starting : true,
  }
}

export function mapAuditLogRow(row: Record<string, unknown>): AuditLogRecord {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    actorId: typeof row.actor_id === 'string' ? row.actor_id : '',
    actorName: typeof row.actor_name === 'string' ? row.actor_name : 'Unknown admin',
    action: typeof row.action === 'string' ? row.action : 'unknown',
    targetType: typeof row.target_type === 'string' ? row.target_type : 'unknown',
    targetId: typeof row.target_id === 'string' ? row.target_id : '',
    summary: typeof row.summary === 'string' ? row.summary : 'No summary available.',
    timestamp: typeof row.created_at === 'string' ? row.created_at : '',
  }
}

export async function fetchCurrentProfile() {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()

  if (userError || !userData.user) {
    throw new Error('Unable to resolve the current user.')
  }

  const userId = userData.user.id
  const [{ data: profileRow, error: profileError }, { data: coachRows, error: coachError }, { data: childRows, error: childError }] = await Promise.all([
    client.from('profiles').select('id, name, email, roles').eq('id', userId).single(),
    client.from('team_coaches').select('team_id').eq('coach_id', userId),
    client.from('player_parents').select('player_id').eq('parent_id', userId),
  ])

  if (profileError || !profileRow) {
    throw new Error(profileError?.message ?? 'Unable to load the current profile.')
  }

  if (coachError) {
    throw new Error(coachError.message)
  }

  if (childError) {
    throw new Error(childError.message)
  }

  return mapProfileRow(profileRow, {
    teams: Array.isArray(coachRows) ? coachRows.map((row) => row.team_id).filter(Boolean) : [],
    children: Array.isArray(childRows) ? childRows.map((row) => row.player_id).filter(Boolean) : [],
  })
}

export async function writeAuditLog(input: {
  action: string
  targetType: string
  targetId: string
  summary: string
}) {
  const client = requireSupabase()
  const profile = await fetchCurrentProfile()

  const { error } = await client.from('audit_logs').insert({
    actor_id: profile.id,
    actor_name: profile.name,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    summary: input.summary,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export function subscribeToTables(channelName: string, tables: string[], refetch: () => Promise<void>) {
  const client = requireSupabase()
  void refetch()

  // Use a UUID suffix so each invocation always gets a fresh channel.
  // client.channel(name) returns the EXISTING channel when the name matches —
  // so reusing the same name (or the same Date.now() millisecond, which React
  // Strict Mode can trigger in back-to-back cleanup/setup cycles) hands back
  // an already-joining channel and causes "cannot add postgres_changes callbacks
  // after subscribe()". A random UUID is guaranteed unique per call.
  const uniqueName = `${channelName}-${crypto.randomUUID()}`
  const channel = client.channel(uniqueName)

  tables.forEach((table) => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => {
        void refetch()
      },
    )
  })

  channel.subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
