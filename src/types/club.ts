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

export interface EventRecord {
  id: string
  teamId: string
  title: string
  type: EventType
  dateTime: string
  location: string
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

export interface MessageRecord {
  id: string
  teamId: string
  senderId: string
  content: string
  timestamp: string
}

export interface MessageFormInput {
  teamId: string
  senderId: string
  content: string
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