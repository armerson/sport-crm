import { requireSupabase } from './supabaseHelpers.ts'

export type GoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'paused'
export type GoalPriority = 'low' | 'medium' | 'high'
export type FeedbackAudience = 'internal' | 'player' | 'parent'

export interface DevelopmentCategory {
  id: string
  name: string
  description: string | null
}

export interface AssessmentArea {
  id: string
  name: string
  description: string | null
  scoreMin: number
  scoreMax: number
}

export interface AssessmentScore {
  reviewId: string
  assessmentAreaId: string
  score: number
  observation: string | null
}

export interface DevelopmentGoal {
  id: string
  playerId: string
  categoryId: string | null
  categoryName: string | null
  originatingTeamId: string | null
  readinessForStageId: string | null
  title: string
  description: string | null
  status: GoalStatus
  priority: GoalPriority
  visibility: FeedbackAudience
  progress: number
  createdBy: string | null
  assignedCoachId: string | null
  targetDate: string | null
  achievedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GoalUpdate {
  id: string
  goalId: string
  status: GoalStatus | null
  progress: number | null
  comment: string | null
  audience: FeedbackAudience
  createdAt: string
}

export interface DevelopmentGoalInput {
  title: string
  description: string
  categoryId: string
  targetDate: string
  priority: GoalPriority
  visibility: FeedbackAudience
  assignedCoachId: string | null
  originatingTeamId: string | null
}

function mapGoal(row: Record<string, unknown>): DevelopmentGoal {
  const category = row.development_categories as { name?: unknown } | null
  return {
    id: String(row.id),
    playerId: String(row.player_id),
    categoryId: typeof row.category_id === 'string' ? row.category_id : null,
    categoryName: typeof category?.name === 'string' ? category.name : null,
    originatingTeamId: typeof row.originating_team_id === 'string' ? row.originating_team_id : null,
    readinessForStageId: typeof row.readiness_for_stage_id === 'string' ? row.readiness_for_stage_id : null,
    title: String(row.title),
    description: typeof row.description === 'string' ? row.description : null,
    status: row.status as GoalStatus,
    priority: row.priority as GoalPriority,
    visibility: row.visibility as FeedbackAudience,
    progress: Number(row.progress),
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    assignedCoachId: typeof row.assigned_coach_id === 'string' ? row.assigned_coach_id : null,
    targetDate: typeof row.target_date === 'string' ? row.target_date : null,
    achievedAt: typeof row.achieved_at === 'string' ? row.achieved_at : null,
    archivedAt: typeof row.archived_at === 'string' ? row.archived_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function fetchDevelopmentCategories(): Promise<DevelopmentCategory[]> {
  const { data, error } = await requireSupabase()
    .from('development_categories')
    .select('id, name, description')
    .eq('active', true)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: typeof row.description === 'string' ? row.description : null,
  }))
}

export async function fetchAssessmentAreas(): Promise<AssessmentArea[]> {
  const { data, error } = await requireSupabase()
    .from('assessment_areas')
    .select('id, name, description, score_min, score_max')
    .eq('active', true)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: typeof row.description === 'string' ? row.description : null,
    scoreMin: Number(row.score_min),
    scoreMax: Number(row.score_max),
  }))
}

export async function fetchAssessmentScores(reviewIds: string[]): Promise<AssessmentScore[]> {
  if (reviewIds.length === 0) return []
  const { data, error } = await requireSupabase()
    .from('player_assessment_scores')
    .select('review_id, assessment_area_id, score, observation')
    .in('review_id', reviewIds)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    reviewId: String(row.review_id),
    assessmentAreaId: String(row.assessment_area_id),
    score: Number(row.score),
    observation: typeof row.observation === 'string' ? row.observation : null,
  }))
}

export async function saveAssessmentScores(
  reviewId: string,
  scores: Array<{ assessmentAreaId: string; score: number }>,
): Promise<void> {
  const client = requireSupabase()
  const { error: deleteError } = await client.from('player_assessment_scores').delete().eq('review_id', reviewId)
  if (deleteError) throw new Error(deleteError.message)
  if (scores.length === 0) return
  const { error } = await client.from('player_assessment_scores').insert(
    scores.map((entry) => ({ review_id: reviewId, assessment_area_id: entry.assessmentAreaId, score: entry.score })),
  )
  if (error) throw new Error(error.message)
}

export async function fetchDevelopmentGoals(playerId: string): Promise<DevelopmentGoal[]> {
  const { data, error } = await requireSupabase()
    .from('player_development_goals')
    .select('*, development_categories(name)')
    .eq('player_id', playerId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGoal(row as Record<string, unknown>))
}

export async function fetchGoalUpdates(goalIds: string[]): Promise<GoalUpdate[]> {
  if (goalIds.length === 0) return []
  const { data, error } = await requireSupabase()
    .from('development_goal_updates')
    .select('id, goal_id, status, progress, comment, audience, created_at')
    .in('goal_id', goalIds)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    goalId: String(row.goal_id),
    status: typeof row.status === 'string' ? row.status as GoalStatus : null,
    progress: typeof row.progress === 'number' ? row.progress : null,
    comment: typeof row.comment === 'string' ? row.comment : null,
    audience: row.audience as FeedbackAudience,
    createdAt: String(row.created_at),
  }))
}

export async function createDevelopmentGoal(
  playerId: string,
  createdBy: string,
  input: DevelopmentGoalInput,
): Promise<DevelopmentGoal> {
  const { data, error } = await requireSupabase()
    .from('player_development_goals')
    .insert({
      player_id: playerId,
      category_id: input.categoryId || null,
      originating_team_id: input.originatingTeamId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      priority: input.priority,
      visibility: input.visibility,
      target_date: input.targetDate || null,
      created_by: createdBy,
      assigned_coach_id: input.assignedCoachId,
    })
    .select('*, development_categories(name)')
    .single()
  if (error) throw new Error(error.message)
  return mapGoal(data as Record<string, unknown>)
}

export async function updateDevelopmentGoal(
  goal: DevelopmentGoal,
  actorId: string,
  changes: { status: GoalStatus; progress: number; comment: string; audience: FeedbackAudience },
): Promise<DevelopmentGoal> {
  const client = requireSupabase()
  const progress = changes.status === 'achieved' ? 100 : changes.progress
  const { data, error } = await client
    .from('player_development_goals')
    .update({ status: changes.status, progress })
    .eq('id', goal.id)
    .select('*, development_categories(name)')
    .single()
  if (error) throw new Error(error.message)

  const meaningfulChange = changes.comment.trim()
    || changes.status !== goal.status
    || progress !== goal.progress
  if (meaningfulChange) {
    const { error: historyError } = await client.from('development_goal_updates').insert({
      goal_id: goal.id,
      created_by: actorId,
      status: changes.status,
      progress,
      comment: changes.comment.trim() || null,
      audience: changes.audience,
    })
    if (historyError) throw new Error(historyError.message)
  }
  return mapGoal(data as Record<string, unknown>)
}

export async function archiveDevelopmentGoal(goalId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('player_development_goals')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', goalId)
  if (error) throw new Error(error.message)
}

export async function linkGoalToPathwayStage(goalId: string, stageId: string | null): Promise<void> {
  const { error } = await requireSupabase().from('player_development_goals').update({ readiness_for_stage_id: stageId }).eq('id', goalId)
  if (error) throw new Error(error.message)
}
