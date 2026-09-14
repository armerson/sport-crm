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
    <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
      {message}
    </div>
  )
}
