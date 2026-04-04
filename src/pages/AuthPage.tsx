import { useMemo, useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../hooks/useAuth.ts'

type AuthMode = 'sign-in' | 'sign-up'

export function AuthPage() {
  const { clearError, error, isConfigured, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [signInValues, setSignInValues] = useState({ email: '', password: '' })
  const [signUpValues, setSignUpValues] = useState({
    name: '',
    email: '',
    password: '',
  })

  const activeError = formError ?? error
  const heroLabel = useMemo(
    () =>
      mode === 'sign-in'
        ? 'Sign in to manage squads, attendance, and match-day communication.'
        : 'Parents can create their own accounts. Admin and coach accounts should be provisioned by the club.',
    [mode],
  )

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

  async function handleSignUpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    setFormError(null)

    if (signUpValues.name.trim().length < 2) {
      setFormError('Please enter a full name.')
      return
    }

    if (signUpValues.password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }

    setIsSubmitting(true)

    try {
      await signUp({
        ...signUpValues,
        name: signUpValues.name.trim(),
        email: signUpValues.email.trim(),
        roles: ['parent'],
      })
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
                <p className="mt-2 text-xl font-semibold">Admin, Coach, Parent</p>
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
              onClick={() => {
                clearError()
                setFormError(null)
                setMode('sign-in')
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                mode === 'sign-up' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => {
                clearError()
                setFormError(null)
                setMode('sign-up')
              }}
              type="button"
            >
              Create account
            </button>
          </div>

          <div className="mt-8 space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {mode === 'sign-in' ? 'Welcome back' : 'Set up your account'}
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              {mode === 'sign-in'
                ? 'Use Supabase Auth to sign in securely.'
                : 'Self-service signup is limited to parents. Admin and coach access should be assigned by the club.'}
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
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSignUpSubmit}>
              <TextField
                autoComplete="name"
                label="Full name"
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                New self-service accounts are created as <span className="font-semibold text-slate-900">parents</span>.
              </div>
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