import { requireSupabase } from './supabaseHelpers.ts'

export type PathwayVisibility = 'internal' | 'player' | 'parent'
export type OpportunityType = 'training' | 'appearance' | 'trial' | 'call_up'

export interface PathwayStage {
  id: string
  name: string
  description: string | null
  sortOrder: number
  linkedTeamId: string | null
  active: boolean
}

export interface PathwayTeam { id: string; name: string }

export async function fetchPathwayTeams(): Promise<PathwayTeam[]> {
  const { data, error } = await requireSupabase().from('teams').select('id, name').is('archived_at', null).order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }))
}

export interface PathwayHistory {
  id: string
  playerId: string
  stageId: string
  startedOn: string
  endedOn: string | null
  isCurrent: boolean
  recommendation: string | null
  notes: string | null
  visibility: PathwayVisibility
  createdAt: string
}

export interface PathwayRecommendation {
  id: string
  playerId: string
  recommendedStageId: string
  status: 'monitoring' | 'ready' | 'progressed' | 'closed'
  recommendation: string
  reviewDate: string | null
  createdAt: string
}

export interface PathwayOpportunity {
  id: string
  playerId: string
  opportunityTeamId: string
  stageId: string | null
  type: OpportunityType
  occurredOn: string
  outcome: string | null
  notes: string | null
  visibility: PathwayVisibility
  createdAt: string
}

function mapStage(row: Record<string, unknown>): PathwayStage {
  return {
    id: String(row.id), name: String(row.name),
    description: typeof row.description === 'string' ? row.description : null,
    sortOrder: Number(row.sort_order), linkedTeamId: typeof row.linked_team_id === 'string' ? row.linked_team_id : null,
    active: row.active === true,
  }
}

export async function fetchPathwayStages(includeInactive = false): Promise<PathwayStage[]> {
  let query = requireSupabase().from('pathway_stages').select('id, name, description, sort_order, linked_team_id, active').order('sort_order')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapStage(row as Record<string, unknown>))
}

export async function createPathwayStage(input: { name: string; description: string; linkedTeamId: string | null }): Promise<PathwayStage> {
  const client = requireSupabase()
  const { data: last, error: orderError } = await client.from('pathway_stages').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  if (orderError) throw new Error(orderError.message)
  const { data, error } = await client.from('pathway_stages').insert({
    name: input.name.trim(), description: input.description.trim() || null,
    linked_team_id: input.linkedTeamId, sort_order: Number(last?.sort_order ?? 0) + 10,
  }).select('id, name, description, sort_order, linked_team_id, active').single()
  if (error) throw new Error(error.message)
  return mapStage(data as Record<string, unknown>)
}

export async function updatePathwayStage(stageId: string, changes: Partial<{ name: string; description: string; linkedTeamId: string | null; active: boolean }>): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (changes.name !== undefined) payload.name = changes.name.trim()
  if (changes.description !== undefined) payload.description = changes.description.trim() || null
  if (changes.linkedTeamId !== undefined) payload.linked_team_id = changes.linkedTeamId
  if (changes.active !== undefined) payload.active = changes.active
  const { error } = await requireSupabase().from('pathway_stages').update(payload).eq('id', stageId)
  if (error) throw new Error(error.message)
}

export async function fetchPlayerPathway(playerId: string): Promise<{
  history: PathwayHistory[]; recommendations: PathwayRecommendation[]; opportunities: PathwayOpportunity[]
}> {
  const client = requireSupabase()
  const [{ data: history, error: historyError }, { data: recommendations, error: recommendationsError }, { data: opportunities, error: opportunitiesError }] = await Promise.all([
    client.from('player_pathway_history').select('*').eq('player_id', playerId).order('started_on', { ascending: false }),
    client.from('pathway_recommendations').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
    client.from('pathway_opportunities').select('*').eq('player_id', playerId).order('occurred_on', { ascending: false }),
  ])
  if (historyError) throw new Error(historyError.message)
  if (recommendationsError) throw new Error(recommendationsError.message)
  if (opportunitiesError) throw new Error(opportunitiesError.message)
  return {
    history: (history ?? []).map((row) => ({
      id: String(row.id), playerId: String(row.player_id), stageId: String(row.pathway_stage_id),
      startedOn: String(row.started_on), endedOn: typeof row.ended_on === 'string' ? row.ended_on : null,
      isCurrent: row.is_current === true, recommendation: typeof row.recommendation === 'string' ? row.recommendation : null,
      notes: typeof row.notes === 'string' ? row.notes : null, visibility: row.visibility as PathwayVisibility,
      createdAt: String(row.created_at),
    })),
    recommendations: (recommendations ?? []).map((row) => ({
      id: String(row.id), playerId: String(row.player_id), recommendedStageId: String(row.recommended_stage_id),
      status: row.status as PathwayRecommendation['status'], recommendation: String(row.recommendation),
      reviewDate: typeof row.review_date === 'string' ? row.review_date : null, createdAt: String(row.created_at),
    })),
    opportunities: (opportunities ?? []).map((row) => ({
      id: String(row.id), playerId: String(row.player_id), opportunityTeamId: String(row.opportunity_team_id),
      stageId: typeof row.pathway_stage_id === 'string' ? row.pathway_stage_id : null,
      type: row.opportunity_type as OpportunityType, occurredOn: String(row.occurred_on),
      outcome: typeof row.outcome === 'string' ? row.outcome : null, notes: typeof row.notes === 'string' ? row.notes : null,
      visibility: row.visibility as PathwayVisibility, createdAt: String(row.created_at),
    })),
  }
}

export async function advancePlayerPathway(input: {
  playerId: string; stageId: string; startedOn: string; recommendation: string; notes: string; visibility: PathwayVisibility
}): Promise<string> {
  const { data, error } = await requireSupabase().rpc('advance_player_pathway', {
    p_player_id: input.playerId, p_stage_id: input.stageId, p_started_on: input.startedOn,
    p_recommendation: input.recommendation || null, p_notes: input.notes || null, p_visibility: input.visibility,
  })
  if (error) throw new Error(error.message)
  return String(data)
}

export async function createPathwayRecommendation(input: {
  playerId: string; stageId: string; recommendation: string; reviewDate: string; recommendedBy: string
}): Promise<void> {
  const { error } = await requireSupabase().from('pathway_recommendations').insert({
    player_id: input.playerId, recommended_stage_id: input.stageId,
    recommendation: input.recommendation.trim(), review_date: input.reviewDate || null,
    recommended_by: input.recommendedBy,
  })
  if (error) throw new Error(error.message)
}

export async function createPathwayOpportunity(input: {
  playerId: string; teamId: string; stageId: string; type: OpportunityType; occurredOn: string;
  outcome: string; notes: string; visibility: PathwayVisibility; recordedBy: string
}): Promise<void> {
  const { error } = await requireSupabase().from('pathway_opportunities').insert({
    player_id: input.playerId, opportunity_team_id: input.teamId,
    pathway_stage_id: input.stageId || null, opportunity_type: input.type,
    occurred_on: input.occurredOn, outcome: input.outcome.trim() || null,
    notes: input.notes.trim() || null, visibility: input.visibility, recorded_by: input.recordedBy,
  })
  if (error) throw new Error(error.message)
}
