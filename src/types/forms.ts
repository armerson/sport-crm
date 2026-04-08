export type FormType = 'club_membership' | 'camp' | 'trial' | 'event' | 'other'

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'date'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'checkboxes'

export type SubmissionStatus = 'new' | 'reviewed' | 'accepted' | 'rejected'

export interface RegistrationForm {
  id: string
  name: string
  description: string | null
  formType: FormType
  teamId: string | null
  slug: string
  deadline: string | null
  active: boolean
  requiresLogin: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  fields?: FormField[]
}

export interface FormField {
  id: string
  formId: string
  label: string
  fieldType: FieldType
  required: boolean
  options: string[] | null
  placeholder: string | null
  sortOrder: number
}

export interface FormSubmission {
  id: string
  formId: string
  submitterName: string
  submitterEmail: string
  status: SubmissionStatus
  notes: string | null
  submittedAt: string
  updatedAt: string
  responses?: FormResponse[]
}

export interface FormResponse {
  id: string
  submissionId: string
  fieldId: string
  value: string | null
}

// ── Form builder inputs ───────────────────────

export interface ClubSettings {
  name: string
  logoUrl: string | null
}

export interface FormInput {
  name: string
  description: string
  formType: FormType
  teamId: string | null
  deadline: string
  active: boolean
  requiresLogin: boolean
}

export interface FieldInput {
  label: string
  fieldType: FieldType
  required: boolean
  options: string
  placeholder: string
  sortOrder: number
}

export const FORM_TYPE_LABELS: Record<FormType, string> = {
  club_membership: 'Club membership',
  camp: 'Camp / holiday programme',
  trial: 'Trial / tryout',
  event: 'Event registration',
  other: 'Other',
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short text',
  email: 'Email address',
  phone: 'Phone number',
  date: 'Date',
  number: 'Number',
  textarea: 'Long text',
  select: 'Dropdown (pick one)',
  checkbox: 'Single checkbox (yes / no)',
  checkboxes: 'Checkboxes (pick many)',
}
