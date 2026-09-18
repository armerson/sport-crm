import { useEffect, useMemo, useState } from 'react'
import type { AttendanceRecord, AttendanceReminderRecord, PlayerRecord } from '../../types/club.ts'

interface ReminderResult {
  recipients: number
  players: number
  skipped: number
  sentAt: string | null
}

interface AttendanceReminderPanelProps {
  eventId: string
  attendance: AttendanceRecord[]
  players: PlayerRecord[]
  reminders: AttendanceReminderRecord[]
  sending: boolean
  onSend: (playerIds: string[]) => Promise<ReminderResult>
}

function reminderTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function AttendanceReminderPanel({ eventId, attendance, players, reminders, sending, onSend }: AttendanceReminderPanelProps) {
  const pendingIds = useMemo(
    () => attendance.filter((entry) => entry.status === 'pending').map((entry) => entry.playerId),
    [attendance],
  )
  const pendingKey = pendingIds.join('|')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])
  const remindersByPlayer = useMemo(() => new Map(reminders.map((reminder) => [reminder.playerId, reminder])), [reminders])

  useEffect(() => {
    setSelectedIds(new Set(pendingIds))
    setMessage(null)
    // pendingKey deliberately captures status changes without depending on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, pendingKey])

  if (!pendingIds.length) return null

  const selectedCount = pendingIds.filter((playerId) => selectedIds.has(playerId)).length
  const allSelected = selectedCount === pendingIds.length

  function toggle(playerId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
    setMessage(null)
  }

  async function send() {
    setMessage(null)
    try {
      const result = await onSend(pendingIds.filter((playerId) => selectedIds.has(playerId)))
      if (!result.players) {
        setMessage('No linked parent or player accounts were found for this selection.')
        return
      }
      const skipped = result.skipped ? ` ${result.skipped} player${result.skipped === 1 ? '' : 's'} had no linked account.` : ''
      setMessage(`Reminder recorded for ${result.players} player${result.players === 1 ? '' : 's'} and sent to ${result.recipients} member${result.recipients === 1 ? '' : 's'}.${skipped}`)
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : 'The reminder could not be sent. Please try again.')
    }
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70" aria-labelledby="attendance-reminder-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-200/70 px-4 py-3">
        <div>
          <h3 id="attendance-reminder-title" className="font-semibold text-slate-950">Send attendance reminder</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">Choose who should be reminded to reply.</p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedIds(allSelected ? new Set() : new Set(pendingIds))}
          className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div className="max-h-64 divide-y divide-amber-100 overflow-y-auto px-4">
        {pendingIds.map((playerId) => {
          const reminder = remindersByPlayer.get(playerId)
          const playerName = playersById.get(playerId)?.name ?? 'Unknown player'
          return (
            <label key={playerId} className="flex cursor-pointer items-center gap-3 py-3">
              <input
                type="checkbox"
                checked={selectedIds.has(playerId)}
                onChange={() => toggle(playerId)}
                className="h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{playerName}</span>
                <span className="block text-xs text-slate-500">
                  {reminder ? `Last reminded ${reminderTime(reminder.sentAt)}${reminder.source === 'automatic' ? ' automatically' : ''}` : 'No reminder sent yet'}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      <div className="border-t border-amber-200/70 p-4">
        <button
          type="button"
          disabled={sending || selectedCount === 0}
          onClick={() => void send()}
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sending reminders…' : selectedCount ? `Send reminder to ${selectedCount}` : 'Select players to remind'}
        </button>
        {message ? <p role="status" className="mt-3 text-xs font-medium leading-5 text-slate-600">{message}</p> : null}
        <p className="mt-2 text-xs leading-5 text-slate-500">Players still awaiting a response also receive one automatic reminder about a day before the event.</p>
      </div>
    </section>
  )
}
