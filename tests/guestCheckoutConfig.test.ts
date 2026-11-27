import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isGuestCheckoutEnabled } from '../src/utils/guestCheckoutConfig.ts'

test('guest checkout is off unless the deployment opts in', () => {
  assert.equal(isGuestCheckoutEnabled(undefined), false)
  assert.equal(isGuestCheckoutEnabled(''), false)
  assert.equal(isGuestCheckoutEnabled('false'), false)
  assert.equal(isGuestCheckoutEnabled('1'), false)
  assert.equal(isGuestCheckoutEnabled('yes'), false)
  assert.equal(isGuestCheckoutEnabled('true'), true)
  assert.equal(isGuestCheckoutEnabled(' TRUE '), true)
})
