export interface TeamRecord {
  id: string
  name: string
  ageGroup: string
  coaches: string[]
  players: string[]
  playerCount: number
  coachCount: number
}

export type PlayerDocumentType = 'birth_certificate' | 'passport' | 'other'

export interface PlayerDocument {
  id: string
  playerId: string
  type: PlayerDocumentType
  label: string | null
  storagePath: string
  uploadedBy: string | null
  uploadedAt: string
  verified: boolean
  verifiedBy: string | null
  verifiedAt: string | null
}

export interface EmergencyContact {
  id: string
  playerId: string
  name: string
  relationship: string
  phone: string
  email: string | null
  isPrimary: boolean
  createdAt: string
}

export type DominantFoot = 'left' | 'right' | 'both'

export interface PlayerRecord {
  id: string
  name: string
  dob: string
  parentIds: string[]
  teams: string[]
  // Profile fields (nullable — may not be filled in yet)
  position: string | null
  photoUrl: string | null
  nationality: string | null
  dominantFoot: DominantFoot | null
  jerseyNumber: number | null
  bio: string | null
  medicalNotes: string | null
  updatedAt: string | null
}

export interface PlayerProfileInput {
  position: string
  nationality: string
  dominantFoot: DominantFoot | ''
  jerseyNumber: string
  bio: string
  medicalNotes: string
}

export interface EmergencyContactInput {
  name: string
  relationship: string
  phone: string
  email: string
  isPrimary: boolean
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

export interface LineupEntry {
  id: string
  eventId: string
  playerId: string
  isStarting: boolean
}

export interface MotmVote {
  id: string
  eventId: string
  voterId: string
  playerId: string
}

/** Tally of votes per player for one event */
export interface MotmTally {
  playerId: string
  playerName: string
  votes: number
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
