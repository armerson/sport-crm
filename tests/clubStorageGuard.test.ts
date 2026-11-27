import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// Browser storage that belongs to a club must go through src/clubos/runtime.ts
// (clubLocalStorage, clubSessionStorage, readClubPreference,
// writeClubPreference) so multi-club mode keeps each club's data apart.
// Files listed here are deliberately device-wide, not club data.
const DEVICE_WIDE = new Set([
  'src/components/ui/InstallBanner.tsx', // installing the app is per device
])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

test('club data never uses browser storage directly', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const offenders = sourceFiles(join(root, 'src'))
    .map((path) => relative(root, path))
    .filter((path) => !path.startsWith('src/clubos/') && !DEVICE_WIDE.has(path))
    .flatMap((path) =>
      readFileSync(join(root, path), 'utf8')
        .split('\n')
        .map((line, index) => ({ line: line.trim(), at: `${path}:${index + 1}` }))
        .filter(({ line }) => !line.startsWith('//') && /\b(localStorage|sessionStorage)\s*[.[]/.test(line))
        .map(({ at }) => at),
    )
  assert.deepEqual(offenders, [], 'Use clubLocalStorage()/readClubPreference() from src/clubos/runtime.ts')
})
