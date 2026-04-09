export function formatDateTime(value: string) {
  if (!value) return 'Date not set'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(parsed)
  const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parsed)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed)
  return `${weekday} ${dayMonth} · ${time}`
}

// ── Week-bucket utilities ──────────────────────────────────────────

export type WeekBucket = 'past' | 'today' | 'this-week' | 'next-week' | 'later'

export const BUCKET_LABELS: Record<WeekBucket, string> = {
  past:        'Past',
  today:       'Today',
  'this-week': 'This week',
  'next-week': 'Next week',
  later:       'Coming up',
}

export function getWeekBucket(dateTimeIso: string): WeekBucket {
  const now     = new Date()
  const event   = new Date(dateTimeIso)
  const today0  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const today24 = new Date(today0.getTime() + 86_400_000)

  // Monday of current week
  const dow      = now.getDay() // 0=Sun
  const toMon    = dow === 0 ? -6 : 1 - dow
  const monThis  = new Date(today0); monThis.setDate(today0.getDate() + toMon)
  const monNext  = new Date(monThis.getTime() + 7 * 86_400_000)
  const monAfter = new Date(monNext.getTime() + 7 * 86_400_000)

  if (event <  today0)   return 'past'
  if (event <  today24)  return 'today'
  if (event <  monNext)  return 'this-week'
  if (event <  monAfter) return 'next-week'
  return 'later'
}

export function groupByWeek<T extends { dateTime: string }>(
  items: T[],
  includePast = false,
): { bucket: WeekBucket; label: string; items: T[] }[] {
  const ORDER: WeekBucket[] = includePast
    ? ['past', 'today', 'this-week', 'next-week', 'later']
    : ['today', 'this-week', 'next-week', 'later']

  const map = new Map<WeekBucket, T[]>()
  for (const bucket of ORDER) map.set(bucket, [])

  for (const item of items) {
    const bucket = getWeekBucket(item.dateTime)
    if (!map.has(bucket)) continue          // exclude past when includePast=false
    map.get(bucket)!.push(item)
  }

  return ORDER
    .filter((b) => (map.get(b)?.length ?? 0) > 0)
    .map((b) => ({ bucket: b, label: BUCKET_LABELS[b], items: map.get(b)! }))
}

/** "Tomorrow · 18:30", "Today · 18:30", or "Wed 5 Apr · 18:30" */
export function formatDateTimeRelative(value: string) {
  if (!value) return 'Date not set'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed)
  const now = new Date()
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const parsed0 = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  const diffDays = Math.round((parsed0.getTime() - today0.getTime()) / 86_400_000)

  if (diffDays === 0) return `Today · ${time}`
  if (diffDays === 1) return `Tomorrow · ${time}`
  if (diffDays === -1) return `Yesterday · ${time}`

  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(parsed)
  const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parsed)
  return `${weekday} ${dayMonth} · ${time}`
}

/** Returns { month: "APR", day: "10" } for a date-box display */
export function dateBox(value: string): { month: string; day: string } {
  if (!value) return { month: '—', day: '—' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { month: '—', day: '—' }
  return {
    month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(parsed).toUpperCase(),
    day:   String(parsed.getDate()),
  }
}

/** Shorten a full geocoded address to just the venue/street part (before first comma). */
export function shortenAddress(location: string): string {
  if (!location) return ''
  const first = location.split(',')[0].trim()
  return first
}

export function formatDate(value: string) {
  if (!value) {
    return 'DOB not set'
  }

  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight; use UTC parts
  // to avoid the date shifting by one day in negative-offset timezones.
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}