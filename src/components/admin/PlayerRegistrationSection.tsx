import { useEffect, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'
import {
  deleteClubPlayerField,
  fetchAdminClubPlayerFields,
  insertClubPlayerField,
  updateClubPlayerField,
} from '../../services/clubPlayerFields.ts'
import type { ClubPlayerField, ClubPlayerFieldInput, ClubPlayerFieldType } from '../../types/clubPlayerFields.ts'
import { FIELD_TYPE_LABELS, type FieldType } from '../../types/forms.ts'

const BLANK: ClubPlayerFieldInput = {
  label: '',
  fieldType: 'text',
  required: false,
  options: '',
  placeholder: '',
  sortOrder: 0,
  active: true,
}

const TYPE_OPTIONS: { label: string; value: ClubPlayerFieldType }[] = (Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map(
  (value) => ({ label: FIELD_TYPE_LABELS[value], value: value as ClubPlayerFieldType }),
)

export function PlayerRegistrationSection() {
  const [fields, setFields] = useState<ClubPlayerField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClubPlayerFieldInput>(BLANK)

  async function load() {
    try {
      setFields(await fetchAdminClubPlayerFields())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fields.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm({ ...BLANK, sortOrder: fields.length })
    setError(null)
  }

  function openEdit(f: ClubPlayerField) {
    setEditingId(f.id)
    setForm({
      label: f.label,
      fieldType: f.fieldType,
      required: f.required,
      options: f.options?.join(', ') ?? '',
      placeholder: f.placeholder ?? '',
      sortOrder: f.sortOrder,
      active: f.active,
    })
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim()) {
      setError('Label is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (editingId) {
        await updateClubPlayerField(editingId, form)
        setSuccess('Field updated.')
      } else {
        await insertClubPlayerField(form)
        setSuccess('Field added.')
      }
      await load()
      setEditingId(null)
      setForm(BLANK)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true)
    try {
      await deleteClubPlayerField(id)
      setSuccess('Field removed.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Player registration fields</h2>
        <p className="mt-1 text-sm text-slate-500">
          Extra questions collected when parents register children (public <code className="rounded bg-slate-100 px-1">/register/parent</code> and in the parent portal). Core name and DOB are always required separately.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 whitespace-pre-wrap">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{success}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Club-wide fields ({fields.length})</h3>
            <Button type="button" variant="secondary" onClick={openCreate}>
              Add field
            </Button>
          </div>
          {fields.length === 0 ? (
            <p className="text-sm text-slate-500">No custom fields yet. Parents will only enter name and date of birth.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {fields.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                  <div>
                    <p className="font-medium text-slate-900">
                      {f.label}
                      {!f.active ? <span className="ml-2 text-xs font-normal text-slate-400">(inactive)</span> : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {FIELD_TYPE_LABELS[f.fieldType as FieldType]} · {f.required ? 'Required' : 'Optional'} · order {f.sortOrder}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="text-sm font-semibold text-[#1565ff] hover:underline" onClick={() => openEdit(f)}>
                      Edit
                    </button>
                    <ConfirmInline label="Delete" onConfirm={() => void handleDelete(f.id)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
        <h3 className="font-semibold text-slate-900">{editingId ? 'Edit field' : 'New field'}</h3>
        <form className="mt-4 space-y-4" onSubmit={handleSave}>
          <TextField label="Label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Medical notes" />
          <SelectField
            label="Type"
            value={form.fieldType}
            onChange={(e) => setForm((f) => ({ ...f, fieldType: e.target.value as ClubPlayerFieldType }))}
            options={TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
          />
          {(form.fieldType === 'select' || form.fieldType === 'checkboxes') && (
            <TextField
              label="Options (comma-separated)"
              value={form.options}
              onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
              placeholder="Option A, Option B"
            />
          )}
          <TextField
            label="Placeholder (optional)"
            value={form.placeholder}
            onChange={(e) => setForm((f) => ({ ...f, placeholder: e.target.value }))}
          />
          <TextField
            label="Sort order"
            type="number"
            value={String(form.sortOrder)}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.required} onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))} />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            Active (shown on public registration)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button loading={submitting} type="submit">
              {editingId ? 'Save changes' : 'Create field'}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(BLANK) }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
