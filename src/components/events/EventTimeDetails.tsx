import type { EventRecord } from '../../types/club.ts'

function time(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function EventTimeDetails({ event, compact = false }: { event: EventRecord; compact?: boolean }) {
  if (!event.meetTime && !event.endTime) return null
  const items = [
    event.meetTime ? `Meet ${time(event.meetTime)}` : null,
    `${event.type === 'match' ? 'Kick-off' : 'Starts'} ${time(event.dateTime)}`,
    event.endTime ? `Finish ${time(event.endTime)}` : null,
  ].filter(Boolean)
  return <p className={compact ? 'text-xs font-medium text-blue-700' : 'text-sm font-medium text-slate-700'}>{items.join(' · ')}</p>
}
