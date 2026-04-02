import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function TextField({ label, hint, id, className = '', ...props }: TextFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor={fieldId}>
      <span>{label}</span>
      <input
        id={fieldId}
        className={`w-full rounded-2xl border border-white/60 bg-white/90 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#f18a3f] focus:ring-4 focus:ring-[#f18a3f]/15 ${className}`}
        {...props}
      />
      {hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  )
}