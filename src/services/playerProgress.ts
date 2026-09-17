import { fetchDevelopmentGoals } from './playerDevelopment.ts'
import { fetchPlayerTestResults, fetchTestDefinitions } from './performanceTesting.ts'
import { fetchPathwayStages, fetchPlayerPathway } from './playerPathway.ts'
import { fetchPlayerProfile } from './playerProfiles.ts'
import { fetchPlayerReviews } from './playerReviews.ts'
import { requireSupabase } from './supabaseHelpers.ts'

export type RecordVisibility = 'internal' | 'player' | 'parent'
export type AchievementType = 'development' | 'testing' | 'pathway' | 'attendance' | 'team' | 'other'

export interface PlayerAchievement {
  id: string
  title: string
  description: string | null
  type: AchievementType
  awardedOn: string
  visibility: RecordVisibility
}

export interface CardPermissions {
  showPhoto: boolean
  showAgeGroup: boolean
  showTeam: boolean
  showPosition: boolean
  showPathwayStage: boolean
  showAttendance: boolean
  showDevelopmentProgress: boolean
  showPerformanceMetrics: boolean
  showAchievements: boolean
  approvedAt: string | null
}

export interface PlayerReport {
  id: string
  title: string
  periodStart: string | null
  periodEnd: string | null
  status: 'draft' | 'published' | 'archived'
  visibility: RecordVisibility
  coachComment: string | null
  snapshot: ReportSnapshot
  publishedAt: string | null
  createdAt: string
}

export interface ReportSnapshot {
  generatedAt: string
  player: { name: string; dob: string | null; position: string | null; photoUrl: string | null }
  teams: string[]
  attendance: { attended: number; recorded: number; rate: number | null }
  goals: Array<{ title: string; status: string; progress: number; category: string | null; targetDate: string | null }>
  latestAssessment: { period: string; date: string; strengths: string | null; priorities: string | null } | null
  testing: Array<{ test: string; unit: string; latest: number; previous: number | null; personalBest: number }>
  pathway: { currentStage: string | null; startedOn: string | null }
  achievements: Array<{ title: string; type: AchievementType; awardedOn: string }>
}

export const DEFAULT_CARD_PERMISSIONS: CardPermissions = {
  showPhoto: false, showAgeGroup: false, showTeam: false, showPosition: false,
  showPathwayStage: false, showAttendance: false, showDevelopmentProgress: false,
  showPerformanceMetrics: false, showAchievements: false, approvedAt: null,
}

function mapAchievement(row: Record<string, unknown>): PlayerAchievement {
  return {
    id: String(row.id), title: String(row.title),
    description: typeof row.description === 'string' ? row.description : null,
    type: row.achievement_type as AchievementType, awardedOn: String(row.awarded_on),
    visibility: row.visibility as RecordVisibility,
  }
}

export async function fetchPlayerAchievements(playerId: string): Promise<PlayerAchievement[]> {
  const { data, error } = await requireSupabase().from('player_achievements').select('*')
    .eq('player_id', playerId).order('awarded_on', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAchievement(row as Record<string, unknown>))
}

export async function createPlayerAchievement(playerId: string, userId: string, input: {
  title: string; description: string; type: AchievementType; awardedOn: string; visibility: RecordVisibility
}): Promise<PlayerAchievement> {
  const { data, error } = await requireSupabase().from('player_achievements').insert({
    player_id: playerId, title: input.title.trim(), description: input.description.trim() || null,
    achievement_type: input.type, awarded_on: input.awardedOn, visibility: input.visibility, awarded_by: userId,
  }).select('*').single()
  if (error) throw new Error(error.message)
  return mapAchievement(data as Record<string, unknown>)
}

