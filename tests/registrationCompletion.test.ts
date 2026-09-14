import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completeRegistration, selfServiceRoles } from '../src/services/registrationCompletion.ts'
import { validateChildren } from '../src/utils/childRegistration.ts'
import type { UserProfile } from '../src/types/auth.ts'

const parent: UserProfile = { id: 'parent', name: 'Test Parent', email: 'test@example.invalid', roles: ['parent'], teams: [], children: [], linkedPlayerId: null }
const metadata = { signup_children: [{ name: 'First Child', dob: '2014-01-01' }, { name: 'Second Child', dob: '2016-01-01' }] }
function dependencies() {
  const calls: string[] = []
  const saved = new Map<string, string>()
  return { calls, saved, rpc: async (name: string) => { calls.push(name); return { error: null } }, clearMetadata: async () => { calls.push('clear'); return { error: null } }, storage: { getItem: (key: string) => saved.get(key) ?? null, removeItem: (key: string) => { saved.delete(key) } } }
}
test('signup completes all children before removing pending metadata', async () => {
  const deps = dependencies()
  assert.equal(await completeRegistration(metadata, parent, deps), true)
  assert.deepEqual(deps.calls, ['register_signup_children', 'clear'])
})
test('failed registration retains metadata and surfaces an actionable error', async () => {
  const deps = dependencies()
  await assert.rejects(completeRegistration(metadata, parent, { ...deps, rpc: async () => ({ error: { message: 'Unavailable' } }) }), /children could not be registered/)
  assert.deepEqual(deps.calls, [])
})
test('reload after successful child creation does not create duplicate children', async () => {
  const deps = dependencies()
  await completeRegistration(metadata, { ...parent, children: ['child-1', 'child-2'] }, deps)
  assert.deepEqual(deps.calls, ['clear'])
})
test('adult signup creates its player once and retry only clears metadata', async () => {
  const deps = dependencies()
  const player = { ...parent, roles: ['player'] as UserProfile['roles'] }
  const meta = { signup_account: 'player', player_dob: '1990-01-01' }
  await completeRegistration(meta, player, deps)
  assert.deepEqual(deps.calls, ['register_self_as_player', 'clear'])
  deps.calls.length = 0
  await completeRegistration(meta, { ...player, linkedPlayerId: 'player-1' }, deps)
  assert.deepEqual(deps.calls, ['clear'])
})
test('unsuccessful invites are kept for retry, including errors in response data', async () => {
  const deps = dependencies()
  deps.saved.set('pending_invite_code', 'code')
  const result = { ...deps, rpc: async () => ({ data: { error: 'Expired invite' }, error: null }) }
  await assert.rejects(completeRegistration({}, parent, result), /Expired invite/)
  assert.equal(deps.saved.get('pending_invite_code'), 'code')
})
test('a successful invite is removed only after redemption', async () => {
  const deps = dependencies(); deps.saved.set('pending_invite_code', 'code')
  assert.equal(await completeRegistration({}, parent, deps), true)
  assert.deepEqual(deps.calls, ['use_team_invite'])
  assert.equal(deps.saved.size, 0)
})
test('self-service metadata never grants staff privileges', () => {
  assert.deepEqual(selfServiceRoles({ roles: ['admin', 'coach'] }), ['parent'])
  assert.deepEqual(selfServiceRoles({ roles: ['admin', 'player'] }), ['player'])
})
test('a partially completed child list is rejected rather than silently filtered', () => {
  assert.throws(() => validateChildren([{ name: 'Valid Child', dob: '2014-01-01' }, { name: '', dob: '' }]), /Child 2/)
  assert.throws(() => validateChildren([{ name: 'Future Child', dob: '2999-01-01' }]), /date of birth/)
  assert.deepEqual(validateChildren([{ name: ' Child Name ', dob: '2014-01-01', custom: { consent: 'true' } }]), [{ name: 'Child Name', dob: '2014-01-01', custom: { consent: 'true' } }])
})
