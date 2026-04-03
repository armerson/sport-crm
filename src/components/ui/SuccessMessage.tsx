import { useEffect, useState } from 'react'

interface SuccessMessageProps {
  message: string | null
  durationMs?: number
}

export function SuccessMessage({ message, durationMs = 4000 }: SuccessMessageProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }

    setVisible(true)
    const timer = setTimeout(() => setVisible(false), durationMs)
    return () => clearTimeout(timer)
  }, [message, durationMs])

  if (!visible || !message) {
    return null
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
      {message}
    </div>
  )
}
