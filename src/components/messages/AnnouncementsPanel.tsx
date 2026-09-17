import { useMemo, useState } from 'react'
import { useAnnouncements } from '../../hooks/useAnnouncements.ts'
import { subscribeToUserProfilesByIds } from '../../services/messages.ts'
import { useEffect } from 'react'
import type { UserProfile } from '../../types/auth.ts'
import { formatDateTime } from '../../utils/date.ts'

interface AnnouncementsPanelProps {
  profile: UserProfile
}

export function AnnouncementsPanel({ profile }: AnnouncementsPanelProps) {
  const { announcements, loading } = useAnnouncements()
  const [senders, setSenders] = useState<UserProfile[]>([])
  const [open, setOpen] = useState(true)

  const senderIds = useMemo(
    () => [...new Set(announcements.map((a) => a.senderId).filter(Boolean))],
    [announcements],
  )

  useEffect(() => {
    if (senderIds.length === 0) return undefined
    return subscribeToUserProfilesByIds(senderIds, setSenders, () => undefined)
  }, [senderIds])

  if (!loading && announcements.length === 0) return null

  const senderById = new Map([...senders, profile].map((s) => [s.id, s]))

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
      <button
        type="button"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ui-accent)]/10 text-[var(--ui-accent)]"><svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
          </svg></span>
          <span className="text-sm font-semibold text-slate-900">
            Announcements
            {!loading ? (
              <span className="ml-2 rounded-full bg-[var(--ui-accent)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--ui-accent)]">
                {announcements.length}
              </span>
            ) : null}
          </span>
        </div>
        <svg
          className={`size-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open ? (
        <div className="max-h-72 space-y-2 overflow-y-auto border-t border-[var(--ui-border)] bg-slate-50/70 p-3">
          {loading ? (
            <div className="space-y-2" aria-label="Loading announcements">{[1, 2].map((item) => <div key={item} className="rounded-xl border border-slate-100 bg-white p-4"><span className="ui-skeleton block h-3 w-1/3 rounded-lg" /><span className="ui-skeleton mt-3 block h-4 w-4/5 rounded-lg" /></div>)}</div>
          ) : (
            announcements.map((msg) => {
              const sender = senderById.get(msg.senderId)
              return (
                <article key={msg.id} className="rounded-xl border border-[var(--ui-border)] bg-white px-4 py-3 shadow-[0_1px_2px_#10182808]">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
                    <span className="text-[var(--ui-accent)]">
                      {msg.groupId ? 'Group update' : 'Club-wide'}
                    </span>
                    <span className="text-slate-400">{formatDateTime(msg.timestamp)}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{msg.content}</p>
                  {sender ? (
                    <p className="mt-1 text-xs text-slate-400">{sender.name}</p>
                  ) : null}
                </article>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
