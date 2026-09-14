import { useEffect, useState } from 'react'

interface SuccessMessageProps {
  message: string | null
  durationMs?: number
}

export function SuccessMessage({ message, durationMs = 4000 }: SuccessMessageProps) {
  return message ? <TimedSuccessMessage key={`${message}:${durationMs}`} message={message} durationMs={durationMs} /> : null
}

function TimedSuccessMessage({ message, durationMs }: { message: string; durationMs: number }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), durationMs)
    return () => clearTimeout(timer)
  }, [durationMs])
  if (!visible) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="ui-toast-enter fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[min(92vw,28rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-900 shadow-xl shadow-slate-900/15 sm:bottom-6"
    >
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>
      <span className="pt-0.5 leading-5">{message}</span>
    </div>
  )
}
