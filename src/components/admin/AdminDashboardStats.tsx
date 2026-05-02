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
  const bg =
    variant === 'green' ? 'bg-[#1565ff]' : variant === 'orange' ? 'bg-[#f18a3f]' : 'bg-slate-950'
  const textMain = variant === 'orange' ? 'text-slate-950' : 'text-white'
  const textSub = variant === 'orange' ? 'text-slate-800/70' : 'text-white/70'

  return (
    <div className={`rounded-3xl ${bg} p-4`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${textSub}`}>{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${textMain}`}>{value}</p>
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
