import { requireSupabase } from './supabaseHelpers.ts'

export interface DevelopmentDashboardGoal {
  id: string
  playerId: string
  title: string
  status: 'not_started' | 'in_progress' | 'achieved' | 'paused'
  priority: 'low' | 'medium' | 'high'
  progress: number
  targetDate: string | null
  updatedAt: string
}

export interface DevelopmentDashboardReview {
  id: string
  playerId: string
  periodLabel: string
  status: 'draft' | 'published'
  assessmentDate: string
  updatedAt: string
}

export interface DevelopmentDashboardTestingEvent {
  id: string
  name: string
  eventDate: string
  status: 'draft' | 'open' | 'completed' | 'cancelled'
  location: string | null
}

export interface DevelopmentDashboardRecommendation {
  id: string
  playerId: string
  status: 'monitoring' | 'ready' | 'progressed' | 'closed'
  recommendation: string
  reviewDate: string | null
}

export interface DevelopmentDashboardData {
  goals: DevelopmentDashboardGoal[]
  reviews: DevelopmentDashboardReview[]
  testingEvents: DevelopmentDashboardTestingEvent[]
  recommendations: DevelopmentDashboardRecommendation[]
}

export async function fetchDevelopmentDashboard(): Promise<DevelopmentDashboardData> {
  const client = requireSupabase()
  const [{ data: goals, error: goalsError }, { data: reviews, error: reviewsError }, { data: testingEvents, error: testingError }, { data: recommendations, error: pathwayError }] = await Promise.all([
    client.from('player_development_goals')
      .select('id, player_id, title, status, priority, progress, target_date, updated_at')
      .is('archived_at', null)
      .order('target_date', { ascending: true, nullsFirst: false }),
    client.from('player_reviews')
      .select('id, player_id, period_label, status, assessment_date, updated_at')
      .order('assessment_date', { ascending: false }),
    client.from('testing_events')
      .select('id, name, event_date, status, location')
      .in('status', ['draft', 'open'])
      .order('event_date', { ascending: true }),
    client.from('pathway_recommendations')
      .select('id, player_id, status, recommendation, review_date')
      .in('status', ['monitoring', 'ready'])
      .order('review_date', { ascending: true, nullsFirst: false }),
  ])
  if (goalsError) throw new Error(goalsError.message)
  if (reviewsError) throw new Error(reviewsError.message)
  if (testingError) throw new Error(testingError.message)
  if (pathwayError) throw new Error(pathwayError.message)

  return {
    goals: (goals ?? []).map((row) => ({
      id: String(row.id), playerId: String(row.player_id), title: String(row.title),
      status: row.status as DevelopmentDashboardGoal['status'], priority: row.priority as DevelopmentDashboardGoal['priority'],
      progress: Number(row.progress), targetDate: typeof row.target_date === 'string' ? row.target_date : null, updatedAt: String(row.updated_at),
    })),
    reviews: (reviews ?? []).map((row) => ({
      id: String(row.id), playerId: String(row.player_id), periodLabel: String(row.period_label),
      status: row.status === 'published' ? 'published' : 'draft', assessmentDate: String(row.assessment_date), updatedAt: String(row.updated_at),
    })),
    testingEvents: (testingEvents ?? []).map((row) => ({
      id: String(row.id), name: String(row.name), eventDate: String(row.event_date),
      status: row.status as DevelopmentDashboardTestingEvent['status'], location: typeof row.location === 'string' ? row.location : null,
    })),
    recommendations: (recommendations ?? []).map((row) => ({
      id: String(row.id), playerId: String(row.player_id), status: row.status as DevelopmentDashboardRecommendation['status'],
      recommendation: String(row.recommendation), reviewDate: typeof row.review_date === 'string' ? row.review_date : null,
    })),
  }
}
