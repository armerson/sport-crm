import { requireSupabase } from './supabaseHelpers.ts'

export interface TestDefinition {
  id: string
  categoryId: string
  categoryName: string
  name: string
  unit: string
  description: string | null
  higherIsBetter: boolean
  minimumAge: number | null
  maximumAge: number | null
  decimalPlaces: number
}

export interface TestCategory { id: string; name: string }

export interface TestingEvent {
  id: string
  name: string
  eventDate: string
  location: string | null
  status: 'draft' | 'open' | 'completed' | 'cancelled'
  createdBy: string | null
  teamIds: string[]
  playerIds: string[]
  testIds: string[]
}

export interface TestResult {
  id: string
  playerId: string
  testDefinitionId: string
  testingEventId: string | null
  resultValue: number
  testedAt: string
  notes: string | null
  visibility: 'staff' | 'player' | 'parent'
}

function mapDefinition(row: Record<string, unknown>): TestDefinition {
  const category = row.test_categories as { name?: unknown } | null
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    categoryName: typeof category?.name === 'string' ? category.name : 'Testing',
    name: String(row.name),
    unit: String(row.unit),
    description: typeof row.description === 'string' ? row.description : null,
    higherIsBetter: row.higher_is_better === true,
    minimumAge: typeof row.minimum_age === 'number' ? row.minimum_age : null,
    maximumAge: typeof row.maximum_age === 'number' ? row.maximum_age : null,
    decimalPlaces: Number(row.decimal_places),
  }
}

function mapResult(row: Record<string, unknown>): TestResult {
  return {
    id: String(row.id),
    playerId: String(row.player_id),
    testDefinitionId: String(row.test_definition_id),
    testingEventId: typeof row.testing_event_id === 'string' ? row.testing_event_id : null,
    resultValue: Number(row.result_value),
    testedAt: String(row.tested_at),
    notes: typeof row.notes === 'string' ? row.notes : null,
    visibility: row.visibility as TestResult['visibility'],
  }
}

export async function fetchTestDefinitions(): Promise<TestDefinition[]> {
  const { data, error } = await requireSupabase()
    .from('test_definitions')
    .select('*, test_categories(name)')
    .eq('active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDefinition(row as Record<string, unknown>))
}

export async function fetchTestCategories(): Promise<TestCategory[]> {
  const { data, error } = await requireSupabase().from('test_categories').select('id, name').eq('active', true).order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }))
}

export async function createTestDefinition(input: {
  categoryId: string; name: string; unit: string; description: string;
  higherIsBetter: boolean; minimumAge: number | null; maximumAge: number | null; decimalPlaces: number;
}): Promise<TestDefinition> {
  const { data, error } = await requireSupabase().from('test_definitions').insert({
    category_id: input.categoryId, name: input.name.trim(), unit: input.unit.trim(),
    description: input.description.trim() || null, higher_is_better: input.higherIsBetter,
    minimum_age: input.minimumAge, maximum_age: input.maximumAge, decimal_places: input.decimalPlaces,
  }).select('*, test_categories(name)').single()
  if (error) throw new Error(error.message)
  return mapDefinition(data as Record<string, unknown>)
}

