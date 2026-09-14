import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function TextField({ label, hint, error, id, className = '', ...props }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <label className="ui-field" htmlFor={fieldId}>
      <span id={`${fieldId}-label`}>{label}</span>
      <input
        {...props}
        id={fieldId}
        aria-labelledby={`${fieldId}-label`}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : props['aria-describedby']}
        aria-invalid={error ? true : props['aria-invalid']}
        className={`ui-input ${className}`}
      />
      {error ? <span id={`${fieldId}-error`} role="alert" className="text-xs font-normal text-rose-700">{error}</span> : null}
      {!error && hint ? <span id={`${fieldId}-hint`} className="text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  )
}