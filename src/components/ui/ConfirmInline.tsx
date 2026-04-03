import { useState } from 'react'

interface ConfirmInlineProps {
  onConfirm: () => void
  label?: string
  confirmLabel?: string
  cancelLabel?: string
  disabled?: boolean
}

export function ConfirmInline({
  onConfirm,
  label = 'Remove',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  disabled = false,
}: ConfirmInlineProps) {
  const [pending, setPending] = useState(false)

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          className="text-xs font-semibold text-rose-600 transition hover:text-rose-800"
          onClick={() => {
            setPending(false)
            onConfirm()
          }}
          type="button"
        >
          {confirmLabel}
        </button>
        <span className="text-slate-300">/</span>
        <button
          className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
          onClick={() => setPending(false)}
          type="button"
        >
          {cancelLabel}
        </button>
      </span>
    )
  }

  return (
    <button
      className="text-xs font-semibold text-slate-500 transition hover:text-rose-600 disabled:opacity-40"
      disabled={disabled}
      onClick={() => setPending(true)}
      type="button"
    >
      {label}
    </button>
  )
}