export async function fetchCardPermissions(playerId: string): Promise<CardPermissions> {
  const { data, error } = await requireSupabase().from('player_card_permissions').select('*').eq('player_id', playerId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return DEFAULT_CARD_PERMISSIONS
  return {
    showPhoto: data.show_photo === true, showAgeGroup: data.show_age_group === true,
    showTeam: data.show_team === true, showPosition: data.show_position === true,
    showPathwayStage: data.show_pathway_stage === true, showAttendance: data.show_attendance === true,
    showDevelopmentProgress: data.show_development_progress === true,
    showPerformanceMetrics: data.show_performance_metrics === true, showAchievements: data.show_achievements === true,
    approvedAt: typeof data.approved_at === 'string' ? data.approved_at : null,
  }
}

export async function saveCardPermissions(playerId: string, userId: string, permissions: CardPermissions): Promise<void> {
  const { error } = await requireSupabase().from('player_card_permissions').upsert({
    player_id: playerId, show_photo: permissions.showPhoto, show_age_group: permissions.showAgeGroup,
    show_team: permissions.showTeam, show_position: permissions.showPosition,
    show_pathway_stage: permissions.showPathwayStage, show_attendance: permissions.showAttendance,
    show_development_progress: permissions.showDevelopmentProgress,
    show_performance_metrics: permissions.showPerformanceMetrics, show_achievements: permissions.showAchievements,
    approved_by: userId, approved_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function buildReportSnapshot(playerId: string, audience: RecordVisibility = 'internal'): Promise<ReportSnapshot> {
  const client = requireSupabase()
  const [player, goals, reviews, results, definitions, pathway, stages, achievements, memberships, attendance] = await Promise.all([
    fetchPlayerProfile(playerId), fetchDevelopmentGoals(playerId), fetchPlayerReviews(playerId),
    fetchPlayerTestResults(playerId), fetchTestDefinitions(), fetchPlayerPathway(playerId), fetchPathwayStages(true),
    fetchPlayerAchievements(playerId),
    client.from('player_teams').select('teams(name)').eq('player_id', playerId),
    client.from('attendance').select('status').eq('player_id', playerId),
  ])
  if (!player) throw new Error('Player not found.')
  if (memberships.error) throw new Error(memberships.error.message)
  if (attendance.error) throw new Error(attendance.error.message)
  const attended = (attendance.data ?? []).filter((row) => row.status === 'yes').length
  const recorded = (attendance.data ?? []).filter((row) => row.status !== 'pending').length
  const canInclude = (visibility: string) => audience === 'internal' || visibility === 'parent' || (audience === 'player' && visibility === 'player')
  const visibleGoals = goals.filter((goal) => canInclude(goal.visibility))
  const visibleAchievements = achievements.filter((achievement) => canInclude(achievement.visibility))
  const testing = definitions.flatMap((definition) => {
    const matching = results.filter((result) => result.testDefinitionId === definition.id && canInclude(result.visibility))
    if (matching.length === 0) return []
    const latest = matching.at(-1)!
    const values = matching.map((result) => result.resultValue)
    return [{ test: definition.name, unit: definition.unit, latest: latest.resultValue,
      previous: matching.length > 1 ? matching.at(-2)!.resultValue : null,
      personalBest: definition.higherIsBetter ? Math.max(...values) : Math.min(...values) }]
  })
  const currentPathway = pathway.history.find((item) => item.isCurrent && canInclude(item.visibility)) ?? null
  const stageById = new Map(stages.map((stage) => [stage.id, stage.name]))
  const latestReview = reviews.find((review) => audience === 'internal' || review.status === 'published') ?? null
  return {
    generatedAt: new Date().toISOString(),
    player: { name: player.name, dob: player.dob || null, position: player.position, photoUrl: player.photoUrl },
    teams: (memberships.data ?? []).flatMap((row) => {
      const team = row.teams as unknown as { name?: string } | null
      return team?.name ? [team.name] : []
    }),
    attendance: { attended, recorded, rate: recorded > 0 ? Math.round((attended / recorded) * 100) : null },
    goals: visibleGoals.map((goal) => ({ title: goal.title, status: goal.status, progress: goal.progress,
      category: goal.categoryName, targetDate: goal.targetDate })),
    latestAssessment: latestReview ? { period: latestReview.periodLabel, date: latestReview.assessmentDate,
      strengths: latestReview.strengths, priorities: latestReview.areasToImprove } : null,
    testing,
    pathway: { currentStage: currentPathway ? stageById.get(currentPathway.stageId) ?? null : null,
      startedOn: currentPathway?.startedOn ?? null },
    achievements: visibleAchievements.map((item) => ({ title: item.title, type: item.type, awardedOn: item.awardedOn })),
  }
}

function mapReport(row: Record<string, unknown>): PlayerReport {
  return {
    id: String(row.id), title: String(row.title),
    periodStart: typeof row.period_start === 'string' ? row.period_start : null,
    periodEnd: typeof row.period_end === 'string' ? row.period_end : null,
    status: row.status as PlayerReport['status'], visibility: row.visibility as RecordVisibility,
    coachComment: typeof row.coach_comment === 'string' ? row.coach_comment : null,
    snapshot: row.snapshot as ReportSnapshot,
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    createdAt: String(row.created_at),
  }
}

export async function fetchPlayerReports(playerId: string): Promise<PlayerReport[]> {
  const { data, error } = await requireSupabase().from('player_reports').select('*')
    .eq('player_id', playerId).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapReport(row as Record<string, unknown>))
}

export async function createPlayerReport(playerId: string, userId: string, input: {
  title: string; periodStart: string; periodEnd: string; coachComment: string
}): Promise<PlayerReport> {
  // Persist only parent-safe source records so a later publish action cannot
  // accidentally expose internal goals, draft assessments or staff-only tests.
  const snapshot = await buildReportSnapshot(playerId, 'parent')
  const { data, error } = await requireSupabase().from('player_reports').insert({
    player_id: playerId, title: input.title.trim(), period_start: input.periodStart || null,
    period_end: input.periodEnd || null, coach_comment: input.coachComment.trim() || null,
    snapshot, created_by: userId,
  }).select('*').single()
  if (error) throw new Error(error.message)
  return mapReport(data as Record<string, unknown>)
}

export async function publishPlayerReport(reportId: string, visibility: Exclude<RecordVisibility, 'internal'>): Promise<void> {
  const { error } = await requireSupabase().rpc('publish_player_report', { p_report_id: reportId, p_visibility: visibility })
  if (error) throw new Error(error.message)
}
