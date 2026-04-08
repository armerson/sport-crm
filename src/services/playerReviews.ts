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
    status: row.status === 'published' ? 'published' : 'draft',
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }
}

/** Fetch all reviews for a player (coach/admin view — includes drafts + coach_notes). */
export async function fetchPlayerReviews(playerId: string): Promise<PlayerReview[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_reviews')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapReviewRow(row as Record<string, unknown>))
}

/** Fetch published reviews for a player (parent view — no coach_notes). */
export async function fetchPublishedReviewsForPlayer(playerId: string): Promise<PlayerReview[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_reviews')
    .select('id, player_id, team_id, coach_id, period_label, rating_technical, rating_tactical, rating_physical, rating_attitude, strengths, areas_to_improve, status, published_at, created_at, updated_at')
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
    coach_notes: input.coachNotes.trim() || null,
  }

  if (existingId) {
    const { data, error } = await client
      .from('player_reviews')
      .update(payload)
      .eq('id', existingId)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapReviewRow(data as Record<string, unknown>)
  }

  const { data, error } = await client
    .from('player_reviews')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapReviewRow(data as Record<string, unknown>)
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
