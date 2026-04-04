import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install-banner-dismissed'

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  // Exclude Chrome, Firefox, Opera on iOS — they show the banner natively or can't install
  const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|mercury/i.test(ua)
  return isIos && isSafari
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari standalone check
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-1px]">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    if (dismissed || isStandalone()) return

    // Android / Chrome — native install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari — no install prompt API, show manual hint instead
    if (isIosSafari()) {
      setShowIosHint(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [dismissed])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
    setDeferredPrompt(null)
    setShowIosHint(false)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      dismiss()
    } else {
      setDeferredPrompt(null)
    }
  }

  if (dismissed || isStandalone()) return null
  if (!deferredPrompt && !showIosHint) return null

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#123524]/20 bg-[#123524]/5 px-4 py-3">
      <div className="flex items-start gap-2.5 text-[#123524]">
        <span className="mt-0.5 shrink-0">
          <PhoneIcon />
        </span>
        <div className="text-sm">
          <p className="font-semibold">Install Club CRM</p>
          {deferredPrompt ? (
            <p className="mt-0.5 text-[#123524]/70">Add to your home screen for quick one-tap access.</p>
          ) : (
            <p className="mt-0.5 text-[#123524]/70">
              Tap <ShareIcon /> <strong>Share</strong> then <strong>Add to Home Screen</strong> to install.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {deferredPrompt ? (
          <button
            className="rounded-xl bg-[#123524] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a4a33]"
            onClick={() => void handleInstall()}
            type="button"
          >
            Install
          </button>
        ) : null}
        <button
          aria-label="Dismiss"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#123524]/40 transition hover:bg-[#123524]/10 hover:text-[#123524]/70"
          onClick={dismiss}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
