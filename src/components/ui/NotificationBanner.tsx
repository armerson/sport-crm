import { useEffect, useState } from 'react'
import { getNotificationPermission, isPushSupported, requestPermissionAndSubscribe } from '../../lib/pushNotifications.ts'

const VAPID_CONFIGURED = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY)

interface NotificationBannerProps {
  userId: string
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function BellOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

const DISMISS_KEY = 'push_banner_dismissed'

export function NotificationBanner({ userId }: NotificationBannerProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    if (!isPushSupported()) return
    setPermission(getNotificationPermission())
  }, [])

  if (!isPushSupported() || !VAPID_CONFIGURED || permission === 'denied' || permission === 'granted' || dismissed) {
    return null
  }

  async function handleEnable() {
    setLoading(true)
    await requestPermissionAndSubscribe(userId)
    // Always read the real browser permission afterwards — prevents the banner
    // from reappearing on next load when the subscribe call returned early.
    setPermission(getNotificationPermission())
    setLoading(false)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2.5 text-sm text-amber-900">
        <span className="shrink-0 text-amber-600">
          <BellIcon />
        </span>
        <span className="font-medium">Enable push notifications to stay on top of events, attendance, and messages.</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
        >
          {loading ? 'Enabling…' : 'Enable'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-amber-500 transition hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <BellOffIcon />
        </button>
      </div>
    </div>
  )
}
