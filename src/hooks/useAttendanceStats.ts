import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase.ts'
import { fetchAttendanceStats } from '../services/coachClub.ts'
import type { AttendanceStat } from '../types/club.ts'

/**
 * Fetches per-player attendance stats for a team (past events only).
 * Refreshes whenever teamId changes. Not real-time — recalculates on mount.
 */
export function useAttendanceStats(teamId: string) {
  const [stats, setStats] = useState<AttendanceStat[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!teamId || !isSupabaseConfigured) {
      setStats([])
      return
    }

    setLoading(true)
    void fetchAttendanceStats(teamId)
      .then(setStats)
      .finally(() => setLoading(false))
  }, [teamId])

  return { stats, loading }
}
