import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getClubInviteInfo, useClubInvite, type ClubInviteInfo } from '../services/teamInvites.ts'
import { useAuth } from '../hooks/useAuth.ts'

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#123524] focus:ring-2 focus:ring-[#123524]/15"
      />
    </label>
  )
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#123524] to-[#1e4d36]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
    </div>
  )
}

export function ClubJoinPage() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { signUp, signIn, session } = useAuth()

  const [info, setInfo] = useState<ClubInviteInfo | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')

  // Form state
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getClubInviteInfo(code).then((result) => {
      if ('error' in result) { setInviteError(result.error); return }
      setInfo(result)
    })
  }, [code])

  // After auth, use the invite and redirect
  useEffect(() => {
    if (!session || !info) return
    useClubInvite(code)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => navigate('/dashboard', { replace: true }))
  }, [session, info, code, navigate])

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) { setFormError('Please enter your name.'); return }
    setSubmitting(true)
    try {
      sessionStorage.setItem('pending_club_invite_code', code)
      await signUp(email, password, name.trim(), info!.role === 'coach' ? ['coach'] : ['admin'])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign up failed.')
      sessionStorage.removeItem('pending_club_invite_code')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      sessionStorage.setItem('pending_club_invite_code', code)
      await signIn(email, password)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign in failed.')
      sessionStorage.removeItem('pending_club_invite_code')
    } finally {
      setSubmitting(false)
    }
  }

  if (!info && !inviteError) return <Spinner />

  if (inviteError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#123524] to-[#1e4d36] p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
          <p className="text-4xl">⛔</p>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Invalid link</h1>
          <p className="mt-2 text-sm text-slate-500">{inviteError}</p>
        </div>
      </div>
    )
  }

  const roleLabel = info!.role === 'admin' ? 'Admin' : 'Coach'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#123524] to-[#1e4d36] p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-white/10 px-6 py-5 text-center backdrop-blur-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            {info!.role === 'admin' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )}
          </div>
          <p className="text-sm font-semibold text-white/70">You've been invited to join as</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{roleLabel}</h1>
        </div>

        {/* Form card */}
        <div className="rounded-3xl bg-white p-6 shadow-2xl">
          {/* Mode toggle */}
          <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
            {(['signup', 'signin'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setFormError(null) }}
                className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${
                  mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            ))}
          </div>

          {mode === 'signup' ? (
            <form onSubmit={(e) => void handleSignUp(e)} className="space-y-3">
              <Field label="Full name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 8 characters" autoComplete="new-password" />
              {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#123524] py-3 text-sm font-bold text-white transition hover:bg-[#1a4a33] disabled:opacity-60 active:scale-[0.98]"
              >
                {submitting ? 'Creating account…' : `Join as ${roleLabel}`}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleSignIn(e)} className="space-y-3">
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" />
              {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#123524] py-3 text-sm font-bold text-white transition hover:bg-[#1a4a33] disabled:opacity-60 active:scale-[0.98]"
              >
                {submitting ? 'Signing in…' : 'Sign in & accept invite'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
