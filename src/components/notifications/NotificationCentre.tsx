import type { MemberNotification } from '../../hooks/useMemberNotifications.ts'

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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
  const totalUnread = unread + (hasUnreadMessages ? 1 : 0)
  return (
    <section className="mx-auto max-w-3xl space-y-4 ui-view-enter">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-accent)]">Inbox</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Club updates, registrations and team activity.</p>
        </div>
        <button type="button" onClick={onClose} className="ui-button ui-button-secondary shrink-0">Done</button>
      </header>
      {totalUnread > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <span><strong>{totalUnread}</strong> unread update{totalUnread === 1 ? '' : 's'}</span>
          {unread > 0 ? <button type="button" onClick={onMarkAllRead} className="min-h-11 font-semibold text-blue-700">Mark alerts read</button> : null}
        </div>
      ) : null}
      {hasUnreadMessages ? (
        <button type="button" onClick={onOpenMessages} className="group flex min-h-20 w-full items-center gap-4 rounded-xl border border-[var(--ui-accent)]/25 bg-white p-4 text-left shadow-[var(--ui-shadow)] transition hover:border-[var(--ui-accent)]/50">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ui-accent)]/10 text-[var(--ui-accent)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
          </span>
          <span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">New team messages</strong><span className="mt-1 block text-sm text-slate-500">Open conversations to catch up.</span></span><span aria-hidden="true" className="text-xl text-[var(--ui-accent)] transition group-hover:translate-x-0.5">→</span>
        </button>
      ) : null}
      {loading ? <div aria-label="Loading notifications" className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="ui-panel flex gap-3 p-4"><span className="ui-skeleton mt-1 h-3 w-3 shrink-0 rounded-full" /><span className="min-w-0 flex-1 space-y-2"><span className="ui-skeleton block h-4 w-2/5 rounded-lg" /><span className="ui-skeleton block h-4 w-4/5 rounded-lg" /></span></div>)}</div> : null}
      {!loading && items.length === 0 && !hasUnreadMessages ? <div className="ui-empty"><span aria-hidden="true" className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">✓</span><p className="font-semibold text-slate-800">You&apos;re all caught up</p><p className="mt-1">Team alerts and registration updates will appear here.</p></div> : null}
      <div className="space-y-2">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpen(item)} className={`flex min-h-20 w-full gap-3 rounded-xl border p-4 text-left shadow-[0_1px_2px_#10182808] transition hover:border-slate-300 active:scale-[0.99] ${item.readAt ? 'border-[var(--ui-border)] bg-white' : 'border-[var(--ui-accent)]/25 bg-[var(--ui-accent)]/[0.045]'}`}>
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-300' : 'bg-[var(--ui-accent)]'}`} />
            <span className="min-w-0 flex-1"><span className="flex justify-between gap-3"><strong className="text-sm text-slate-900">{item.title}</strong><span className="shrink-0 text-xs text-slate-500">{relativeTime(item.createdAt)}</span></span><span className="mt-1 block text-sm leading-6 text-slate-600">{item.body}</span></span>
          </button>
        ))}
      </div>
    </section>
  )
}
