import { requireSupabase } from './supabaseHelpers.ts'
import type {
  EmergencyContact,
  EmergencyContactInput,
  PlayerDocument,
  PlayerDocumentType,
  PlayerProfileInput,
  PlayerRecord,
} from '../types/club.ts'

// ── Row mappers ───────────────────────────────────────────────────────────

function mapPlayerRow(row: Record<string, unknown>): PlayerRecord {
  const statusRaw = row.status as string | undefined
  const status: PlayerRecord['status'] = statusRaw === 'pending' || statusRaw === 'active' ? statusRaw : 'active'
  return {
    id: row.id as string,
    name: row.name as string,
    dob: row.dob as string,
    status,
    parentIds: [],
    teams: [],
    position: (row.position as string | null) ?? null,
    photoUrl: (row.photo_url as string | null) ?? null,
    nationality: (row.nationality as string | null) ?? null,
    dominantFoot: (row.dominant_foot as PlayerRecord['dominantFoot']) ?? null,
    jerseyNumber: (row.jersey_number as number | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    medicalNotes: (row.medical_notes as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    passportNumber: (row.passport_number as string | null) ?? null,
    countryOfBirth: (row.country_of_birth as string | null) ?? null,
    nationalId: (row.national_id as string | null) ?? null,
    gender: (row.gender as string | null) ?? null,
    fatherName: (row.father_name as string | null) ?? null,
    motherName: (row.mother_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
  }
}

function mapContactRow(row: Record<string, unknown>): EmergencyContact {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    name: row.name as string,
    relationship: row.relationship as string,
    phone: row.phone as string,
    email: (row.email as string | null) ?? null,
    isPrimary: row.is_primary as boolean,
    createdAt: row.created_at as string,
  }
}

function mapDocumentRow(row: Record<string, unknown>): PlayerDocument {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    type: row.type as PlayerDocumentType,
    label: (row.label as string | null) ?? null,
    storagePath: row.storage_path as string,
    uploadedBy: (row.uploaded_by as string | null) ?? null,
    uploadedAt: row.uploaded_at as string,
    verified: row.verified as boolean,
    verifiedBy: (row.verified_by as string | null) ?? null,
    verifiedAt: (row.verified_at as string | null) ?? null,
  }
}

// ── Player profile ────────────────────────────────────────────────────────

export async function fetchPlayerProfile(playerId: string): Promise<PlayerRecord | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('players')
    .select('*')
    .eq('id', playerId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapPlayerRow(data as Record<string, unknown>)
}

export async function updatePlayerProfile(playerId: string, input: PlayerProfileInput): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('players')
    .update({
      position: input.position || null,
      nationality: input.nationality || null,
      dominant_foot: input.dominantFoot || null,
      jersey_number: input.jerseyNumber ? parseInt(input.jerseyNumber) : null,
      bio: input.bio || null,
      medical_notes: input.medicalNotes || null,
      passport_number: input.passportNumber || null,
      country_of_birth: input.countryOfBirth || null,
      national_id: input.nationalId || null,
      gender: input.gender || null,
      father_name: input.fatherName || null,
      mother_name: input.motherName || null,
      email: input.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playerId)

  if (error) throw new Error(error.message)
}

// ── Photo upload ──────────────────────────────────────────────────────────

export async function uploadPlayerPhoto(playerId: string, file: File): Promise<string> {
  const client = requireSupabase()

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${playerId}/photo.${ext}`

  const { error: uploadError } = await client.storage
    .from('player-photos')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw new Error(uploadError.message)

  const { data } = client.storage.from('player-photos').getPublicUrl(path)

  // Bust cache with a timestamp query param
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`

  const { error: updateError } = await client
    .from('players')
    .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', playerId)

  if (updateError) throw new Error(updateError.message)

  return publicUrl
}

export async function removePlayerPhoto(playerId: string, storagePath: string): Promise<void> {
  const client = requireSupabase()

  await client.storage.from('player-photos').remove([storagePath])

  await client
    .from('players')
    .update({ photo_url: null, updated_at: new Date().toISOString() })
    .eq('id', playerId)
}

// ── Emergency contacts ────────────────────────────────────────────────────

export async function fetchEmergencyContacts(playerId: string): Promise<EmergencyContact[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('emergency_contacts')
    .select('*')
    .eq('player_id', playerId)
    .order('is_primary', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapContactRow(r as Record<string, unknown>))
}

export async function addEmergencyContact(playerId: string, input: EmergencyContactInput): Promise<void> {
  const client = requireSupabase()

  // If this is marked primary, unset others first
  if (input.isPrimary) {
    await client
      .from('emergency_contacts')
      .update({ is_primary: false })
      .eq('player_id', playerId)
  }

  const { error } = await client.from('emergency_contacts').insert({
    player_id: playerId,
    name: input.name,
    relationship: input.relationship,
    phone: input.phone,
    email: input.email || null,
    is_primary: input.isPrimary,
  })

  if (error) throw new Error(error.message)
}

export async function updateEmergencyContact(id: string, playerId: string, input: EmergencyContactInput): Promise<void> {
  const client = requireSupabase()

  if (input.isPrimary) {
    await client
      .from('emergency_contacts')
      .update({ is_primary: false })
      .eq('player_id', playerId)
      .neq('id', id)
  }

  const { error } = await client.from('emergency_contacts').update({
    name: input.name,
    relationship: input.relationship,
    phone: input.phone,
    email: input.email || null,
    is_primary: input.isPrimary,
  }).eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteEmergencyContact(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('emergency_contacts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Identity documents ────────────────────────────────────────────────────

export async function fetchPlayerDocuments(playerId: string): Promise<PlayerDocument[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_documents')
    .select('*')
    .eq('player_id', playerId)
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapDocumentRow(r as Record<string, unknown>))
}

export async function uploadPlayerDocument(
  playerId: string,
  file: File,
  type: PlayerDocumentType,
  label: string,
  uploadedBy: string,
): Promise<void> {
  const client = requireSupabase()

  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `${playerId}/${type}-${Date.now()}.${ext}`

  const { error: uploadError } = await client.storage
    .from('player-documents')
    .upload(path, file, { contentType: file.type })

  if (uploadError) throw new Error(uploadError.message)

  const { error: dbError } = await client.from('player_documents').insert({
    player_id: playerId,
    type,
    label: label || null,
    storage_path: path,
    uploaded_by: uploadedBy,
  })

  if (dbError) {
    // Clean up the orphaned file
    await client.storage.from('player-documents').remove([path])
    throw new Error(dbError.message)
  }
}

/**
 * Generate a short-lived signed URL for a private identity document.
 * Default expiry: 60 seconds — long enough to open, short enough to be safe.
 */
export async function getDocumentSignedUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.storage
    .from('player-documents')
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Failed to generate document URL')
  return data.signedUrl
}

export async function markDocumentVerified(documentId: string, verifiedBy: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('player_documents').update({
    verified: true,
    verified_by: verifiedBy,
    verified_at: new Date().toISOString(),
  }).eq('id', documentId)

  if (error) throw new Error(error.message)
}

export async function deletePlayerDocument(documentId: string, storagePath: string): Promise<void> {
  const client = requireSupabase()
  await client.storage.from('player-documents').remove([storagePath])
  await client.from('player_documents').delete().eq('id', documentId)
}
