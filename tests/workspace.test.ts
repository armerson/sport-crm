import { test } from 'node:test'
import assert from 'node:assert/strict'
import { availableRoles, resolveWorkspaceRole, safeReturnPath } from '../src/utils/workspace.ts'
import type { UserProfile } from '../src/types/auth.ts'

const profile: UserProfile = { id: 'coach', name: 'Test Coach', email: 'test@example.com', roles: ['coach'], teams: [], children: [], linkedPlayerId: null }

test('coach role resolves when the profile arrives after initial loading', () => {
  assert.equal(resolveWorkspaceRole(profile, null), 'coach')
  assert.equal(resolveWorkspaceRole(profile, 'admin'), 'coach')
})
test('multi-role links select only available workspaces', () => {
  const multi = { ...profile, roles: ['admin', 'coach'] as UserProfile['roles'], children: ['child'], linkedPlayerId: 'player' }
  assert.deepEqual(availableRoles(multi), ['admin', 'coach', 'player', 'parent'])
  assert.equal(resolveWorkspaceRole(multi, 'parent'), 'parent')
  assert.equal(resolveWorkspaceRole(multi, 'player'), 'player')
  assert.equal(resolveWorkspaceRole(multi, 'invalid'), 'admin')
})
test('sign-in preserves local registration and role links', () => {
  assert.equal(safeReturnPath('/register/parent'), '/register/parent')
  assert.equal(safeReturnPath('/?view=coach'), '/?view=coach')
  assert.equal(safeReturnPath('/register/team?from=website#details'), '/register/team?from=website#details')
})
test('sign-in rejects external, encoded and looping return destinations', () => {
  for (const value of [null, 'https://other.example', '//other.example', '/\\other.example', '/%2fother.example', '/%5cother.example', '/\n/other.example', '/%0a/other.example', '/login', '/login?next=/login', '/%']) {
    assert.equal(safeReturnPath(value), '/', String(value))
  }
})