export async function fetchPlayerTestResults(playerId: string): Promise<TestResult[]> {
  const { data, error } = await requireSupabase()
    .from('test_results')
    .select('id, player_id, test_definition_id, testing_event_id, result_value, tested_at, notes, visibility')
    .eq('player_id', playerId)
    .order('tested_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapResult(row as Record<string, unknown>))
}

export async function fetchTestingEvents(teamId: string): Promise<TestingEvent[]> {
  const client = requireSupabase()
  const { data: links, error: linkError } = await client.from('testing_event_teams').select('testing_event_id').eq('team_id', teamId)
  if (linkError) throw new Error(linkError.message)
  const ids = (links ?? []).map((row) => String(row.testing_event_id))
  if (ids.length === 0) return []
  const [{ data: events, error }, { data: teams, error: teamsError }, { data: players, error: playersError }, { data: tests, error: testsError }] = await Promise.all([
    client.from('testing_events').select('id, name, event_date, location, status, created_by').in('id', ids).order('event_date', { ascending: false }),
    client.from('testing_event_teams').select('testing_event_id, team_id').in('testing_event_id', ids),
    client.from('testing_event_players').select('testing_event_id, player_id').in('testing_event_id', ids),
    client.from('testing_event_tests').select('testing_event_id, test_definition_id').in('testing_event_id', ids).order('sort_order'),
  ])
  if (error) throw new Error(error.message)
  if (teamsError) throw new Error(teamsError.message)
  if (playersError) throw new Error(playersError.message)
  if (testsError) throw new Error(testsError.message)
  return (events ?? []).map((row) => ({
    id: String(row.id), name: String(row.name), eventDate: String(row.event_date),
    location: typeof row.location === 'string' ? row.location : null,
    status: row.status as TestingEvent['status'],
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    teamIds: (teams ?? []).filter((item) => item.testing_event_id === row.id).map((item) => String(item.team_id)),
    playerIds: (players ?? []).filter((item) => item.testing_event_id === row.id).map((item) => String(item.player_id)),
    testIds: (tests ?? []).filter((item) => item.testing_event_id === row.id).map((item) => String(item.test_definition_id)),
  }))
}

export async function createTestingEvent(input: {
  name: string
  eventDate: string
  location: string
  teamId: string
  playerIds: string[]
  testIds: string[]
  createdBy: string
}): Promise<TestingEvent> {
  const client = requireSupabase()
  const { data, error } = await client.from('testing_events').insert({
    name: input.name.trim(), event_date: input.eventDate, location: input.location.trim() || null,
    status: 'draft', created_by: input.createdBy,
  }).select('id, name, event_date, location, status, created_by').single()
  if (error) throw new Error(error.message)
  const eventId = String(data.id)
  try {
    const operations = [
      client.from('testing_event_teams').insert({ testing_event_id: eventId, team_id: input.teamId }),
      client.from('testing_event_players').insert(input.playerIds.map((playerId) => ({ testing_event_id: eventId, player_id: playerId }))),
      client.from('testing_event_tests').insert(input.testIds.map((testId, index) => ({ testing_event_id: eventId, test_definition_id: testId, sort_order: index }))),
    ]
    const results = await Promise.all(operations)
    const failed = results.find((result) => result.error)
    if (failed?.error) throw new Error(failed.error.message)
    const { error: openError } = await client.from('testing_events').update({ status: 'open' }).eq('id', eventId)
    if (openError) throw new Error(openError.message)
  } catch (reason) {
    await client.from('testing_events').delete().eq('id', eventId)
    throw reason
  }
  return {
    id: eventId, name: String(data.name), eventDate: String(data.event_date),
    location: typeof data.location === 'string' ? data.location : null,
    status: 'open', createdBy: String(data.created_by),
    teamIds: [input.teamId], playerIds: input.playerIds, testIds: input.testIds,
  }
}

export async function fetchTestingEventResults(eventId: string): Promise<TestResult[]> {
  const { data, error } = await requireSupabase().from('test_results')
    .select('id, player_id, test_definition_id, testing_event_id, result_value, tested_at, notes, visibility')
    .eq('testing_event_id', eventId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapResult(row as Record<string, unknown>))
}

export async function saveTestingResult(input: {
  eventId: string
  playerId: string
  testDefinitionId: string
  value: number
  testedAt: string
  recordedBy: string
}): Promise<TestResult> {
  const client = requireSupabase()
  const { data: existing, error: findError } = await client.from('test_results').select('id')
    .eq('testing_event_id', input.eventId).eq('player_id', input.playerId)
    .eq('test_definition_id', input.testDefinitionId).maybeSingle()
  if (findError) throw new Error(findError.message)
  const query = existing
    ? client.from('test_results').update({ result_value: input.value, tested_at: input.testedAt }).eq('id', existing.id)
    : client.from('test_results').insert({
      testing_event_id: input.eventId, player_id: input.playerId,
      test_definition_id: input.testDefinitionId, result_value: input.value,
      tested_at: input.testedAt, recorded_by: input.recordedBy,
    })
  const { data, error } = await query.select('id, player_id, test_definition_id, testing_event_id, result_value, tested_at, notes, visibility').single()
  if (error) throw new Error(error.message)
  return mapResult(data as Record<string, unknown>)
}

export async function completeTestingEvent(eventId: string): Promise<void> {
  const { error } = await requireSupabase().from('testing_events').update({ status: 'completed' }).eq('id', eventId)
  if (error) throw new Error(error.message)
}
