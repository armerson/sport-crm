import test from 'node:test'
import assert from 'node:assert/strict'
import { meetTimeFromMinutesBefore, minutesBeforeFromMeetTime, validateSupportingTimes } from '../src/utils/eventTimes.ts'

const start = '2026-09-19T09:45:00.000Z'

test('optional event times accept a meet before kickoff and finish after it', () => {
  assert.equal(validateSupportingTimes(start, '2026-09-19T09:00:00.000Z', '2026-09-19T11:45:00.000Z'), null)
  assert.equal(validateSupportingTimes(start, '', ''), null)
})

test('optional event times reject an arrival after kickoff or an early finish', () => {
  assert.match(validateSupportingTimes(start, '2026-09-19T10:00:00.000Z', '') ?? '', /Meet time/)
  assert.match(validateSupportingTimes(start, '', '2026-09-19T09:30:00.000Z') ?? '', /Finish time/)
})

test('meet-before options calculate and restore five-minute offsets', () => {
  assert.equal(meetTimeFromMinutesBefore(start, '45'), '2026-09-19T09:00:00.000Z')
  assert.equal(minutesBeforeFromMeetTime(start, '2026-09-19T09:00:00.000Z'), '45')
  assert.equal(meetTimeFromMinutesBefore(start, '7'), '')
  assert.equal(meetTimeFromMinutesBefore(start, ''), '')
})
