import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.ts'
import { fetchClubSettings, fetchPublicForm, submitForm } from '../services/forms.ts'
import type { ClubSettings, FormField, RegistrationForm } from '../types/forms.ts'

function FieldInput({ field, value, onChange }: {
  field: FormField
  value: string
  onChange: (v: string) => void
}) {
  const base = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#123524]/20 focus:border-[#123524]/40'

  if (field.fieldType === 'textarea') {
    return (
      <textarea
        className={`${base} min-h-[80px] resize-y`}
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
          className="h-4 w-4 accent-[#123524]"
          type="checkbox"
          required={field.required}
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : '')}
        />
        <span>Yes, I agree</span>
      </label>
    )
  }

  if (field.fieldType === 'select' && field.options) {
    return (
      <select
        className={base}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose an option…</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  if (field.fieldType === 'checkboxes' && field.options) {
    const selected = value ? value.split('|||') : []
    return (
      <div className="space-y-2">
        {field.options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-50">
            <input
              className="h-4 w-4 accent-[#123524]"
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, opt]
                  : selected.filter((s) => s !== opt)
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
    email: 'email', phone: 'tel', date: 'date', number: 'number',
  }

  return (
    <input
      className={base}
      type={typeMap[field.fieldType] ?? 'text'}
      placeholder={field.placeholder ?? ''}
      required={field.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function RegisterPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { currentUser: user, loading: authLoading } = useAuth()

  const [form, setForm] = useState<(RegistrationForm & { fields: FormField[] }) | null>(null)
  const [club, setClub] = useState<ClubSettings>({ name: 'My Club', logoUrl: null, primaryColor: '#123524' })
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return }
    void Promise.all([fetchPublicForm(slug), fetchClubSettings()]).then(([f, c]) => {
      if (!f) { setNotFound(true) } else { setForm(f) }
      setClub(c)
      setLoading(false)
    })
  }, [slug])

  // Redirect to login if form requires it and user isn't logged in
  useEffect(() => {
    if (!authLoading && form?.requiresLogin && !user) {
      navigate(`/login?next=/register/${slug}`, { replace: true })
    }
  }, [authLoading, form, user, slug, navigate])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form) return
    setError(null)
    setSubmitting(true)
    try {
      const name = values['__name__'] ?? ''
      const email = values['__email__'] ?? ''
      const responses = form.fields.map((f) => ({ fieldId: f.id, value: values[f.id] ?? '' }))
      await submitForm(form.id, name, email, responses)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <p className="text-lg font-semibold text-slate-800">Form not found</p>
        <p className="mt-2 text-sm text-slate-500">This registration link may have expired or been removed.</p>
      </div>
    )
  }

  if (!form) return null

  const isPastDeadline = form.deadline && new Date(form.deadline) < new Date()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">

        {/* Header */}
        <div className="mb-8 text-center">
          {club.logoUrl ? (
            <img src={club.logoUrl} alt={club.name} className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-md" />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#123524] shadow-md">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                <path d="M2 12h20" />
              </svg>
            </div>
          )}
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">{club.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{form.name}</h1>
          {form.description && (
            <p className="mt-2 text-sm text-slate-600">{form.description}</p>
          )}
          {form.deadline && (
            <p className={`mt-2 text-xs font-semibold ${isPastDeadline ? 'text-rose-600' : 'text-amber-700'}`}>
              {isPastDeadline ? 'Registration closed' : `Deadline: ${new Date(form.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </p>
          )}
        </div>

        {submitted ? (
          <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 px-6 py-10 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-lg font-bold text-emerald-900">Registration received!</p>
            <p className="mt-2 text-sm text-emerald-700">
              Thank you for registering. The club will be in touch with next steps.
            </p>
          </div>
        ) : isPastDeadline ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-10 text-center shadow-lg">
            <p className="text-base font-semibold text-slate-700">Registrations are closed</p>
            <p className="mt-2 text-sm text-slate-500">The deadline for this form has passed.</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-900/8 backdrop-blur-sm"
          >
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            {/* Built-in name + email fields (used as submitter identity) */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Your name <span className="text-rose-500">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#123524]/20 focus:border-[#123524]/40"
                type="text"
                required
                placeholder="Full name"
                value={values['__name__'] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, __name__: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Email address <span className="text-rose-500">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#123524]/20 focus:border-[#123524]/40"
                type="email"
                required
                placeholder="your@email.com"
                value={values['__email__'] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, __email__: e.target.value }))}
              />
            </div>

            {/* Dynamic fields */}
            {form.fields.map((field) => (
              <div key={field.id}>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {field.label}
                  {field.required && <span className="ml-1 text-rose-500">*</span>}
                </label>
                <FieldInput
                  field={field}
                  value={values[field.id] ?? ''}
                  onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-[#123524] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#1a4d35] disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit registration'}
            </button>

            <p className="text-center text-xs text-slate-400">
              Your information is stored securely and used only for club registration purposes.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
