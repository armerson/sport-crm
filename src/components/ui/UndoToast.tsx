import { useEffect, useRef, useState } from 'react'

interface UndoToastProps {
  message: string
  /** Milliseconds before the deletion is committed. Default: 5000 */
  duration?: number
  onUndo: () => void
  onConfirm: () => void
}

/**
 * Dark-bar toast with a countdown and an Undo button.
 * The parent is responsible for rendering it conditionally — mount to show, unmount to hide.
 *
 * Usage:
 *   const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
 *
 *   function handleDelete(id) {
 *     setPendingDelete({ id })
 *   }
 *
 *   {pendingDelete ? (
 *     <UndoToast
 *       message="Event deleted"
 *       onUndo={() => setPendingDelete(null)}
 *       onConfirm={() => { reallyDelete(pendingDelete.id); setPendingDelete(null) }}
 *     />
 *   ) : null}
 */
export function UndoToast({ message, duration = 5000, onUndo, onConfirm }: UndoToastProps) {
  const [remaining, setRemaining] = useState(duration)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const confirmRef = useRef(onConfirm)
  confirmRef.current = onConfirm

  useEffect(() => {
    const step = 50
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= step) {
          clearInterval(intervalRef.current!)
          confirmRef.current()
          return 0
        }
        return r - step
      })
    }, step)
    return () => clearInterval(intervalRef.current!)
  }, [])

  const pct = Math.max(0, remaining / duration)

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 w-[min(92vw,26rem)] overflow-hidden rounded-2xl bg-slate-900 shadow-xl shadow-slate-900/40"
    >
      {/* Progress bar */}
      <div
        className="h-0.5 bg-[#f18a3f] transition-none"
        style={{ width: `${pct * 100}%` }}
      />
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <p className="text-sm font-medium text-white">{message}</p>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#f18a3f] transition hover:bg-white/10 active:scale-95"
        >
          Undo
        </button>
      </div>
    </div>
  )
}
