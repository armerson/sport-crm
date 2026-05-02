import type { ClubPlayerField } from '../../types/clubPlayerFields.ts'

const base =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1565ff]/20 focus:border-[#1565ff]/40'

export function ClubPlayerFieldEditor({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: ClubPlayerField[]
  values: Record<string, string>
  onChange: (fieldId: string, value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id}>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {field.label}
            {field.required ? <span className="text-rose-500"> *</span> : null}
          </label>
          <FieldControl disabled={disabled} field={field} value={values[field.id] ?? ''} onChange={(v) => onChange(field.id, v)} />
        </div>
      ))}
    </div>
  )
}

function FieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ClubPlayerField
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  if (field.fieldType === 'textarea') {
    return (
      <textarea
        className={`${base} min-h-[80px] resize-y`}
        disabled={disabled}
        placeholder={field.placeholder ?? ''}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if (field.fieldType === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-50">
        <input
          className="h-4 w-4 accent-[#1565ff] disabled:opacity-50"
          type="checkbox"
          disabled={disabled}
          required={field.required}
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : '')}
        />
        <span>Yes</span>
      </label>
    )
  }

  if (field.fieldType === 'select' && field.options?.length) {
    return (
      <select
        className={base}
        disabled={disabled}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose…</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  if (field.fieldType === 'checkboxes' && field.options?.length) {
    const selected = value ? value.split('|||') : []
    return (
      <div className="space-y-2">
        {field.options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            <input
              className="h-4 w-4 accent-[#1565ff] disabled:opacity-50"
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(opt)}
              onChange={(e) => {
                const next = e.target.checked ? [...selected, opt] : selected.filter((s) => s !== opt)
                onChange(next.join('|||'))
              }}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    )
  }

  const typeMap: Record<string, string> = {
    email: 'email',
    phone: 'tel',
    date: 'date',
    number: 'number',
  }

  return (
    <input
      className={base}
      type={typeMap[field.fieldType] ?? 'text'}
      disabled={disabled}
      placeholder={field.placeholder ?? ''}
      required={field.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
