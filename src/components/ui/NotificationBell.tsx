interface NotificationBellProps {
  hasUnread: boolean
  onClick: () => void
  className?: string
}

/**
 * Bell icon button with an unread badge dot.
 * Designed to sit in the dashboard header — clicking navigates to Messages.
 */
export function NotificationBell({ hasUnread, onClick, className = '' }: NotificationBellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasUnread ? 'You have unread messages — go to Messages' : 'Messages'}
      className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition active:bg-white/20 hover:bg-white/20 ${className}`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {hasUnread ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#f18a3f] ring-2 ring-[#1565ff]"
        />
      ) : null}
    </button>
  )
}
