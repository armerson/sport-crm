import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseClubDirectory, filterDirectory, clubEntryUrl, parsePublicClubSite } from '../src/utils/clubDirectory.ts'

const entry = { code: 'test-club', name: 'Test Club', origin: 'https://club.example', website: 'https://club.example/club-website' }
test('directory accepts configured clubs and generates fixed entry URLs', () => {
  const [club] = parseClubDirectory(JSON.stringify([entry]))
  assert.equal(clubEntryUrl(club, 'login'), 'https://club.example/login')
  assert.equal(clubEntryUrl(club, 'register'), 'https://club.example/register')
  assert.equal(club.website, entry.website)
  assert.equal(filterDirectory([club], 'TEST').length, 1)
  assert.equal(filterDirectory([club], 'other').length, 0)
  assert.deepEqual(parseClubDirectory(undefined), [])
})
test('directory rejects unsafe and ambiguous destinations', () => {
  for (const origin of ['http://club.example', 'javascript:alert(1)', 'https://user@club.example', 'https://club.example/path', 'https://club.example?next=bad', 'https://club.example:1234']) {
    assert.throws(() => parseClubDirectory(JSON.stringify([{ ...entry, origin }])))
  }
  assert.throws(() => parseClubDirectory(JSON.stringify([entry, entry])))
  assert.throws(() => parseClubDirectory(JSON.stringify([{ ...entry, website: 'javascript:alert(1)' }])))
})
test('public site is opt-in and validates public content', () => {
  const site = { name: 'Test Club', introduction: 'Welcome', about: 'About the club', programmes: ['Youth football'], primaryColor: '#123456', contactEmail: 'info@club.example' }
  assert.equal(parsePublicClubSite(undefined), null)
  assert.deepEqual(parsePublicClubSite(JSON.stringify(site)), site)
  assert.throws(() => parsePublicClubSite(JSON.stringify({ ...site, contactEmail: 'bad@example.com?body=spam' })))
  assert.throws(() => parsePublicClubSite(JSON.stringify({ ...site, primaryColor: 'url(bad)' })))
})
