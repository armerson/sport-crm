import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ageOnDate } from '../src/utils/birthDate.ts'
const today = new Date(2026, 8, 13)
test('adult registration respects the eighteenth birthday', () => {
  assert.equal(ageOnDate('2008-09-13', today), 18)
  assert.equal(ageOnDate('2008-09-14', today), 17)
})
test('registration rejects future and impossible birth dates', () => {
  for (const date of ['', '2027-01-01', '2014-02-31', '2014-13-01', 'invalid']) assert.equal(ageOnDate(date, today), null)
  assert.equal(ageOnDate('2012-02-29', today), 14)
})
