export function validateSupportingTimes(dateTime: string, meetTime: string, endTime: string): string | null {
  const start = new Date(dateTime).getTime()
  if (meetTime && new Date(meetTime).getTime() > start) return 'Meet time must be before the event starts.'
  if (endTime && new Date(endTime).getTime() <= start) return 'Finish time must be after the event starts.'
  return null
}

export function meetTimeFromMinutesBefore(dateTime: string, minutesBefore: string): string {
  const minutes = Number(minutesBefore)
  if (!dateTime || !Number.isInteger(minutes) || minutes < 5 || minutes % 5 !== 0) return ''
  return new Date(new Date(dateTime).getTime() - minutes * 60_000).toISOString()
}

export function minutesBeforeFromMeetTime(dateTime: string, meetTime: string | null): string {
  if (!dateTime || !meetTime) return ''
  const minutes = Math.round((new Date(dateTime).getTime() - new Date(meetTime).getTime()) / 60_000)
  return minutes >= 5 ? String(Math.round(minutes / 5) * 5) : ''
}
