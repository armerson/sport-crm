export function ageOnDate(value: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const birth = new Date(year, month - 1, day)
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > today) return null
  const birthdayPending = today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)
  return today.getFullYear() - year - Number(birthdayPending)
}
