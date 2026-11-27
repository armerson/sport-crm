import { supabase } from '../lib/supabase.ts'
import { safeClientRoute, sanitizeClientErrorText } from '../utils/clientError.ts'

type ClientErrorInput = {
  error: unknown
  source: string
}

const recentReports = new Map<string, number>()
let reporting = false
let installed = false

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: sanitizeClientErrorText(`${error.name}: ${error.message}`, 1000),
      stack: sanitizeClientErrorText(error.stack ?? '', 8000) || null,
    }
  }

  return {
    message: sanitizeClientErrorText(error, 1000) || 'Unknown browser error',
    stack: null,
  }
}

export async function reportClientError({ error, source }: ClientErrorInput): Promise<void> {
  if (!supabase || reporting) return

  const details = errorDetails(error)
  const signature = `${source}:${details.message}:${safeClientRoute(window.location)}`
  const now = Date.now()
  if ((recentReports.get(signature) ?? 0) > now - 60_000) return
  recentReports.set(signature, now)

  reporting = true
  try {
    await supabase.rpc('report_client_error', {
      p_message: details.message,
      p_stack: details.stack,
      p_source: sanitizeClientErrorText(source, 500),
      p_route: safeClientRoute(window.location),
      p_user_agent: sanitizeClientErrorText(navigator.userAgent, 1000),
      p_app_version: __APP_VERSION__,
    })
  } catch {
    // Error reporting must never interrupt or recursively report the user journey.
  } finally {
    reporting = false
  }
}

export function installClientErrorMonitoring(): void {
  if (installed) return
  installed = true

  window.addEventListener('error', (event) => {
    void reportClientError({ error: event.error ?? event.message, source: 'window.error' })
  })

  window.addEventListener('unhandledrejection', (event) => {
    void reportClientError({ error: event.reason, source: 'unhandledrejection' })
  })
}

