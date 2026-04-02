import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { subscribeToAuditLogs } from '../services/auditLogs.ts'
import type { AuditLogRecord } from '../types/club.ts'

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(!isSupabaseConfigured ? supabaseConfigError : null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    return subscribeToAuditLogs(
      (nextLogs) => {
        setError(null)
        setLogs(nextLogs)
        setLoading(false)
      },
      (message) => {
        setError(message)
        setLoading(false)
      },
    )
  }, [])

  return {
    logs,
    loading,
    error,
  }
}