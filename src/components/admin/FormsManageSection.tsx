import { useEffect, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'
import {
  createForm,
  deleteForm,
  fetchAdminForms,
  fetchClubSettings,
  fetchFormFields,
  fetchSubmissionResponses,
  fetchSubmissions,
  saveClubSettings,
  updateForm,
  updateSubmissionStatus,
} from '../../services/forms.ts'
import type {
  ClubSettings,
  FieldInput,
  FieldType,
  FormField,
  FormInput,
  FormSubmission,
  FormType,
  RegistrationForm,
  SubmissionStatus,
} from '../../types/forms.ts'
import { FIELD_TYPE_LABELS, FORM_TYPE_LABELS } from '../../types/forms.ts'
import type { UserProfile } from '../../types/auth.ts'

const DEFAULT_FIELDS: FieldInput[] = [
  { label: "Player's full name", fieldType: 'text', required: true, options: '', placeholder: '', sortOrder: 0 },
  { label: 'Date of birth', fieldType: 'date', required: true, options: '', placeholder: '', sortOrder: 1 },
  { label: 'Parent / guardian name', fieldType: 'text', required: true, options: '', placeholder: '', sortOrder: 2 },
  { label: 'Parent / guardian email', fieldType: 'email', required: true, options: '', placeholder: '', sortOrder: 3 },
  { label: 'Parent / guardian phone', fieldType: 'phone', required: true, options: '', placeholder: '', sortOrder: 4 },
  { label: 'Medical conditions or allergies', fieldType: 'textarea', required: false, options: '', placeholder: 'Leave blank if none', sortOrder: 5 },
  { label: 'I consent to GDPR data storage and club photography / media use', fieldType: 'checkbox', required: true, options: '', placeholder: '', sortOrder: 6 },
  { label: 'I accept the club liability waiver and code of conduct', fieldType: 'checkbox', required: true, options: '', placeholder: '', sortOrder: 7 },
]

const BLANK_FORM: FormInput = {
  name: '',
  description: '',
  formType: 'other',
  teamId: null,
  deadline: '',
  active: true,
  requiresLogin: false,
}

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-slate-100 text-slate-600',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
}

interface FormsManageSectionProps {
  profile: UserProfile
  teams: { id: string; name: string; ageGroup: string }[]
}

