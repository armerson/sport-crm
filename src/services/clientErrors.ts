import { requireSupabase, subscribeToTables } from './supabaseHelpers.ts'

export interface ClientErrorRecord {
  id: number
  message: string
  stack: string | null
  source: string | null
  route: string
  userAgent: string | null
  appVersion: string | null
  createdAt: string
}

export function subscribeToClientErrors(
  onData: (rows: ClientErrorRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const client = requireSupabase()

  return subscribeToTables('client-errors', ['client_error_logs'], async () => {
    const { data, error } = await client
      .from('client_error_logs')
      .select('id,message,stack,source,route,user_agent,app_version,created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      onError('Unable to load browser errors.')
      return
    }

    onData((data ?? []).map((row) => ({
      id: row.id as number,
      message: row.message as string,
      stack: typeof row.stack === 'string' ? row.stack : null,
      source: typeof row.source === 'string' ? row.source : null,
      route: row.route as string,
      userAgent: typeof row.user_agent === 'string' ? row.user_agent : null,
      appVersion: typeof row.app_version === 'string' ? row.app_version : null,
      createdAt: row.created_at as string,
    })))
  })
}

