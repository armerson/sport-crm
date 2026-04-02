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
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor={fieldId}>
      <span>{label}</span>
      <select
        id={fieldId}
        className={`w-full rounded-2xl border border-white/60 bg-white/90 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-[#f18a3f] focus:ring-4 focus:ring-[#f18a3f]/15 ${className}`}
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