export function FormsManageSection({ profile, teams }: FormsManageSectionProps) {
  const [forms, setForms] = useState<RegistrationForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // View state
  type View = 'list' | 'build' | 'submissions' | 'settings'
  const [view, setView] = useState<View>('list')
  const [editingForm, setEditingForm] = useState<RegistrationForm | null>(null)
  const [viewingFormId, setViewingFormId] = useState<string | null>(null)

  // Form builder state
  const [formInput, setFormInput] = useState<FormInput>(BLANK_FORM)
  const [fields, setFields] = useState<FieldInput[]>(DEFAULT_FIELDS)

  // Submissions state
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  const [subResponses, setSubResponses] = useState<Record<string, Record<string, string>>>({})
  const [subFields, setSubFields] = useState<FormField[]>([])

  // Club settings state
  const [clubInput, setClubInput] = useState<ClubSettings>({ name: '', logoUrl: null })

  useEffect(() => {
    void loadForms()
  }, [])

  async function loadForms() {
    try {
      const [f, c] = await Promise.all([fetchAdminForms(), fetchClubSettings()])
      setForms(f)
      setClubInput(c)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms.')
    } finally {
      setLoading(false)
    }
  }

  function showSuccess(msg: string) {
    setSuccess(null)
    setTimeout(() => setSuccess(msg), 10)
  }

  function openCreate() {
    setEditingForm(null)
    setFormInput(BLANK_FORM)
    setFields(DEFAULT_FIELDS)
    setView('build')
  }

  async function openEdit(form: RegistrationForm) {
    setEditingForm(form)
    setFormInput({
      name: form.name,
      description: form.description ?? '',
      formType: form.formType,
      teamId: form.teamId,
      deadline: form.deadline ? form.deadline.slice(0, 10) : '',
      active: form.active,
      requiresLogin: form.requiresLogin,
    })
    try {
      const existingFields = await fetchFormFields(form.id)
      setFields(existingFields.map((f) => ({
        label: f.label,
        fieldType: f.fieldType,
        required: f.required,
        options: f.options ? f.options.join(', ') : '',
        placeholder: f.placeholder ?? '',
        sortOrder: f.sortOrder,
      })))
    } catch {
      setFields([])
    }
    setView('build')
  }

  async function openSubmissions(form: RegistrationForm) {
    setViewingFormId(form.id)
    setView('submissions')
    try {
      const [subs, flds] = await Promise.all([fetchSubmissions(form.id), fetchFormFields(form.id)])
      setSubmissions(subs)
      setSubFields(flds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions.')
    }
  }

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!formInput.name.trim()) { setError('Form name is required.'); return }
    if (fields.some((f) => !f.label.trim())) { setError('All fields must have a label.'); return }
    setSubmitting(true)
    try {
      if (editingForm) {
        await updateForm(editingForm.id, formInput, fields)
        showSuccess('Form updated.')
      } else {
        await createForm(formInput, fields, profile.id)
        showSuccess('Form created.')
      }
      await loadForms()
      setView('list')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteForm(formId: string) {
    setSubmitting(true)
    try {
      await deleteForm(formId)
      setForms((prev) => prev.filter((f) => f.id !== formId))
      showSuccess('Form deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete form.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(submissionId: string, status: SubmissionStatus) {
    try {
      await updateSubmissionStatus(submissionId, status)
      setSubmissions((prev) => prev.map((s) => s.id === submissionId ? { ...s, status } : s))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.')
    }
  }

  async function handleExpandSub(subId: string) {
    if (expandedSub === subId) { setExpandedSub(null); return }
    setExpandedSub(subId)
    if (!subResponses[subId]) {
      try {
        const responses = await fetchSubmissionResponses(subId)
        setSubResponses((prev) => ({ ...prev, [subId]: responses }))
      } catch { /* ignore */ }
    }
  }

  async function handleSaveClubSettings(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await saveClubSettings(clubInput)
      showSuccess('Club settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.')
    } finally {
      setSubmitting(false)
    }
  }

  function addField() {
    setFields((prev) => [...prev, { label: '', fieldType: 'text', required: false, options: '', placeholder: '', sortOrder: prev.length }])
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i))
  }

  function moveField(i: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev]
      const target = i + dir
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]]
      return next
    })
  }

  function updateField(i: number, patch: Partial<FieldInput>) {
    setFields((prev) => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f))
  }

  const shareBase = window.location.origin

  if (loading) return <p className="text-sm text-slate-500">Loading forms…</p>

  // ── Club Settings ───────────────────────────
  if (view === 'settings') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView('list')} className="text-sm font-semibold text-[#123524] hover:underline">← Back</button>
          <h2 className="text-xl font-semibold text-slate-950">Club settings</h2>
        </div>
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
        <form onSubmit={handleSaveClubSettings} className="space-y-4">
          <TextField
            label="Club name"
            value={clubInput.name}
            onChange={(e) => setClubInput((c) => ({ ...c, name: e.target.value }))}
            placeholder="Ambassadors FC"
          />
          <TextField
            label="Club logo URL (optional)"
            value={clubInput.logoUrl ?? ''}
            onChange={(e) => setClubInput((c) => ({ ...c, logoUrl: e.target.value || null }))}
            placeholder="https://example.com/logo.png"
          />
          {clubInput.logoUrl && (
            <img src={clubInput.logoUrl} alt="Preview" className="h-16 w-16 rounded-2xl object-cover shadow-sm" />
          )}
          <Button loading={submitting} type="submit">Save settings</Button>
        </form>
      </div>
    )
  }

  // ── Form builder ────────────────────────────
  if (view === 'build') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView('list')} className="text-sm font-semibold text-[#123524] hover:underline">← Back</button>
          <h2 className="text-xl font-semibold text-slate-950">{editingForm ? 'Edit form' : 'Create form'}</h2>
        </div>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <form onSubmit={handleSaveForm} className="space-y-5">
          {/* Form details */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Form details</p>
            <TextField
              label="Form name"
              value={formInput.name}
              onChange={(e) => setFormInput((f) => ({ ...f, name: e.target.value }))}
              placeholder="U12 Summer Camp 2026"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description (optional)</label>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#123524]/20"
                rows={2}
                placeholder="Briefly describe this registration form…"
                value={formInput.description}
                onChange={(e) => setFormInput((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Form type"
                value={formInput.formType}
                onChange={(e) => setFormInput((f) => ({ ...f, formType: e.target.value as FormType }))}
                options={Object.entries(FORM_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
              <SelectField
                label="Team (optional)"
                value={formInput.teamId ?? ''}
                onChange={(e) => setFormInput((f) => ({ ...f, teamId: e.target.value || null }))}
                options={[{ value: '', label: 'Club-wide' }, ...teams.map((t) => ({ value: t.id, label: `${t.name} (${t.ageGroup})` }))]}
              />
            </div>
            <TextField
              label="Registration deadline (optional)"
              type="date"
              value={formInput.deadline}
              onChange={(e) => setFormInput((f) => ({ ...f, deadline: e.target.value }))}
            />
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-[#123524]" checked={formInput.active} onChange={(e) => setFormInput((f) => ({ ...f, active: e.target.checked }))} />
                Active (accept submissions)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-[#123524]" checked={formInput.requiresLogin} onChange={(e) => setFormInput((f) => ({ ...f, requiresLogin: e.target.checked }))} />
                Require login to submit
              </label>
            </div>
          </div>

          {/* Field builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Form fields</p>
              <button
                type="button"
                className="text-xs font-semibold text-[#123524] hover:underline"
                onClick={() => setFields(DEFAULT_FIELDS)}
              >
                Reset to defaults
              </button>
            </div>

            {fields.map((field, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#123524]/20"
                        placeholder="Field label"
                        value={field.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                      />
                      <select
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#123524]/20"
                        value={field.fieldType}
                        onChange={(e) => updateField(i, { fieldType: e.target.value as FieldType })}
                      >
                        {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>

                    {(field.fieldType === 'select' || field.fieldType === 'checkboxes') && (
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#123524]/20"
                        placeholder="Options, separated by commas e.g. U10, U12, U14"
                        value={field.options}
                        onChange={(e) => updateField(i, { options: e.target.value })}
                      />
                    )}

                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" className="accent-[#123524]" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                      Required
                    </label>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1 pl-2">
                    <button type="button" disabled={i === 0} onClick={() => moveField(i, -1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button type="button" disabled={i === fields.length - 1} onClick={() => moveField(i, 1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    <button type="button" onClick={() => removeField(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addField}
              className="w-full rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition hover:border-[#123524] hover:text-[#123524]"
            >
              + Add field
            </button>
          </div>

          <Button className="w-full" loading={submitting} type="submit">
            {editingForm ? 'Save changes' : 'Create form'}
          </Button>
        </form>
      </div>
    )
  }

  // ── Submissions viewer ──────────────────────
  if (view === 'submissions') {
    const currentForm = forms.find((f) => f.id === viewingFormId)
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView('list')} className="text-sm font-semibold text-[#123524] hover:underline">← Back</button>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Submissions</h2>
            {currentForm && <p className="text-sm text-slate-500">{currentForm.name}</p>}
          </div>
        </div>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {submissions.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 px-4 py-12 text-center">
            <p className="text-sm text-slate-500">No submissions yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <article key={sub.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">{sub.submitterName}</p>
                    <p className="text-sm text-slate-500">{sub.submitterEmail}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[sub.status]}`}>
                      {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                    <select
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:outline-none"
                      value={sub.status}
                      onChange={(e) => void handleStatusChange(sub.id, e.target.value as SubmissionStatus)}
                    >
                      <option value="new">New</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#123524] hover:underline"
                      onClick={() => void handleExpandSub(sub.id)}
                    >
                      {expandedSub === sub.id ? 'Hide' : 'View'}
                    </button>
                  </div>
                </div>

                {expandedSub === sub.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    {subFields.length === 0 ? (
                      <p className="text-sm text-slate-400">No field data.</p>
                    ) : (
                      <div className="space-y-2">
                        {subFields.map((f) => {
                          const resp = subResponses[sub.id]?.[f.id]
                          return (
                            <div key={f.id} className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                              <span className="font-medium text-slate-600 whitespace-nowrap">{f.label}:</span>
                              <span className="text-slate-800 break-words">{resp || <em className="text-slate-400">—</em>}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Forms list ──────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Registration forms</h2>
          <p className="text-sm text-slate-500">Create forms for club sign-ups, camps, trials and more.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView('settings')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Club settings
          </button>
          <Button onClick={openCreate} type="button">New form</Button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      {forms.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 px-4 py-12 text-center">
          <p className="text-sm font-medium text-slate-600">No forms yet</p>
          <p className="mt-1 text-sm text-slate-400">Create your first registration form to get a shareable link.</p>
          <button type="button" onClick={openCreate} className="mt-4 text-sm font-semibold text-[#123524] underline underline-offset-2">
            Create a form
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => {
            const link = `${shareBase}/register/${form.slug}`
            return (
              <article key={form.id} className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{form.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${form.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {form.active ? 'Active' : 'Inactive'}
                      </span>
                      {form.requiresLogin && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Login required</span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        {FORM_TYPE_LABELS[form.formType]}
                      </span>
                    </div>
                    {form.description && <p className="mt-0.5 text-sm text-slate-500 truncate max-w-sm">{form.description}</p>}
                    {form.deadline && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        Deadline: {new Date(form.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        readOnly
                        value={link}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 font-mono w-64 max-w-full truncate"
                      />
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#123524] hover:underline"
                        onClick={() => void navigator.clipboard.writeText(link)}
                      >
                        Copy
                      </button>
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#123524] hover:underline">
                        Preview ↗
                      </a>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => void openSubmissions(form)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Submissions
                    </button>
                    <button type="button" onClick={() => void openEdit(form)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Edit
                    </button>
                    <ConfirmInline
                      label="Delete"
                      confirmLabel="Yes, delete"
                      onConfirm={() => void handleDeleteForm(form.id)}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
