import type { AuditLogRecord } from '../types/club.ts'
import { mapAuditLogRow, requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export function subscribeToAuditLogs(
  onData: (logs: AuditLogRecord[]) => void,
  onError: (message: string) => void,
) {
  const client = requireSupabase()

  return subscribeToTables('audit-logs', ['audit_logs'], async () => {
    const { data, error } = await client
      .from('audit_logs')
      .select('id, actor_id, actor_name, action, target_type, target_id, summary, created_at')
      .order('created_at', { ascending: false })
      .limit(25)

    if (error) {
      onError('Unable to load audit activity right now.')
      return
    }

    onData((data ?? []).map((row) => mapAuditLogRow(row as Record<string, unknown>)))
  })
}