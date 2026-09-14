import test from 'node:test'
import assert from 'node:assert/strict'
import { createPushHandler, isTrustedPushEndpoint, type PushPayload } from '../supabase/functions/send-push-notification/handler.ts'

const recipient = 'dd202609-1400-4000-8000-000000000001'
const other = 'dd202609-1400-4000-8000-000000000002'
function setup(roles = ['coach']) {
  const sent: PushPayload[] = []
  const handler = createPushHandler({
    authenticate: async (token) => token === 'valid' ? { id: 'test-actor', roles, linkedPlayerId: null } : null,
    allowedRecipients: async () => new Set([recipient]),
    deliver: async (payload) => { sent.push(payload); return { sent: 0 } },
  })
  const request = (body: unknown, token: string | null = 'valid') => handler(new Request('https://example.invalid/push', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  }))
  return { request, sent }
}
const payload = { userIds: [recipient], title: 'Test', body: 'Synthetic test only', url: '/' }

test('notifications reject missing and invalid sessions before delivery', async () => {
  const { request, sent } = setup()
  assert.equal((await request(payload, null)).status, 401)
  assert.equal((await request(payload, 'invalid')).status, 401)
  assert.equal(sent.length, 0)
})
test('members cannot notify unrelated recipients, even in a mixed batch', async () => {
  const { request, sent } = setup()
  assert.equal((await request({ ...payload, userIds: [recipient, other] })).status, 403)
  assert.equal(sent.length, 0)
})
test('team notifications deduplicate recipients and preserve content', async () => {
  const { request, sent } = setup()
  assert.equal((await request({ ...payload, userIds: [recipient, recipient] })).status, 200)
  assert.deepEqual(sent[0].userIds, [recipient])
  assert.equal(sent[0].body, payload.body)
})
test('admins can notify across teams', async () => {
  const { request, sent } = setup(['admin'])
  assert.equal((await request({ ...payload, userIds: [other] })).status, 200)
  assert.equal(sent.length, 1)
})
test('notifications reject unsafe destinations and malformed payloads', async () => {
  const { request, sent } = setup()
  for (const bad of [null, {}, { ...payload, url: '//example.com' }, { ...payload, url: '/\\example.com' }, { ...payload, userIds: [123] }, { ...payload, body: 'x'.repeat(2001) }]) {
    assert.equal((await request(bad)).status, 400)
  }
  assert.equal(sent.length, 0)
})

test('push subscriptions cannot direct server requests to arbitrary hosts', () => {
  assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'), true)
  assert.equal(isTrustedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true)
  assert.equal(isTrustedPushEndpoint('https://web.push.apple.com/example'), true)
  for (const endpoint of ['http://fcm.googleapis.com/example', 'https://127.0.0.1/private', 'https://fcm.googleapis.com.evil.example/', 'https://user:pass@fcm.googleapis.com/', 'https://example.com/']) {
    assert.equal(isTrustedPushEndpoint(endpoint), false)
  }
})
