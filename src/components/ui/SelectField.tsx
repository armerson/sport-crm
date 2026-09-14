import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'

interface SelectOption {
  label: string
  value: string
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
  options: SelectOption[]
}

export function SelectField({ label, options, hint, error, id, className = '', ...props }: SelectFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <label className="ui-field" htmlFor={fieldId}>
      <span id={`${fieldId}-label`}>{label}</span>
      <select
        {...props}
        id={fieldId}
        aria-labelledby={`${fieldId}-label`}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : props['aria-describedby']}
        aria-invalid={error ? true : props['aria-invalid']}
        className={`ui-input ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span id={`${fieldId}-error`} role="alert" className="text-xs font-normal text-rose-700">{error}</span> : hint ? <span id={`${fieldId}-hint`} className="text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  )
}