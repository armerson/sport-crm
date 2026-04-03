export function formatDateTime(value: string) {
  if (!value) {
    return 'Date not set'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
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