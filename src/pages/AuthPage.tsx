import { useMemo, useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../hooks/useAuth.ts'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password'
type SignUpStep = 'who' | 'form'
type SignUpKind = 'parent' | 'player'

function isAtLeastAge(dobYmd: string, minAge: number): boolean {
  const parts = dobYmd.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false
  const [y, m, d] = parts
  const birth = new Date(y, m - 1, d)
  if (Number.isNaN(birth.getTime())) return false
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const mDiff = today.getMonth() - birth.getMonth()
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age >= minAge
}

export function AuthPage() {
  const { clearError, error, isConfigured, signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [signInValues, setSignInValues] = useState({ email: '', password: '' })
  const [signUpStep, setSignUpStep] = useState<SignUpStep>('who')
  const [signUpKind, setSignUpKind] = useState<SignUpKind | null>(null)
  const [signUpValues, setSignUpValues] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [playerDob, setPlayerDob] = useState('')
  const [children, setChildren] = useState<Array<{ name: string; dob: string }>>([{ name: '', dob: '' }])

  // When Supabase env vars are missing, AuthContext sets `error` to the same guidance we show in the amber banner — avoid duplicating it in red.
  const activeError = isConfigured ? (formError ?? error) : formError

  const heroLabel = useMemo(() => {
    if (mode === 'sign-in') {
      return 'Sign in to manage squads, attendance, and match-day communication.'
    }
    if (mode === 'forgot-password') {
      return "Enter your email and we'll send a password reset link."
    }
    if (signUpStep === 'who') {
      return 'Tell us whether you are registering a parent account or as a player aged 18 or over.'
    }
    if (signUpKind === 'player') {
      return 'Create your player account. The club will approve and assign you to a team.'
    }
    return 'Register as a parent and add your children during sign-up. The club will link them to teams after approval.'
  }, [mode, signUpStep, signUpKind])

  function switchMode(next: AuthMode) {
    clearError()
    setFormError(null)
    setResetSent(false)
    if (next === 'sign-up') {
      setSignUpStep('who')
      setSignUpKind(null)
      setChildren([{ name: '', dob: '' }])
      setPlayerDob('')
    }
    setMode(next)
  }

  function selectSignUpKind(kind: SignUpKind) {
    setSignUpKind(kind)
    setSignUpStep('form')
    setFormError(null)
    if (kind === 'parent') {
      setChildren([{ name: '', dob: '' }])
    }
  }

  async function handleSignInSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    setFormError(null)
    setIsSubmitting(true)

    try {
      await signIn(signInValues)
    } catch {
      // Auth state is surfaced through context error state.
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    setFormError(null)

    if (!resetEmail.trim()) {
      setFormError('Enter your email address.')
      return
    }

    setIsSubmitting(true)

    try {
      await resetPassword(resetEmail.trim())
      setResetSent(true)
    } catch {
      // Auth state is surfaced through context error state.
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignUpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    setFormError(null)

    if (!signUpKind) {
      setFormError('Choose how you are registering.')
      return
    }

    if (signUpValues.name.trim().length < 2) {
      setFormError('Please enter a full name.')
      return
    }

    if (signUpValues.password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }

    if (signUpKind === 'parent') {
      const trimmed = children.map((c) => ({ name: c.name.trim(), dob: c.dob.trim() }))
      if (trimmed.length === 0) {
        setFormError('Add at least one child.')
        return
      }
      for (let i = 0; i < trimmed.length; i += 1) {
        const c = trimmed[i]
        if (c.name.length < 2) {
          setFormError(`Child ${i + 1}: enter a name (at least 2 characters).`)
          return
        }
        if (!c.dob) {
          setFormError(`Child ${i + 1}: enter a date of birth.`)
          return
        }
      }
    } else {
      if (!playerDob) {
        setFormError('Enter your date of birth.')
        return
      }
      if (!isAtLeastAge(playerDob, 18)) {
        setFormError('Player registration is for people aged 18 or over. Parents should register a parent account instead.')
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (signUpKind === 'parent') {
        await signUp({
          ...signUpValues,
          name: signUpValues.name.trim(),
          email: signUpValues.email.trim(),
          roles: ['parent'],
          signupChildren: children.map((c) => ({ name: c.name.trim(), dob: c.dob })),
        })
      } else {
        await signUp({
          ...signUpValues,
          name: signUpValues.name.trim(),
          email: signUpValues.email.trim(),
          roles: ['player'],
          playerDob,
        })
      }
    } catch {
      // Auth state is surfaced through context error state.
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#123524] p-8 text-white shadow-2xl shadow-[#123524]/20 sm:p-10 lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(241,138,63,0.32),_transparent_34%),linear-gradient(180deg,_transparent,_rgba(0,0,0,0.18))]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
                Sports Club CRM
              </div>
              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  A single club hub for teams, parents, and match-day operations.
                </h1>
                <p className="max-w-lg text-base leading-7 text-white/78 sm:text-lg">{heroLabel}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Roles</p>
                <p className="mt-2 text-xl font-semibold">Admin, Coach, Parent, Player</p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Modules</p>
                <p className="mt-2 text-xl font-semibold">Teams, Events, Attendance</p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Messaging</p>
                <p className="mt-2 text-xl font-semibold">Per-team communication</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/60 bg-white/75 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:p-8">
          <div className="flex rounded-2xl bg-slate-100/90 p-1">
            <button
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                mode === 'sign-in' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => switchMode('sign-in')}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                mode === 'sign-up' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => switchMode('sign-up')}
              type="button"
            >
              Create account
            </button>
          </div>

          <div className="mt-8 space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {mode === 'sign-in' ? 'Welcome back' : mode === 'sign-up' ? (signUpStep === 'who' ? 'Who are you?' : 'Your details') : 'Reset password'}
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              {mode === 'sign-in'
                ? 'Use Supabase Auth to sign in securely.'
                : mode === 'sign-up'
                  ? signUpStep === 'who'
                    ? 'Parents register children for approval. Players 18+ can register their own account.'
                    : 'Admin and coach accounts are still provisioned by the club.'
                  : 'We will email you a link to choose a new password.'}
            </p>
          </div>

          {!isConfigured ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Supabase is not configured yet. Add your project values in <span className="font-semibold">.env.local</span> using the example file.
            </div>
          ) : null}

          {activeError ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {activeError}
            </div>
          ) : null}

          {mode === 'sign-in' ? (
            <form className="mt-6 space-y-4" onSubmit={handleSignInSubmit}>
              <TextField
                autoComplete="email"
                label="Email"
                onChange={(event) => setSignInValues((current) => ({ ...current, email: event.target.value }))}
                placeholder="club@example.com"
                required
                type="email"
                value={signInValues.email}
              />
              <TextField
                autoComplete="current-password"
                label="Password"
                onChange={(event) => setSignInValues((current) => ({ ...current, password: event.target.value }))}
                placeholder="Enter your password"
                required
                type="password"
                value={signInValues.password}
              />
              <Button className="mt-2 w-full" loading={isSubmitting} type="submit">
                Sign in
              </Button>
              <p className="text-center text-sm text-slate-500">
                <button
                  className="font-medium text-[#123524] underline underline-offset-2 hover:text-[#1a4a33]"
                  onClick={() => switchMode('forgot-password')}
                  type="button"
                >
                  Forgot your password?
                </button>
              </p>
            </form>
          ) : mode === 'forgot-password' ? (
            <div className="mt-6">
              {resetSent ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-sm text-emerald-900">
                  <p className="font-semibold">Check your inbox</p>
                  <p className="mt-1 text-emerald-700">
                    We've sent a password reset link to <span className="font-medium">{resetEmail}</span>. Check your spam folder if it doesn't arrive within a minute.
                  </p>
                  <button
                    className="mt-4 font-medium text-emerald-800 underline underline-offset-2"
                    onClick={() => switchMode('sign-in')}
                    type="button"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleResetSubmit}>
                  <TextField
                    autoComplete="email"
                    label="Email address"
                    onChange={(event) => setResetEmail(event.target.value)}
                    placeholder="club@example.com"
                    required
                    type="email"
                    value={resetEmail}
                  />
                  <Button className="w-full" loading={isSubmitting} type="submit">
                    Send reset link
                  </Button>
                  <p className="text-center text-sm text-slate-500">
                    <button
                      className="font-medium text-[#123524] underline underline-offset-2 hover:text-[#1a4a33]"
                      onClick={() => switchMode('sign-in')}
                      type="button"
                    >
                      Back to sign in
                    </button>
                  </p>
                </form>
              )}
            </div>
          ) : signUpStep === 'who' ? (
            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={() => selectSignUpKind('parent')}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#123524]/40 hover:shadow-md"
              >
                <p className="text-lg font-semibold text-slate-950">I'm a parent or guardian</p>
                <p className="mt-1 text-sm text-slate-600">Register and add your children. The club will approve and assign them to teams.</p>
              </button>
              <button
                type="button"
                onClick={() => selectSignUpKind('player')}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#123524]/40 hover:shadow-md"
              >
                <p className="text-lg font-semibold text-slate-950">I'm a player (18+)</p>
                <p className="mt-1 text-sm text-slate-600">Create your own account. You'll get access after the club approves your registration.</p>
              </button>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSignUpSubmit}>
              <button
                type="button"
                onClick={() => {
                  setSignUpStep('who')
                  setSignUpKind(null)
                  setFormError(null)
                }}
                className="text-sm font-medium text-[#123524] underline underline-offset-2 hover:text-[#1a4a33]"
              >
                ← Back
              </button>

              <TextField
                autoComplete="name"
                label={signUpKind === 'player' ? 'Your full name' : 'Your full name (parent)'}
                onChange={(event) => setSignUpValues((current) => ({ ...current, name: event.target.value }))}
                placeholder="Alex Morgan"
                required
                value={signUpValues.name}
              />
              <TextField
                autoComplete="email"
                label="Email"
                onChange={(event) => setSignUpValues((current) => ({ ...current, email: event.target.value }))}
                placeholder="alex@club.com"
                required
                type="email"
                value={signUpValues.email}
              />
              <TextField
                autoComplete="new-password"
                hint="Minimum 6 characters"
                label="Password"
                onChange={(event) => setSignUpValues((current) => ({ ...current, password: event.target.value }))}
                placeholder="Create a secure password"
                required
                type="password"
                value={signUpValues.password}
              />

              {signUpKind === 'player' ? (
                <TextField
                  label="Your date of birth"
                  hint="You must be 18 or over to register as a player."
                  onChange={(event) => setPlayerDob(event.target.value)}
                  required
                  type="date"
                  value={playerDob}
                />
              ) : (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">Children</p>
                  <p className="text-xs text-slate-600">Add each child registering with the club. You can add more than one.</p>
                  {children.map((child, index) => (
                    <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Child {index + 1}</span>
                        {children.length > 1 ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-rose-600 hover:underline"
                            onClick={() => setChildren((c) => c.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <TextField
                        label="Child's name"
                        onChange={(event) => {
                          const v = event.target.value
                          setChildren((c) => c.map((row, i) => (i === index ? { ...row, name: v } : row)))
                        }}
                        placeholder="Jamie Morgan"
                        required
                        value={child.name}
                      />
                      <TextField
                        label="Date of birth"
                        onChange={(event) => {
                          const v = event.target.value
                          setChildren((c) => c.map((row, i) => (i === index ? { ...row, dob: v } : row)))
                        }}
                        required
                        type="date"
                        value={child.dob}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => setChildren((c) => [...c, { name: '', dob: '' }])}
                  >
                    Add another child
                  </Button>
                </div>
              )}

              <Button className="mt-2 w-full" loading={isSubmitting} type="submit">
                Create account
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
