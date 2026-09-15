import type { EventRecord, TeamRecord } from '../../types/club.ts'
import { downloadEventCalendar, googleCalendarUrl } from '../../services/calendar.ts'

export function EventCalendarActions({ event, team }: { event: EventRecord; team?: TeamRecord }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => downloadEventCalendar(event, team)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 active:scale-[0.98]">
        Add to calendar
      </button>
      <a href={googleCalendarUrl(event, team)} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 active:scale-[0.98]">
        Google Calendar
      </a>
    </div>
  )
}
