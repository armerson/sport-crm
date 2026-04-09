/** Mirrors registration form field types — stored per club, values on players. */
export type ClubPlayerFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'date'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'checkboxes'

export interface ClubPlayerField {
  id: string
  label: string
  fieldType: ClubPlayerFieldType
  required: boolean
  options: string[] | null
  placeholder: string | null
  sortOrder: number
  active: boolean
}

export interface ClubPlayerFieldInput {
  label: string
  fieldType: ClubPlayerFieldType
  required: boolean
  options: string
  placeholder: string
  sortOrder: number
  active: boolean
}
