import { useMemo, useState } from 'react'
import { useAnnouncements } from '../../hooks/useAnnouncements.ts'
import { subscribeToUserProfilesByIds } from '../../services/messages.ts'
import { useEffect } from 'react'
import type { UserProfile } from '../../types/auth.ts'
import { formatDateTime } from '../../utils/date.ts'

interface AnnouncementsPanelProps {
  profile: UserProfile
}

export function AnnouncementsPanel({ profile: _profile }: AnnouncementsPanelProps) {
  const { announcements, loading } = useAnnouncements()
  const [senders, setSenders] = useState<UserProfile[]>([])
  const [open, setOpen] = useState(true)

  const senderIds = useMemo(
    () => [...new Set(announcements.map((a) => a.senderId).filter(Boolean))],
    [announcements],
  )

  useEffect(() => {
    if (senderIds.length === 0) { setSenders([]); return undefined }
    return subscribeToUserProfilesByIds(senderIds, setSenders, () => undefined)
  }, [senderIds])

  if (!loading && announcements.length === 0) return null

  const senderById = new Map(senders.map((s) => [s.id, s]))

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <svg className="size-4 text-[#1565ff]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
          </svg>
          <span className="text-sm font-semibold text-slate-900">
            Announcements
            {!loading ? (
              <span className="ml-2 rounded-full bg-[#1565ff] px-2 py-0.5 text-xs font-semibold text-white">
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
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            announcements.map((msg) => {
              const sender = senderById.get(msg.senderId)
              return (
                <div key={msg.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
                    <span className="text-[#1565ff]">
                      {msg.groupId ? '📢 Group' : '📣 Club-wide'}
                    </span>
                    <span className="text-slate-400">{formatDateTime(msg.timestamp)}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{msg.content}</p>
                  {sender ? (
                    <p className="mt-1 text-xs text-slate-400">{sender.name}</p>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
