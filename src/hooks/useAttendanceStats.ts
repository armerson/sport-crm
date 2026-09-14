import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase.ts'
import { fetchAttendanceStats } from '../services/coachClub.ts'
import type { AttendanceStat } from '../types/club.ts'

/** Keep late responses from a previous squad out of the current squad's stats. */
export function useAttendanceStats(teamId: string) {
  const [result, setResult] = useState<{ teamId: string; stats: AttendanceStat[]; error: string | null } | null>(null)
  const enabled = Boolean(teamId && isSupabaseConfigured)
  useEffect(() => {
    if (!enabled) return
    let current = true
    void fetchAttendanceStats(teamId)
      .then((stats) => { if (current) setResult({ teamId, stats, error: null }) })
      .catch(() => { if (current) setResult({ teamId, stats: [], error: 'Unable to load attendance statistics.' }) })
    return () => { current = false }
  }, [teamId, enabled])

  const current = enabled && result?.teamId === teamId ? result : null
  return { stats: current?.stats ?? [], loading: enabled && !current, error: current?.error ?? null }
}
