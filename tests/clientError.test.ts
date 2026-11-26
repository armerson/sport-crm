import assert from 'node:assert/strict'
import test from 'node:test'
import { safeClientRoute, sanitizeClientErrorText } from '../src/utils/clientError.ts'

test('client diagnostics remove URL query strings and fragments', () => {
  const input = 'Failed at https://club.example/path?token=secret#private and https://api.example/items?id=42'
  const output = sanitizeClientErrorText(input, 1000)

  assert.equal(output, 'Failed at https://club.example/path and https://api.example/items')
  assert.equal(output.includes('secret'), false)
})

test('client diagnostics enforce field limits and safe routes', () => {
  assert.equal(sanitizeClientErrorText('x'.repeat(20), 8), 'xxxxxxxx')
  assert.equal(safeClientRoute({ pathname: '/players/123' } as Location), '/players/123')
  assert.equal(safeClientRoute({ pathname: '' } as Location), '/')
})
