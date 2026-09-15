import type { MemberNotification } from '../../hooks/useMemberNotifications.ts'
import { formatDateShort } from '../../utils/date.ts'

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return formatDateShort(value)
}

export function NotificationCentre({ items, loading, hasUnreadMessages, onClose, onMarkAllRead, onOpen, onOpenMessages }: {
  items: MemberNotification[]
  loading: boolean
  hasUnreadMessages: boolean
  onClose: () => void
  onMarkAllRead: () => void
  onOpen: (item: MemberNotification) => void
  onOpenMessages: () => void
}) {
  const unread = items.filter((item) => !item.readAt).length
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Inbox</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Notifications</h1></div>
        <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">Done</button>
      </div>
      {(unread > 0 || hasUnreadMessages) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span>{unread + (hasUnreadMessages ? 1 : 0)} unread update{unread + (hasUnreadMessages ? 1 : 0) === 1 ? '' : 's'}</span>
          {unread > 0 ? <button type="button" onClick={onMarkAllRead} className="font-semibold text-blue-700">Mark alerts read</button> : null}
        </div>
      ) : null}
      {hasUnreadMessages ? (
        <button type="button" onClick={onOpenMessages} className="flex w-full items-center justify-between rounded-2xl border border-blue-200 bg-white p-4 text-left shadow-sm">
          <span><strong className="block text-sm text-slate-900">New team messages</strong><span className="mt-1 block text-xs text-slate-500">Open your conversations to read them.</span></span><span className="text-blue-600">→</span>
        </button>
      ) : null}
      {loading ? <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading notifications…</div> : null}
      {!loading && items.length === 0 && !hasUnreadMessages ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><p className="font-semibold text-slate-800">You&apos;re all caught up</p><p className="mt-1 text-sm text-slate-500">Team alerts and registration updates will appear here.</p></div> : null}
      <div className="space-y-2">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpen(item)} className={`flex w-full gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${item.readAt ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/60'}`}>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-blue-500'}`} />
            <span className="min-w-0 flex-1"><span className="flex justify-between gap-3"><strong className="text-sm text-slate-900">{item.title}</strong><span className="shrink-0 text-[11px] text-slate-400">{relativeTime(item.createdAt)}</span></span><span className="mt-1 block text-sm leading-5 text-slate-600">{item.body}</span></span>
          </button>
        ))}
      </div>
    </section>
  )
}
