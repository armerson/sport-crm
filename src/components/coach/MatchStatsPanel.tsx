import { useEffect, useState } from 'react'
import { fetchMatchStats, upsertPlayerMatchStat } from '../../services/playerMatchStats.ts'
import type { PlayerMatchStat } from '../../types/club.ts'

interface Player { id: string; name: string }

interface MatchStatsPanelProps {
  eventId: string
  teamId: string
  /** Players who attended (status = 'yes') */
  attendingPlayers: Player[]
}

function StatCounter({
  label,
  value,
  onChange,
  max,
  colour,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  max: number
  colour: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${colour}`}>{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition"
        >−</button>
        <span className="w-6 text-center text-sm font-bold tabular-nums text-slate-900">{value}</span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition"
        >+</button>
      </div>
    </div>
  )
}

export function MatchStatsPanel({ eventId, teamId, attendingPlayers }: MatchStatsPanelProps) {
  const [stats, setStats] = useState<Map<string, PlayerMatchStat>>(new Map())
  const [edits, setEdits] = useState<Map<string, Partial<PlayerMatchStat>>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    fetchMatchStats(eventId)
      .then((rows) => {
        setStats(new Map(rows.map((r) => [r.playerId, r])))
      })
      .catch(() => undefined)
  }, [eventId])

  function getVal(playerId: string, field: keyof PlayerMatchStat): number {
    return (edits.get(playerId)?.[field] ?? stats.get(playerId)?.[field] ?? 0) as number
  }

  function setVal(playerId: string, field: keyof PlayerMatchStat, value: number) {
    setEdits((prev) => {
      const next = new Map(prev)
      next.set(playerId, { ...(next.get(playerId) ?? {}), [field]: value })
      return next
    })
  }

  async function save(playerId: string) {
    setSaving(playerId)
    try {
      await upsertPlayerMatchStat({
        eventId,
        playerId,
        teamId,
        goals:       getVal(playerId, 'goals'),
        assists:     getVal(playerId, 'assists'),
        yellowCards: getVal(playerId, 'yellowCards'),
        redCards:    getVal(playerId, 'redCards'),
      })
      // Merge edits into saved stats
      setStats((prev) => {
        const next = new Map(prev)
        next.set(playerId, {
          id: prev.get(playerId)?.id ?? '',
          eventId, playerId, teamId,
          goals:       getVal(playerId, 'goals'),
          assists:     getVal(playerId, 'assists'),
          yellowCards: getVal(playerId, 'yellowCards'),
          redCards:    getVal(playerId, 'redCards'),
        })
        return next
      })
      setEdits((prev) => { const next = new Map(prev); next.delete(playerId); return next })
      setSaved(playerId)
      setTimeout(() => setSaved(null), 1500)
    } catch {
      // silent — user can retry
    } finally {
      setSaving(null)
    }
  }

  if (attendingPlayers.length === 0) return null

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <h3 className="mb-3 font-semibold text-slate-900">Player stats</h3>
      <div className="space-y-2">
        {attendingPlayers.map((player) => {
          const isDirty = edits.has(player.id)
          const isSaving = saving === player.id
          const justSaved = saved === player.id
          return (
            <div
              key={player.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">{player.name}</p>
                {isDirty && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void save(player.id)}
                    className="shrink-0 rounded-full bg-[#1565ff] px-3 py-1 text-xs font-bold text-white disabled:opacity-60 transition"
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                )}
                {!isDirty && justSaved && (
                  <span className="shrink-0 text-xs font-semibold text-emerald-600">✓ Saved</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatCounter label="⚽ Goals"  value={getVal(player.id, 'goals')}       onChange={(v) => setVal(player.id, 'goals',       v)} max={20} colour="text-slate-600" />
                <StatCounter label="🎯 Assists" value={getVal(player.id, 'assists')}     onChange={(v) => setVal(player.id, 'assists',     v)} max={20} colour="text-slate-600" />
                <StatCounter label="🟨 Yellow"  value={getVal(player.id, 'yellowCards')} onChange={(v) => setVal(player.id, 'yellowCards', v)} max={2}  colour="text-amber-600" />
                <StatCounter label="🟥 Red"     value={getVal(player.id, 'redCards')}    onChange={(v) => setVal(player.id, 'redCards',    v)} max={1}  colour="text-red-600"   />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
