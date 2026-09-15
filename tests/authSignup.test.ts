import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isObscuredExistingSignup } from '../src/utils/authSignup.ts'

test('an obscured existing-email signup is not reported as a new account', () => {
  assert.equal(isObscuredExistingSignup({ identities: [] }), true)
  assert.equal(isObscuredExistingSignup({ identities: [{ id: 'new-identity' }] }), false)
  assert.equal(isObscuredExistingSignup(null), false)
})
