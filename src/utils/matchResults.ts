import type { EventRecord, ResultRecord } from '../types/club.ts'

export type MatchOutcome = 'W' | 'D' | 'L'

export function resultFromTeamPerspective(
  event: Pick<EventRecord, 'homeAway'>,
  result: Pick<ResultRecord, 'homeScore' | 'awayScore'>,
): { goalsFor: number; goalsAgainst: number; outcome: MatchOutcome } {
  const goalsFor = event.homeAway === 'away' ? result.awayScore : result.homeScore
  const goalsAgainst = event.homeAway === 'away' ? result.homeScore : result.awayScore
  const outcome = goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L'

  return { goalsFor, goalsAgainst, outcome }
}
