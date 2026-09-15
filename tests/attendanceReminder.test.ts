import test from 'node:test'
import assert from 'node:assert/strict'
import { createReminderHandler } from '../supabase/functions/scheduled-attendance-reminders/handler.ts'

function request(method = 'POST', secret = 'valid-secret') {
  return new Request('https://example.invalid/reminders', {
    method,
    headers: { 'x-cron-secret': secret },
  })
}

test('scheduled attendance reminders require the private job secret', async () => {
  let runs = 0
  const handler = createReminderHandler({
    isInternal: (incoming) => incoming.headers.get('x-cron-secret') === 'valid-secret',
    run: async () => { runs += 1; return { events: 1, players: 2, recipients: 2 } },
  })

  assert.equal((await handler(request('GET'))).status, 405)
  assert.equal((await handler(request('POST', 'wrong'))).status, 401)
  assert.equal(runs, 0)
  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { events: 1, players: 2, recipients: 2 })
  assert.equal(runs, 1)
})

test('scheduled attendance reminder failures return a safe response', async () => {
  const handler = createReminderHandler({
    isInternal: () => true,
    run: async () => { throw new Error('sensitive backend detail') },
  })
  const response = await handler(request())
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'Attendance reminders could not be processed.' })
})
