export interface ReminderRunResult {
  events: number
  players: number
  recipients: number
}

export interface ReminderHandlerDependencies {
  isInternal: (request: Request) => boolean
  run: () => Promise<ReminderRunResult>
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function createReminderHandler(dependencies: ReminderHandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
    if (!dependencies.isInternal(request)) return json({ error: 'Not authorised.' }, 401)

    try {
      return json(await dependencies.run())
    } catch {
      return json({ error: 'Attendance reminders could not be processed.' }, 500)
    }
  }
}
