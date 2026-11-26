import assert from 'node:assert/strict'
import test from 'node:test'
import { resultFromTeamPerspective } from '../src/utils/matchResults.ts'

test('treats the away score as the team score for away fixtures', () => {
  assert.deepEqual(
    resultFromTeamPerspective({ homeAway: 'away' }, { homeScore: 0, awayScore: 5 }),
    { goalsFor: 5, goalsAgainst: 0, outcome: 'W' },
  )
})

test('treats the home score as the team score for home and legacy fixtures', () => {
  assert.equal(resultFromTeamPerspective({ homeAway: 'home' }, { homeScore: 2, awayScore: 1 }).outcome, 'W')
  assert.equal(resultFromTeamPerspective({ homeAway: null }, { homeScore: 1, awayScore: 3 }).outcome, 'L')
})
