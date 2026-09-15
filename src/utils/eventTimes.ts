export function validateSupportingTimes(dateTime: string, meetTime: string, endTime: string): string | null {
  const start = new Date(dateTime).getTime()
  if (meetTime && new Date(meetTime).getTime() > start) return 'Meet time must be before the event starts.'
  if (endTime && new Date(endTime).getTime() <= start) return 'Finish time must be after the event starts.'
  return null
}
