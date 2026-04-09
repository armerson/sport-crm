import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { ClubPlayerFieldEditor } from '../components/shared/ClubPlayerFieldEditor.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { fetchClubSettings } from '../services/forms.ts'
import { fetchPublicClubPlayerFields } from '../services/clubPlayerFields.ts'
import { registerChildrenForCurrentUser } from '../services/parentSelfRegister.ts'
import type { ClubPlayerField } from '../types/clubPlayerFields.ts'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import type { ClubSettings } from '../types/forms.ts'

type Step = 'account' | 'children' | 'done'

interface ChildRow {
  name: string
  dob: string
  custom: Record<string, string>
}

export function ParentRegisterPage() {
  const navigate = useNavigate()
  const { currentUser, profile, signUp, refreshProfile, loading: authLoading } = useAuth()
  const [step, setStep] = useState<Step>('account')
  const [club, setClub] = useState<ClubSettings>({ name: 'My Club', logoUrl: null })
  const [fields, setFields] = useState<ClubPlayerField[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountError, setAccountError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [childrenRows, setChildrenRows] = useState<ChildRow[]>([{ name: '', dob: '', custom: {} }])
  const [childrenError, setChildrenError] = useState<string | null>(null)

  const canProceedChildren = useMemo(
    () =>
      Boolean(
        currentUser &&
          profile &&
          (profile.roles.includes('parent') || profile.roles.includes('admin')),
      ),
    [currentUser, profile],
  )

  useEffect(() => {
    void Promise.all([fetchClubSettings(), fetchPublicClubPlayerFields().catch(() => [])]).then(([c, f]) => {
      setClub(c)
      setFields(f)
      setLoadingMeta(false)
    })
  }, [])

  useEffect(() => {
    if (authLoading || loadingMeta) return
    if (canProceedChildren) setStep('children')
  }, [authLoading, loadingMeta, canProceedChildren])

  function setCustomForRow(index: number, fieldId: string, value: string) {
    setChildrenRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, custom: { ...row.custom, [fieldId]: value } } : row)),
    )
  }

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault()
    setAccountError(null)
    if (!parentName.trim() || !email.trim() || password.length < 6) {
      setAccountError('Enter your name, email, and a password of at least 6 characters.')
      return
    }
    setSubmitting(true)
    try {
      await signUp({
        name: parentName.trim(),
        email: email.trim(),
        password,
        roles: ['parent'],
      })
      await refreshProfile()
      setStep('children')
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Sign up failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleChildrenSubmit(e: React.FormEvent) {
    e.preventDefault()
    setChildrenError(null)
    if (!canProceedChildren) {
      setChildrenError('Please sign in first.')
      navigate(`/login?next=${encodeURIComponent('/register/parent')}`)
      return
    }

    for (const f of fields) {
      if (!f.required) continue
      for (const row of childrenRows) {
        if (!row.name.trim() || !row.dob) {
          setChildrenError('Each child needs a name and date of birth.')
          return
        }
        const v = row.custom[f.id] ?? ''
        if (f.fieldType === 'checkbox' && v !== 'true') {
          setChildrenError(`Please complete required field: ${f.label}`)
          return
        }
        if (f.fieldType !== 'checkbox' && !String(v).trim()) {
          setChildrenError(`Please complete required field: ${f.label}`)
          return
        }
      }
    }

    const payload = childrenRows
      .filter((r) => r.name.trim() && r.dob)
      .map((r) => ({
        name: r.name.trim(),
        dob: r.dob,
        custom: Object.keys(r.custom).length ? r.custom : undefined,
      }))

    if (payload.length === 0) {
      setChildrenError('Add at least one child with name and date of birth.')
      return
    }

    setSubmitting(true)
    try {
      await registerChildrenForCurrentUser(payload)
      setStep('done')
    } catch (err) {
      setChildrenError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-sm text-slate-600">{supabaseConfigError}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#123524] to-slate-900 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">{club.name}</p>
          <h1 className="mt-2 text-2xl font-bold">Register your child</h1>
          <p className="mt-1 text-sm text-white/70">Multi-step parent registration (same data model as the parent portal).</p>
        </div>

        <div className="rounded-[1.75rem] border border-white/20 bg-white p-6 shadow-xl">
          {step === 'account' && !canProceedChildren ? (
            <form className="space-y-4" onSubmit={handleAccount}>
              <p className="text-sm text-slate-600">
                Create a parent account. Already have one?{' '}
                <Link className="font-semibold text-[#123524] hover:underline" to={`/login?next=${encodeURIComponent('/register/parent')}`}>
                  Sign in
                </Link>
              </p>
              <TextField label="Your name" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Jane Smith" />
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {accountError ? <p className="text-sm text-rose-600">{accountError}</p> : null}
              <Button className="w-full" loading={submitting} type="submit">
                Continue
              </Button>
            </form>
          ) : null}

          {step === 'children' || (step === 'account' && canProceedChildren) ? (
            <form className="space-y-6" onSubmit={handleChildrenSubmit}>
              {canProceedChildren ? (
                <p className="text-sm text-slate-600">
                  Signed in as <strong>{profile?.name}</strong>. Add your children below. They stay pending until the club assigns a team.
                </p>
              ) : null}

              {childrenRows.map((row, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Child {index + 1}</h3>
                    {childrenRows.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600 hover:underline"
                        onClick={() => setChildrenRows((r) => r.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <TextField label="Child's full name" value={row.name} onChange={(e) => {
                      const v = e.target.value
                      setChildrenRows((rows) => rows.map((r, i) => (i === index ? { ...r, name: v } : r)))
                    }} />
                    <TextField label="Date of birth" type="date" value={row.dob} onChange={(e) => {
                      const v = e.target.value
                      setChildrenRows((rows) => rows.map((r, i) => (i === index ? { ...r, dob: v } : r)))
                    }} />
                    {fields.length > 0 ? (
                      <ClubPlayerFieldEditor
                        fields={fields}
                        values={row.custom}
                        onChange={(fieldId, value) => setCustomForRow(index, fieldId, value)}
                      />
                    ) : null}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setChildrenRows((r) => [...r, { name: '', dob: '', custom: {} }])}
              >
                + Add another child
              </Button>

              {childrenError ? <p className="text-sm text-rose-600">{childrenError}</p> : null}
              <Button className="w-full" loading={submitting} type="submit">
                Submit registration
              </Button>
            </form>
          ) : null}

          {step === 'done' ? (
            <div className="space-y-4 text-center">
              <p className="text-lg font-semibold text-slate-900">Thank you!</p>
              <p className="text-sm text-slate-600">
                Your children are registered as pending. The club will assign teams soon. You can open the parent portal after signing in.
              </p>
              <Button className="w-full" onClick={() => navigate('/')}>
                Go to app
              </Button>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          Data is stored securely. This app uses Supabase (no separate REST API). Admins configure extra questions under Admin → Player registration.
        </p>
      </div>
    </div>
  )
}
