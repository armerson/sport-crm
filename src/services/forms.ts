import { supabase } from '../lib/supabase.ts'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}
import type {
  ClubSettings,
  FieldInput,
  FormField,
  FormInput,
  FormSubmission,
  RegistrationForm,
  SubmissionStatus,
} from '../types/forms.ts'

// ── Mappers ───────────────────────────────────

function mapForm(row: Record<string, unknown>): RegistrationForm {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    formType: row.form_type as RegistrationForm['formType'],
    teamId: (row.team_id as string | null) ?? null,
    slug: row.slug as string,
    deadline: (row.deadline as string | null) ?? null,
    active: row.active as boolean,
    requiresLogin: (row.requires_login as boolean) ?? false,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

const DEFAULT_SETTINGS: ClubSettings = { name: 'My Club', logoUrl: null, primaryColor: '#123524' }

export async function fetchClubSettings(): Promise<ClubSettings> {
  const client = supabase
  if (!client) return DEFAULT_SETTINGS
  const { data } = await client.from('club_settings').select('name, logo_url, primary_color').eq('id', 1).maybeSingle()
  if (!data) return DEFAULT_SETTINGS
  return {
    name: (data.name as string) ?? 'My Club',
    logoUrl: (data.logo_url as string | null) ?? null,
    primaryColor: (data.primary_color as string | null) ?? '#123524',
  }
}

export async function saveClubSettings(settings: ClubSettings): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('club_settings')
    .upsert({ id: 1, name: settings.name, logo_url: settings.logoUrl, primary_color: settings.primaryColor, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

export async function uploadClubLogo(file: File): Promise<string> {
  const client = requireSupabase()
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `club-logo.${ext}`
  const { error } = await client.storage.from('club-assets').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(error.message)
  const { data: urlData } = client.storage.from('club-assets').getPublicUrl(path)
  return urlData.publicUrl
}

function mapField(row: Record<string, unknown>): FormField {
  let options: string[] | null = null
  if (Array.isArray(row.options)) {
    options = row.options as string[]
  } else if (typeof row.options === 'string') {
    try { options = JSON.parse(row.options) } catch { options = null }
  }
  return {
    id: row.id as string,
    formId: row.form_id as string,
    label: row.label as string,
    fieldType: row.field_type as FormField['fieldType'],
    required: row.required as boolean,
    options,
    placeholder: (row.placeholder as string | null) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
  }
}

function mapSubmission(row: Record<string, unknown>): FormSubmission {
  return {
    id: row.id as string,
    formId: row.form_id as string,
    submitterName: row.submitter_name as string,
    submitterEmail: row.submitter_email as string,
    status: row.status as SubmissionStatus,
    notes: (row.notes as string | null) ?? null,
    submittedAt: row.submitted_at as string,
    updatedAt: row.updated_at as string,
  }
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

// ── Admin operations ──────────────────────────

export async function fetchAdminForms(): Promise<RegistrationForm[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('registration_forms')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => mapForm(r))
}

export async function fetchFormFields(formId: string): Promise<FormField[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('form_fields')
    .select('*')
    .eq('form_id', formId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => mapField(r))
}

export async function createForm(input: FormInput, fields: FieldInput[], createdBy: string): Promise<RegistrationForm> {
  const client = requireSupabase()
  const slug = slugify(input.name)

  const { data: formRow, error: formError } = await client
    .from('registration_forms')
    .insert({
      name: input.name.trim(),
      description: input.description.trim() || null,
      form_type: input.formType,
      team_id: input.teamId || null,
      slug,
      deadline: input.deadline || null,
      active: input.active,
      requires_login: input.requiresLogin,
      created_by: createdBy,
    })
    .select()
    .single()

  if (formError || !formRow) throw new Error(formError?.message ?? 'Failed to create form.')

  if (fields.length > 0) {
    const { error: fieldError } = await client.from('form_fields').insert(
      fields.map((f, i) => ({
        form_id: formRow.id,
        label: f.label.trim(),
        field_type: f.fieldType,
        required: f.required,
        options: f.options.trim()
          ? f.options.split(',').map((o) => o.trim()).filter(Boolean)
          : null,
        placeholder: f.placeholder.trim() || null,
        sort_order: i,
      })),
    )
    if (fieldError) throw new Error(fieldError.message)
  }

  return mapForm(formRow as Record<string, unknown>)
}

export async function updateForm(formId: string, input: FormInput, fields: FieldInput[]): Promise<void> {
  const client = requireSupabase()

  const { error: formError } = await client
    .from('registration_forms')
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      form_type: input.formType,
      team_id: input.teamId || null,
      deadline: input.deadline || null,
      active: input.active,
      requires_login: input.requiresLogin,
      updated_at: new Date().toISOString(),
    })
    .eq('id', formId)

  if (formError) throw new Error(formError.message)

  // Replace all fields
  await client.from('form_fields').delete().eq('form_id', formId)

  if (fields.length > 0) {
    const { error: fieldError } = await client.from('form_fields').insert(
      fields.map((f, i) => ({
        form_id: formId,
        label: f.label.trim(),
        field_type: f.fieldType,
        required: f.required,
        options: f.options.trim()
          ? f.options.split(',').map((o) => o.trim()).filter(Boolean)
          : null,
        placeholder: f.placeholder.trim() || null,
        sort_order: i,
      })),
    )
    if (fieldError) throw new Error(fieldError.message)
  }
}

export async function deleteForm(formId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('registration_forms').delete().eq('id', formId)
  if (error) throw new Error(error.message)
}

export async function fetchSubmissions(formId: string): Promise<FormSubmission[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('form_submissions')
    .select('*')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => mapSubmission(r))
}

export async function fetchSubmissionResponses(submissionId: string): Promise<Record<string, string>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('form_responses')
    .select('field_id, value')
    .eq('submission_id', submissionId)
  if (error) throw new Error(error.message)
  return Object.fromEntries((data ?? []).map((r: Record<string, unknown>) => [r.field_id as string, (r.value as string) ?? '']))
}

export async function updateSubmissionStatus(submissionId: string, status: SubmissionStatus, notes?: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('form_submissions')
    .update({ status, notes: notes ?? null, updated_at: new Date().toISOString() })
    .eq('id', submissionId)
  if (error) throw new Error(error.message)
}

// ── Public operations (anon client) ──────────

export async function fetchPublicForm(slug: string): Promise<(RegistrationForm & { fields: FormField[] }) | null> {
  const client = supabase
  if (!client) return null

  const { data: formRow, error: formError } = await client
    .from('registration_forms')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (formError || !formRow) return null

  const form = mapForm(formRow as Record<string, unknown>)

  const { data: fieldRows } = await client
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order', { ascending: true })

  const fields = (fieldRows ?? []).map((r) => mapField(r as Record<string, unknown>))
  return { ...form, fields }
}

export async function submitForm(
  formId: string,
  submitterName: string,
  submitterEmail: string,
  responses: { fieldId: string; value: string }[],
): Promise<void> {
  const client = supabase
  if (!client) throw new Error('Not configured.')

  const { data: submissionRow, error: submissionError } = await client
    .from('form_submissions')
    .insert({ form_id: formId, submitter_name: submitterName, submitter_email: submitterEmail })
    .select('id')
    .single()

  if (submissionError || !submissionRow) throw new Error(submissionError?.message ?? 'Failed to submit.')

  if (responses.length > 0) {
    const { error: responseError } = await client.from('form_responses').insert(
      responses.map((r) => ({
        submission_id: submissionRow.id,
        field_id: r.fieldId,
        value: r.value,
      })),
    )
    if (responseError) throw new Error(responseError.message)
  }
}
