import { validateChildren } from '../utils/childRegistration.ts'
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

type Step = 'account' | 'confirm-email' | 'children' | 'done'

interface ChildRow {
  name: string
  dob: string
  custom: Record<string, string>
}

export function ParentRegisterPage() {
  const navigate = useNavigate()
  const { currentUser, profile, signUp, refreshProfile, loading: authLoading, error: authError } = useAuth()
  const [step, setStep] = useState<Step>('account')
  const [club, setClub] = useState<ClubSettings>({ name: 'My Club', logoUrl: null, primaryColor: '#1565ff', instagramTagline: '', instagramHashtags: '' })
  const [fields, setFields] = useState<ClubPlayerField[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [metadataError, setMetadataError] = useState<string | null>(null)

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
    void Promise.all([fetchClubSettings(), fetchPublicClubPlayerFields()]).then(([c, f]) => {
      setClub(c)
      setFields(f)
    }).catch(() => setMetadataError('Unable to load registration details. Please refresh and try again.')).finally(() => setLoadingMeta(false))
  }, [])


  function setCustomForRow(index: number, fieldId: string, value: string) {
    setChildrenRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, custom: { ...row.custom, [fieldId]: value } } : row)),
    )
  }

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault()
    setAccountError(null)
    if (metadataError) return
    if (!parentName.trim() || !email.trim() || password.length < 6) {
      setAccountError('Enter your name, email, and a password of at least 6 characters.')
      return
    }
    setSubmitting(true)
    try {
      const result = await signUp({
        name: parentName.trim(),
        email: email.trim(),
        password,
        roles: ['parent'],
        emailRedirectPath: '/register/parent',
      })
      if (result.requiresEmailConfirmation) {
        setStep('confirm-email')
      } else {
        await refreshProfile()
        setStep('children')
      }
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Sign up failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleChildrenSubmit(e: React.FormEvent) {
    e.preventDefault()
    setChildrenError(null)
    if (metadataError) return
    if (!canProceedChildren) {
      setChildrenError('Please sign in first.')
      navigate(`/login?next=${encodeURIComponent('/register/parent')}`)
      return
    }

    let payload: ChildRow[]
    try { payload = validateChildren(childrenRows) } catch (error) {
      setChildrenError(error instanceof Error ? error.message : 'Check each child’s details.')
      return
    }
    for (const field of fields) {
      if (!field.required) continue
      for (const row of payload) {
        const value = row.custom[field.id] ?? ''
        if ((field.fieldType === 'checkbox' && value !== 'true') || (field.fieldType !== 'checkbox' && !String(value).trim())) {
          setChildrenError(`Please complete required field: ${field.label}`)
          return
        }
      }
    }

    setSubmitting(true)
    try {
      await registerChildrenForCurrentUser(payload)
      await refreshProfile()
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
    <div className="min-h-screen bg-[var(--ui-canvas)] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center text-slate-900">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">{club.name}</p>
          <h1 className="mt-2 text-2xl font-bold">Register your child</h1>
          <p className="mt-1 text-sm text-slate-600">Create your family account, then add your children.</p>
        </div>

        <ol aria-label="Registration progress" className="mb-5 flex justify-between gap-2 text-xs font-semibold text-slate-600">
          {['Account', 'Player details', 'Club review'].map((label, index) => <li key={label} aria-current={(step === 'account' || step === 'confirm-email' ? 0 : step === 'done' ? 2 : 1) === index ? 'step' : undefined} className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white">{index + 1}</span>{label}</li>)}
        </ol>
        <div className="ui-panel p-6">
          {metadataError || authError ? <p role="alert" className="mb-4 text-sm text-rose-700">{metadataError ?? authError}</p> : null}
          {authLoading || loadingMeta ? <p role="status" className="text-sm text-slate-500">Loading registration…</p> : null}
          {!authLoading && !loadingMeta && step === 'account' && !canProceedChildren ? (
            <form className="space-y-4" onSubmit={handleAccount}>
              <p className="text-sm text-slate-600">
                Create a parent account. Already have one?{' '}
                <Link className="font-semibold text-[var(--ui-accent)] hover:underline" to={`/login?next=${encodeURIComponent('/register/parent')}`}>
                  Sign in
                </Link>
              </p>
              <TextField label="Your name" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Jane Smith" />
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {accountError ? <p className="text-sm text-rose-600">{accountError}</p> : null}
              <Button className="w-full" disabled={Boolean(metadataError)} loading={submitting} type="submit">
                Continue
              </Button>
            </form>
          ) : null}

          {!authLoading && !loadingMeta && canProceedChildren && step !== 'done' ? (
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
              <Button className="w-full" disabled={Boolean(metadataError)} loading={submitting} type="submit">
                Submit registration
              </Button>
            </form>
          ) : null}

          {step === 'confirm-email' && !canProceedChildren ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Check your email</h2>
              <p className="text-sm leading-6 text-slate-600">Confirm your account using the email sent to <strong>{email}</strong>. You can then sign in and add your children.</p>
              <Link className="inline-block font-semibold text-blue-700 underline" to="/login?next=%2Fregister%2Fparent">Continue to sign in</Link>
            </div>
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

        <p className="mt-6 text-center text-xs text-slate-500">
          Your club will review the registration and help connect your family to the right teams.
        </p>
      </div>
    </div>
  )
}
