import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function TextField({ label, hint, id, className = '', ...props }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor={fieldId}>
      <span>{label}</span>
      <input
        id={fieldId}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--club-color,#1565ff)] focus:ring-4 focus:ring-blue-500/10 ${className}`}
        {...props}
      />
      {hint ? <span id={`${fieldId}-hint`} className="text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  )
}