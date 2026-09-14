import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'

interface SelectOption {
  label: string
  value: string
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectOption[]
}

export function SelectField({ label, options, id, className = '', ...props }: SelectFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor={fieldId}>
      <span>{label}</span>
      <select
        id={fieldId}
        className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-[var(--club-color,#1565ff)] focus:ring-4 focus:ring-blue-500/10 ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}