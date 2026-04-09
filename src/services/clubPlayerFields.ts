/**
 * Club player registration fields — client-side access to Supabase tables
 * `club_player_fields` + `player_field_values`.
 * (No Next.js /api routes; use these functions or Supabase RPCs from the app.)
 */
import { requireSupabase } from './supabaseHelpers.ts'
import type { ClubPlayerField, ClubPlayerFieldInput, ClubPlayerFieldType } from '../types/clubPlayerFields.ts'

/** Shown when PostgREST has no `club_player_fields` / `player_field_values` (migration not applied). */
export const CLUB_PLAYER_FIELDS_SETUP_MESSAGE =
  'Player registration fields need a one-time database update. Open Supabase → SQL Editor, paste and run the full contents of `supabase/migrations/20260418100000_club_player_registration_fields.sql` from this project (or run `supabase db push` against this project). Wait a minute for the API schema to refresh, then reload this app.'

function mapClubPlayerFieldsSupabaseError(error: { message: string; code?: string }): Error {
  const msg = error.message ?? ''
  const code = error.code ?? ''
  const looksMissing =
    code === 'PGRST205' ||
    code === '42P01' ||
    (msg.includes('club_player_fields') && (msg.includes('schema cache') || msg.includes('Could not find'))) ||
    (msg.includes('player_field_values') && (msg.includes('schema cache') || msg.includes('Could not find')))
  if (looksMissing) return new Error(CLUB_PLAYER_FIELDS_SETUP_MESSAGE)
  return new Error(msg)
}

function mapFieldRow(row: Record<string, unknown>): ClubPlayerField {
  const opts = row.options
  let options: string[] | null = null
  if (Array.isArray(opts)) {
    options = opts.filter((x): x is string => typeof x === 'string')
  } else if (opts && typeof opts === 'object') {
    options = null
  }

  return {
    id: String(row.id ?? ''),
    label: typeof row.label === 'string' ? row.label : '',
    fieldType: (row.field_type as ClubPlayerFieldType) ?? 'text',
    required: row.required === true,
    options,
    placeholder: typeof row.placeholder === 'string' ? row.placeholder : null,
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
    active: row.active !== false,
  }
}

/** Active fields for public parent registration (no auth). */
export async function fetchPublicClubPlayerFields(): Promise<ClubPlayerField[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('club_player_fields')
    .select('id, label, field_type, required, options, placeholder, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) throw mapClubPlayerFieldsSupabaseError(error)
  return (data ?? []).map((r) => mapFieldRow(r as Record<string, unknown>))
}

/** All fields for admin editor. */
export async function fetchAdminClubPlayerFields(): Promise<ClubPlayerField[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('club_player_fields')
    .select('id, label, field_type, required, options, placeholder, sort_order, active')
    .order('sort_order', { ascending: true })

  if (error) throw mapClubPlayerFieldsSupabaseError(error)
  return (data ?? []).map((r) => mapFieldRow(r as Record<string, unknown>))
}

export async function insertClubPlayerField(input: ClubPlayerFieldInput): Promise<void> {
  const client = requireSupabase()
  const options =
    input.fieldType === 'select' || input.fieldType === 'checkboxes'
      ? input.options
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null

  const { error } = await client.from('club_player_fields').insert({
    label: input.label.trim(),
    field_type: input.fieldType,
    required: input.required,
    options: options && options.length > 0 ? options : null,
    placeholder: input.placeholder.trim() || null,
    sort_order: input.sortOrder,
    active: input.active,
  })

  if (error) throw mapClubPlayerFieldsSupabaseError(error)
}

export async function updateClubPlayerField(fieldId: string, input: ClubPlayerFieldInput): Promise<void> {
  const client = requireSupabase()
  const options =
    input.fieldType === 'select' || input.fieldType === 'checkboxes'
      ? input.options
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null

  const { error } = await client
    .from('club_player_fields')
    .update({
      label: input.label.trim(),
      field_type: input.fieldType,
      required: input.required,
      options: options && options.length > 0 ? options : null,
      placeholder: input.placeholder.trim() || null,
      sort_order: input.sortOrder,
      active: input.active,
    })
    .eq('id', fieldId)

  if (error) throw mapClubPlayerFieldsSupabaseError(error)
}

export async function deleteClubPlayerField(fieldId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('club_player_fields').delete().eq('id', fieldId)
  if (error) throw mapClubPlayerFieldsSupabaseError(error)
}

export async function fetchPlayerFieldValuesMap(playerId: string): Promise<Record<string, string>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_field_values')
    .select('field_id, value')
    .eq('player_id', playerId)

  if (error) throw mapClubPlayerFieldsSupabaseError(error)
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    const r = row as { field_id: string; value: string | null }
    map[r.field_id] = r.value ?? ''
  }
  return map
}

export async function upsertPlayerFieldValues(playerId: string, values: Record<string, string>): Promise<void> {
  const client = requireSupabase()
  const rows = Object.entries(values).map(([field_id, value]) => ({
    player_id: playerId,
    field_id,
    value,
  }))
  if (rows.length === 0) return

  const { error } = await client.from('player_field_values').upsert(rows, { onConflict: 'player_id,field_id' })
  if (error) throw mapClubPlayerFieldsSupabaseError(error)
}
