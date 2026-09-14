import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicWebsiteUrl } from '../src/utils/website.ts'

test('each standalone club can configure its own website', () => {
  assert.equal(publicWebsiteUrl('https://example.org'), 'https://example.org/')
  assert.equal(publicWebsiteUrl(' https://example.org/teams '), 'https://example.org/teams')
})
test('missing or unsafe configuration does not render an unsafe link', () => {
  for (const value of [undefined, '', '/relative', 'javascript:alert(1)', 'data:text/html,hello', 'https://name:pass@example.org']) assert.equal(publicWebsiteUrl(value), null)
})
