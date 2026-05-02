import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getInviteInfo, type InviteInfo } from '../services/teamInvites.ts'
import { useAuth } from '../hooks/useAuth.ts'

// ── Small helpers ────────────────────────────────────────────────

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#1565ff] focus:ring-2 focus:ring-[#1565ff]/15"
      />
    </label>
  )
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1565ff] to-[#1e4d36]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
    </div>
  )
}

// ── Team hero banner ─────────────────────────────────────────────

function TeamHero({ info }: { info: InviteInfo }) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {info.photoUrl ? (
        <>
          <img src={info.photoUrl} alt={info.teamName} className="h-36 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <p className="text-xl font-bold text-white">{info.teamName}</p>
            <p className="text-sm text-white/75">{info.ageGroup}</p>
          </div>
        </>
      ) : (
        <div className="flex h-24 items-center gap-4 rounded-2xl bg-[#1565ff]/10 px-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1565ff] text-2xl font-bold text-white">
            {info.teamName.charAt(0)}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{info.teamName}</p>
            <p className="text-sm text-slate-500">{info.ageGroup}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Parent signup form ───────────────────────────────────────────

function ParentSignupForm({ info, onSuccess }: { info: InviteInfo; onSuccess: () => void }) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [children, setChildren] = useState([{ name: '', dob: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addChild() { setChildren((c) => [...c, { name: '', dob: '' }]) }
  function removeChild(i: number) { setChildren((c) => c.filter((_, idx) => idx !== i)) }
  function setChild(i: number, field: 'name' | 'dob', val: string) {
    setChildren((c) => c.map((ch, idx) => idx === i ? { ...ch, [field]: val } : ch))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim()) { setError('Please enter your email.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    const validChildren = children.filter((c) => c.name.trim() && c.dob)
    if (!validChildren.length) { setError("Please add at least one child's name and date of birth."); return }

    setSubmitting(true)
    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        roles: ['parent'],
        signupChildren: validChildren,
      })
      // Store invite code so completePendingRegistration can pick it up
      // It's stored in user metadata via updateUser after session is available
      sessionStorage.setItem('pending_invite_code', info.code)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <Field label="Your name" value={name} onChange={setName} placeholder="Jane Smith" autoComplete="name" />
      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="jane@example.com" autoComplete="email" />
      <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="6+ characters" autoComplete="new-password" />

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Your child{children.length > 1 ? 'ren' : ''}</p>
        {children.map((child, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Child {children.length > 1 ? i + 1 : ''}</span>
              {children.length > 1 && (
                <button type="button" onClick={() => removeChild(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              )}
            </div>
            <input
              type="text"
              value={child.name}
              onChange={(e) => setChild(i, 'name', e.target.value)}
              placeholder="Child's full name"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1565ff] focus:ring-1 focus:ring-[#1565ff]/20"
            />
            <input
              type="date"
              value={child.dob}
              onChange={(e) => setChild(i, 'dob', e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1565ff] focus:ring-1 focus:ring-[#1565ff]/20"
            />
          </div>
        ))}
        <button type="button" onClick={addChild} className="text-xs font-semibold text-[#1565ff] hover:underline">
          + Add another child
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#1565ff] py-3 text-sm font-bold text-white transition disabled:opacity-50 hover:bg-[#0d4ed8] active:scale-[0.98]"
      >
        {submitting ? 'Creating account…' : 'Create account & join team'}
      </button>
    </form>
  )
}

// ── Coach signup form ────────────────────────────────────────────

function CoachSignupForm({ info, onSuccess }: { info: InviteInfo; onSuccess: () => void }) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim()) { setError('Please enter your email.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setSubmitting(true)
    try {
      await signUp({ name: name.trim(), email: email.trim(), password, roles: ['coach'] })
      sessionStorage.setItem('pending_invite_code', info.code)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <Field label="Your name" value={name} onChange={setName} placeholder="John Smith" autoComplete="name" />
      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="john@example.com" autoComplete="email" />
      <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="6+ characters" autoComplete="new-password" />

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#1565ff] py-3 text-sm font-bold text-white transition disabled:opacity-50 hover:bg-[#0d4ed8] active:scale-[0.98]"
      >
        {submitting ? 'Creating account…' : 'Create account & join team'}
      </button>
    </form>
  )
}

// ── Sign-in form (existing users) ────────────────────────────────

function SignInForm({ info, onSuccess }: { info: InviteInfo; onSuccess: () => void }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn({ email: email.trim(), password })
      sessionStorage.setItem('pending_invite_code', info.code)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#1565ff] py-3 text-sm font-bold text-white transition disabled:opacity-50 hover:bg-[#0d4ed8] active:scale-[0.98]"
      >
        {submitting ? 'Signing in…' : 'Sign in & join team'}
      </button>
    </form>
  )
}

// ── Main page ────────────────────────────────────────────────────

export function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    if (!code) return
    getInviteInfo(code).then((result) => {
      if ('error' in result) {
        setLoadError(result.error)
      } else {
        setInfo(result)
      }
    })
  }, [code])

  // If already logged in and invite loads, store code and redirect
  useEffect(() => {
    if (info && profile) {
      sessionStorage.setItem('pending_invite_code', info.code)
      navigate('/', { replace: true })
    }
  }, [info, profile, navigate])

  function handleSuccess() {
    setJoined(true)
  }

  if (!info && !loadError) return <Spinner />

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1565ff] to-[#1e4d36] p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
          <p className="text-3xl">🔗</p>
          <h1 className="mt-3 text-lg font-bold text-slate-900">Link not found</h1>
          <p className="mt-2 text-sm text-slate-500">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 w-full rounded-xl bg-[#1565ff] py-2.5 text-sm font-semibold text-white"
          >
            Go to app
          </button>
        </div>
      </div>
    )
  }

  if (joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1565ff] to-[#1e4d36] p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
          <h1 className="text-xl font-bold text-slate-900">You're in!</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your account has been created. {info!.role === 'parent'
              ? "The club admin will link your child to the team shortly."
              : `You've been added to ${info!.teamName}.`}
          </p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="mt-6 w-full rounded-xl bg-[#1565ff] py-3 text-sm font-bold text-white"
          >
            Open app →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1565ff] to-[#1e4d36] p-4 sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold tracking-widest text-white/60 uppercase">ClubOS</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {info!.role === 'parent' ? "You've been invited" : "Join as coach"}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {info!.role === 'parent'
              ? `Register to follow ${info!.teamName} and stay on top of schedules and attendance.`
              : `Create your account to start managing ${info!.teamName}.`}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-white p-6 shadow-2xl">
          <TeamHero info={info!} />

          <div className="mt-5">
            {/* Role badge */}
            <div className="mb-4 flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${info!.role === 'parent' ? 'bg-blue-100 text-blue-700' : 'bg-[#1565ff]/10 text-[#1565ff]'}`}>
                Joining as {info!.role}
              </span>
              <button
                type="button"
                onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                className="text-xs font-semibold text-slate-400 hover:text-[#1565ff]"
              >
                {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Sign up'}
              </button>
            </div>

            {mode === 'signup' ? (
              info!.role === 'parent'
                ? <ParentSignupForm info={info!} onSuccess={handleSuccess} />
                : <CoachSignupForm info={info!} onSuccess={handleSuccess} />
            ) : (
              <SignInForm info={info!} onSuccess={handleSuccess} />
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          By joining you agree to your club's terms of use.
        </p>
      </div>
    </div>
  )
}
