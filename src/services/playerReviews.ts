import { requireSupabase } from './supabaseHelpers.ts'

export type ReviewStatus = 'draft' | 'published'

export interface PlayerReview {
  id: string
  playerId: string
  teamId: string
  coachId: string | null
  periodLabel: string
  ratingTechnical: number | null
  ratingTactical: number | null
  ratingPhysical: number | null
  ratingAttitude: number | null
  strengths: string | null
  areasToImprove: string | null
  coachNotes: string | null
  assessmentDate: string
  status: ReviewStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewFormInput {
  periodLabel: string
  ratingTechnical: number | null
  ratingTactical: number | null
  ratingPhysical: number | null
  ratingAttitude: number | null
  strengths: string
  areasToImprove: string
  coachNotes: string
}

function mapReviewRow(row: Record<string, unknown>): PlayerReview {
  return {
    id: String(row.id ?? ''),
    playerId: String(row.player_id ?? ''),
    teamId: String(row.team_id ?? ''),
    coachId: typeof row.coach_id === 'string' ? row.coach_id : null,
    periodLabel: String(row.period_label ?? ''),
    ratingTechnical: typeof row.rating_technical === 'number' ? row.rating_technical : null,
    ratingTactical: typeof row.rating_tactical === 'number' ? row.rating_tactical : null,
    ratingPhysical: typeof row.rating_physical === 'number' ? row.rating_physical : null,
    ratingAttitude: typeof row.rating_attitude === 'number' ? row.rating_attitude : null,
    strengths: typeof row.strengths === 'string' ? row.strengths : null,
    areasToImprove: typeof row.areas_to_improve === 'string' ? row.areas_to_improve : null,
    coachNotes: typeof row.coach_notes === 'string' ? row.coach_notes : null,
    assessmentDate: typeof row.assessment_date === 'string' ? row.assessment_date : String(row.created_at ?? '').slice(0, 10),
    status: row.status === 'published' ? 'published' : 'draft',
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }
}

/** Fetch all reviews for a player (coach/admin view — includes drafts + coach_notes). */
export async function fetchPlayerReviews(playerId: string): Promise<PlayerReview[]> {
  const client = requireSupabase()
  const [{ data, error }, { data: privateNotes, error: notesError }] = await Promise.all([
    client.from('player_reviews').select('*').eq('player_id', playerId).order('assessment_date', { ascending: false }),
    client.from('player_review_private_notes').select('review_id, notes'),
  ])

  if (error) throw new Error(error.message)
  if (notesError) throw new Error(notesError.message)
  const notesByReview = new Map((privateNotes ?? []).map((row) => [String(row.review_id), String(row.notes)]))
  return (data ?? []).map((row) => {
    const review = mapReviewRow(row as Record<string, unknown>)
    return { ...review, coachNotes: notesByReview.get(review.id) ?? null }
  })
}

/** Fetch published reviews for a player (parent view — no coach_notes). */
export async function fetchPublishedReviewsForPlayer(playerId: string): Promise<PlayerReview[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_reviews')
    .select('id, player_id, team_id, coach_id, period_label, assessment_date, rating_technical, rating_tactical, rating_physical, rating_attitude, strengths, areas_to_improve, status, published_at, created_at, updated_at')
    .eq('player_id', playerId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapReviewRow(row as Record<string, unknown>))
}

/** Save (upsert) a review draft. */
export async function saveReview(
  playerId: string,
  teamId: string,
  coachId: string,
  input: ReviewFormInput,
  existingId?: string,
): Promise<PlayerReview> {
  const client = requireSupabase()
  const payload = {
    player_id: playerId,
    team_id: teamId,
    coach_id: coachId,
    period_label: input.periodLabel.trim(),
    rating_technical: input.ratingTechnical,
    rating_tactical: input.ratingTactical,
    rating_physical: input.ratingPhysical,
    rating_attitude: input.ratingAttitude,
    strengths: input.strengths.trim() || null,
    areas_to_improve: input.areasToImprove.trim() || null,
    coach_notes: null,
    assessment_date: new Date().toISOString().slice(0, 10),
  }

  if (existingId) {
    const { data, error } = await client
      .from('player_reviews')
      .update(payload)
      .eq('id', existingId)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await savePrivateNote(client, String(data.id), coachId, input.coachNotes)
    await saveStructuredFeedback(client, String(data.id), coachId, input)
    return { ...mapReviewRow(data as Record<string, unknown>), coachNotes: input.coachNotes.trim() || null }
  }

  const { data, error } = await client
    .from('player_reviews')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  await savePrivateNote(client, String(data.id), coachId, input.coachNotes)
  await saveStructuredFeedback(client, String(data.id), coachId, input)
  return { ...mapReviewRow(data as Record<string, unknown>), coachNotes: input.coachNotes.trim() || null }
}

async function saveStructuredFeedback(
  client: ReturnType<typeof requireSupabase>,
  reviewId: string,
  coachId: string,
  input: ReviewFormInput,
): Promise<void> {
  const { error: deleteError } = await client
    .from('player_assessment_feedback')
    .delete()
    .eq('review_id', reviewId)
    .eq('audience', 'parent')
    .in('feedback_type', ['strength', 'development_priority'])
  if (deleteError) throw new Error(deleteError.message)

  const rows = [
    input.strengths.trim() ? { review_id: reviewId, feedback_type: 'strength', audience: 'parent', content: input.strengths.trim(), created_by: coachId } : null,
    input.areasToImprove.trim() ? { review_id: reviewId, feedback_type: 'development_priority', audience: 'parent', content: input.areasToImprove.trim(), created_by: coachId } : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null)
  if (rows.length === 0) return
  const { error } = await client.from('player_assessment_feedback').insert(rows)
  if (error) throw new Error(error.message)
}

async function savePrivateNote(
  client: ReturnType<typeof requireSupabase>,
  reviewId: string,
  coachId: string,
  notes: string,
): Promise<void> {
  const trimmed = notes.trim()
  if (!trimmed) {
    const { error } = await client.from('player_review_private_notes').delete().eq('review_id', reviewId)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await client.from('player_review_private_notes').upsert({
    review_id: reviewId,
    notes: trimmed,
    updated_by: coachId,
  })
  if (error) throw new Error(error.message)
}

/** Publish a draft review — parents can now see it. */
export async function publishReview(reviewId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('player_reviews')
    .update({ status: 'published' })
    .eq('id', reviewId)
  if (error) throw new Error(error.message)
}

/** Retract a published review back to draft. */
export async function retractReview(reviewId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('player_reviews')
    .update({ status: 'draft', published_at: null })
    .eq('id', reviewId)
  if (error) throw new Error(error.message)
}

/** Delete a review. */
export async function deleteReview(reviewId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('player_reviews').delete().eq('id', reviewId)
  if (error) throw new Error(error.message)
}
