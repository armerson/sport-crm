interface NotificationBellProps {
  hasUnread: boolean
  unreadCount?: number
  onClick: () => void
  className?: string
}

/**
 * Bell icon button with an unread badge dot.
 * Designed to sit in the dashboard header — clicking navigates to Messages.
 */
export function NotificationBell({ hasUnread, unreadCount = 0, onClick, className = '' }: NotificationBellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasUnread ? `${unreadCount || 1} unread notifications` : 'Notifications'}
      className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition active:bg-white/20 hover:bg-white/20 ${className}`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {hasUnread ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#f18a3f] px-1 text-[9px] font-bold text-slate-950 ring-2 ring-[#1565ff]"
        >{unreadCount > 0 ? Math.min(unreadCount, 9) : ''}</span>
      ) : null}
    </button>
  )
}
