export interface TeamRecord {
  id: string
  name: string
  ageGroup: string
  coaches: string[]
  players: string[]
  playerCount: number
  coachCount: number
}

export interface PlayerRecord {
  id: string
  name: string
  dob: string
  parentIds: string[]
  teams: string[]
}

export interface TeamFormInput {
  name: string
  ageGroup: string
}

export interface PlayerFormInput {
  name: string
  dob: string
  teamId: string
}

export type EventType = 'training' | 'match'

export type AttendanceStatus = 'yes' | 'no' | 'pending'

export type RecurrencePattern = 'weekly' | 'fortnightly'

export interface RecurrenceOptions {
  pattern: RecurrencePattern
  weeks: number
}

export interface EventRecord {
  id: string
  teamId: string
  title: string
  type: EventType
  dateTime: string
  location: string
  recurrenceGroupId: string | null
}

export interface AttendanceRecord {
  id: string
  eventId: string
  playerId: string
  status: AttendanceStatus
}

export interface EventFormInput {
  teamId: string
  title: string
  type: EventType
  dateTime: string
  location: string
}

// Groups (hierarchical club sections, e.g. Academy → Boys / Girls)
export interface GroupRecord {
  id: string
  name: string
  parentId: string | null
  /** Team IDs directly assigned to this group (not recursive). */
  teamIds: string[]
}

export interface GroupFormInput {
  name: string
  parentId: string | null
}

export interface MessageRecord {
  id: string
  /** Null for group or club-wide messages. */
  teamId: string | null
  /** Set when this message is a group broadcast. */
  groupId: string | null
  senderId: string
  content: string
  timestamp: string
}

export interface MessageFormInput {
  /** Exactly one of teamId / groupId should be set, or both null for club-wide. */
  teamId: string | null
  groupId: string | null
  senderId: string
  content: string
}

export interface ResultRecord {
  id: string
  eventId: string
  homeScore: number
  awayScore: number
  notes: string
}

export interface ResultFormInput {
  homeScore: number
  awayScore: number
  notes: string
}

export interface AttendanceStat {
  playerId: string
  playerName: string
  /** Events attended (status = 'yes') */
  attended: number
  /** Past events with an attendance record */
  total: number
  /** Percentage 0-100, null if no past events */
  rate: number | null
}

export interface AuditLogRecord {
  id: string
  actorId: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  summary: string
  timestamp: string
}
