import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../../lib/supabase.ts'
import { fetchClubAttendanceRate } from '../../services/adminClub.ts'
import type { UserProfile } from '../../types/auth.ts'
import type { EventRecord, TeamRecord } from '../../types/club.ts'

interface AdminDashboardStatsProps {
  teams: TeamRecord[]
  events: EventRecord[]
  coaches: UserProfile[]
  parents: UserProfile[]
}

interface StatCardProps {
  value: string | number
  label: string
  variant?: 'green' | 'orange' | 'dark'
}

function StatCard({ value, label, variant = 'dark' }: StatCardProps) {
  const accent = variant === 'green' ? 'bg-[var(--ui-accent)]' : variant === 'orange' ? 'bg-amber-500' : 'bg-slate-300'

  return (
    <div className="ui-panel relative overflow-hidden p-4 sm:p-5">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ui-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-[var(--ui-ink)]">{value}</p>
    </div>
  )
}

export function AdminDashboardStats({ teams, events, coaches, parents }: AdminDashboardStatsProps) {
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void fetchClubAttendanceRate()
      .then(({ rate }) => setAttendanceRate(rate))
      .catch(() => {/* non-critical */})
  }, [])

  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const totalPlayers = teams.reduce((sum, t) => sum + t.playerCount, 0)
  const coachesAssignedAcrossTeams = new Set(teams.flatMap((t) => t.coaches)).size
  const coachStatCount = Math.max(coaches.length, coachesAssignedAcrossTeams)
  const eventsThisWeek = events.filter((e) => {
    const d = new Date(e.dateTime)
    return d >= now && d <= weekLater
  }).length

  const rateVariant: StatCardProps['variant'] =
    attendanceRate === null ? 'dark' : attendanceRate >= 75 ? 'green' : attendanceRate >= 50 ? 'orange' : 'dark'

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard value={totalPlayers} label="Players" variant="green" />
      <StatCard value={teams.length} label="Teams" />
      <StatCard value={coachStatCount} label="Coaches" />
      <StatCard value={parents.length} label="Parents" />
      <StatCard
        value={eventsThisWeek > 0 ? eventsThisWeek : '0'}
        label="Events this week"
        variant={eventsThisWeek > 0 ? 'orange' : 'dark'}
      />
      <StatCard
        value={attendanceRate !== null ? `${attendanceRate}%` : '—'}
        label="Attendance (60d)"
        variant={rateVariant}
      />
    </div>
  )
}
