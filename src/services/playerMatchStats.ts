import { requireSupabase } from './supabaseHelpers.ts'
import type { PlayerMatchStat } from '../types/club.ts'

function mapStatRow(row: Record<string, unknown>): PlayerMatchStat {
  return {
    id:          String(row.id ?? ''),
    eventId:     String(row.event_id ?? ''),
    playerId:    String(row.player_id ?? ''),
    teamId:      String(row.team_id ?? ''),
    goals:       Number(row.goals ?? 0),
    assists:     Number(row.assists ?? 0),
    yellowCards: Number(row.yellow_cards ?? 0),
    redCards:    Number(row.red_cards ?? 0),
  }
}

/** Fetch all player stats for a single match event. */
export async function fetchMatchStats(eventId: string): Promise<PlayerMatchStat[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_match_stats')
    .select('id, event_id, player_id, team_id, goals, assists, yellow_cards, red_cards')
    .eq('event_id', eventId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapStatRow(r as Record<string, unknown>))
}

/** Fetch all stats for a team across the season (for top-scorers etc.). */
export async function fetchSeasonStats(teamId: string): Promise<PlayerMatchStat[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_match_stats')
    .select('id, event_id, player_id, team_id, goals, assists, yellow_cards, red_cards')
    .eq('team_id', teamId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapStatRow(r as Record<string, unknown>))
}

/** Upsert a single player's stats for a match (insert or update). */
export async function upsertPlayerMatchStat(stat: {
  eventId: string
  playerId: string
  teamId: string
  goals: number
  assists: number
  yellowCards: number
  redCards: number
}): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('player_match_stats')
    .upsert({
      event_id:     stat.eventId,
      player_id:    stat.playerId,
      team_id:      stat.teamId,
      goals:        stat.goals,
      assists:      stat.assists,
      yellow_cards: stat.yellowCards,
      red_cards:    stat.redCards,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'event_id,player_id' })
  if (error) throw new Error(error.message)
}
