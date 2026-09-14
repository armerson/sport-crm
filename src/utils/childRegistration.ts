import { ageOnDate } from './birthDate.ts'

export function validateChildren<T extends { name: string; dob: string }>(children: T[]): T[] {
  if (children.length === 0) throw new Error('Add at least one child.')
  return children.map((child, index) => {
    const name = child.name.trim()
    const dob = child.dob.trim()
    if (name.length < 2) throw new Error(`Child ${index + 1}: enter a full name.`)
    if (ageOnDate(dob) === null) throw new Error(`Child ${index + 1}: enter a valid date of birth that is not in the future.`)
    return { ...child, name, dob }
  })
}
