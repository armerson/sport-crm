import { useMemo, useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useClubSettings } from '../hooks/useClubSettings.ts'

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

// ── Compact mobile header (replaces the full hero on small screens) ────────────

function MobileHeader({ clubName, logoUrl, primaryColor }: { clubName: string; logoUrl: string | null; primaryColor: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-5 py-4 text-white lg:hidden"
      style={{ backgroundColor: primaryColor }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={`${clubName} badge`} className="h-10 w-10 rounded-xl object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-bold leading-none">{clubName}</p>
        <p className="mt-0.5 truncate text-xs text-white/70">Track squads, attendance, and match-day updates.</p>
      </div>
    </div>
  )
}

// ── Desktop hero panel (left column, hidden on mobile) ────────────────────────

function DesktopHero({
  clubName,
  logoUrl,
  primaryColor,
  mode,
  signUpStep,
  signUpKind,
}: {
  clubName: string
  logoUrl: string | null
  primaryColor: string
  mode: AuthMode
  signUpStep: SignUpStep
  signUpKind: SignUpKind | null
}) {
  const contextLine = useMemo(() => {
    if (mode === 'sign-in') return 'Sign in securely to manage your club account.'
    if (mode === 'forgot-password') return "Enter your email and we'll send a password reset link."
    if (signUpStep === 'who') return 'Create an account to stay connected with your club.'
    if (signUpKind === 'player') return 'Create your player account — the club will assign you to a team after approval.'
    return 'Register and add your children. The club will link them to teams after approval.'
  }, [mode, signUpStep, signUpKind])

  return (
    <section
      className="relative hidden overflow-hidden rounded-[2rem] p-10 text-white shadow-2xl lg:block lg:p-12"
      style={{ backgroundColor: primaryColor, boxShadow: `0 25px 50px -12px color-mix(in srgb, ${primaryColor} 40%, transparent)` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_50%),linear-gradient(180deg,_transparent,_rgba(0,0,0,0.18))]" />

      <div className="relative flex h-full flex-col justify-between gap-10">
        <div className="space-y-6">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={`${clubName} badge`} className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/30" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
              )}
              <div>
                <span className="text-lg font-bold tracking-tight leading-none">{clubName}</span>
                <p className="mt-0.5 text-xs font-medium text-white/50 tracking-wide uppercase">Powered by ClubOS</p>
              </div>
            </div>
          </div>

          {/* Headline + context */}
          <div className="space-y-3">
            <h1 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight text-balance">
              One hub for squads, match-days, and parent communication.
            </h1>
            <p className="max-w-sm text-base leading-7 text-white/75">{contextLine}</p>
          </div>
        </div>

        {/* Proof points */}
        <div className="space-y-3">
          {[
            { icon: '✅', text: 'RSVP attendance before every match or training session' },
            { icon: '📍', text: 'Live directions and weather for every fixture' },
            { icon: '💬', text: 'Per-team messaging between coaches and parents' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="mt-px text-base leading-none">{icon}</span>
              <p className="text-sm leading-5 text-white/85">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AuthPage() {
  const { clearError, error, isConfigured, signIn, signUp, resetPassword } = useAuth()
  const { settings } = useClubSettings()

  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [signInValues, setSignInValues] = useState({ email: '', password: '' })
  const [signUpStep, setSignUpStep] = useState<SignUpStep>('who')
  const [signUpKind, setSignUpKind] = useState<SignUpKind | null>(null)
  const [signUpValues, setSignUpValues] = useState({ name: '', email: '', password: '' })
  const [playerDob, setPlayerDob] = useState('')
  const [children, setChildren] = useState<Array<{ name: string; dob: string }>>([{ name: '', dob: '' }])
  const [accountCreated, setAccountCreated] = useState(false)

  const activeError = isConfigured ? (formError ?? error) : formError

  function switchMode(next: AuthMode) {
    clearError()
    setFormError(null)
    setResetSent(false)
    setAccountCreated(false)
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
    if (kind === 'parent') setChildren([{ name: '', dob: '' }])
  }

  async function handleSignInSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    setFormError(null)
    setIsSubmitting(true)
    try {
      await signIn(signInValues)
    } catch { /* surfaced via context */ } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    setFormError(null)
    if (!resetEmail.trim()) { setFormError('Enter your email address.'); return }
    setIsSubmitting(true)
    try {
      await resetPassword(resetEmail.trim())
      setResetSent(true)
    } catch { /* surfaced via context */ } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignUpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    setFormError(null)

    if (!signUpKind) { setFormError('Choose how you are registering.'); return }
    if (signUpValues.name.trim().length < 2) { setFormError('Please enter a full name.'); return }
    if (signUpValues.password.length < 6) { setFormError('Password must be at least 6 characters.'); return }

    if (signUpKind === 'parent') {
      const trimmed = children.map((c) => ({ name: c.name.trim(), dob: c.dob.trim() }))
      if (trimmed.length === 0) { setFormError('Add at least one child.'); return }
      for (let i = 0; i < trimmed.length; i += 1) {
        const c = trimmed[i]
        if (c.name.length < 2) { setFormError(`Child ${i + 1}: enter a name (at least 2 characters).`); return }
        if (!c.dob) { setFormError(`Child ${i + 1}: enter a date of birth.`); return }
      }
    } else {
      if (!playerDob) { setFormError('Enter your date of birth.'); return }
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
      setAccountCreated(true)
    } catch { /* surfaced via context */ } finally {
      setIsSubmitting(false)
    }
  }

  const clubName = settings.name
  const logoUrl = settings.logoUrl
  const primaryColor = settings.primaryColor

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl gap-4 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">

        {/* Left: compact header (mobile) | full hero (desktop) */}
        <MobileHeader clubName={clubName} logoUrl={logoUrl} primaryColor={primaryColor} />
        <DesktopHero
          clubName={clubName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          mode={mode}
          signUpStep={signUpStep}
          signUpKind={signUpKind}
        />

        {/* Right: auth card */}
        <section className="rounded-[2rem] border border-white/60 bg-white/75 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:p-8">

          {/* Tab switcher */}
          <div className="flex rounded-2xl bg-slate-100/90 p-1">
            <button
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === 'sign-in' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              onClick={() => switchMode('sign-in')}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === 'sign-up' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              onClick={() => switchMode('sign-up')}
              type="button"
            >
              Register
            </button>
          </div>

          {/* Heading */}
          <div className="mt-6 space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {mode === 'sign-in'
                ? 'Welcome back'
                : mode === 'sign-up'
                  ? signUpStep === 'who' ? 'Create an account' : signUpKind === 'parent' ? 'Parent registration' : 'Player registration'
                  : 'Reset password'}
            </h2>
            <p className="text-sm leading-6 text-slate-500">
              {mode === 'sign-in'
                ? 'Sign in securely to manage your club account.'
                : mode === 'sign-up'
                  ? signUpStep === 'who'
                    ? 'Parents and players (18+) can self-register. Coaches and admins are invited by the club.'
                    : signUpKind === 'parent'
                      ? 'Your children will be linked to teams after the club reviews your registration.'
                      : 'You\'ll get access after the club approves your registration.'
                  : 'We\'ll email you a link to choose a new password.'}
            </p>
          </div>

          {/* Config warning */}
          {!isConfigured ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Supabase is not configured yet. Add your project values in <span className="font-semibold">.env.local</span>.
            </div>
          ) : null}

          {/* Error */}
          {activeError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {activeError}
            </div>
          ) : null}

          {/* ── Sign in ── */}
          {mode === 'sign-in' ? (
            <>
              <form className="mt-5 space-y-4" onSubmit={handleSignInSubmit}>
                <TextField
                  autoComplete="email"
                  label="Email"
                  onChange={(e) => setSignInValues((v) => ({ ...v, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={signInValues.email}
                />
                <TextField
                  autoComplete="current-password"
                  label="Password"
                  onChange={(e) => setSignInValues((v) => ({ ...v, password: e.target.value }))}
                  placeholder="Your password"
                  required
                  type="password"
                  value={signInValues.password}
                />
                <Button className="mt-1 w-full" loading={isSubmitting} type="submit">
                  Sign in
                </Button>
                <p className="text-center text-sm text-slate-500">
                  <button
                    className="font-medium text-[#1565ff] underline underline-offset-2 hover:text-[#0d4ed8]"
                    onClick={() => switchMode('forgot-password')}
                    type="button"
                  >
                    Forgot your password?
                  </button>
                </p>
              </form>

              {/* Need access callout */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">Need access?</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Parents and players can{' '}
                  <button
                    className="font-semibold text-[#1565ff] underline underline-offset-2"
                    onClick={() => switchMode('sign-up')}
                    type="button"
                  >
                    create an account
                  </button>
                  . Coaches and admins are invited by the club and don't need to register here.
                </p>
              </div>
            </>
          ) : mode === 'forgot-password' ? (
            /* ── Forgot password ── */
            <div className="mt-5">
              {resetSent ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-sm text-emerald-900">
                  <p className="font-semibold">Check your inbox</p>
                  <p className="mt-1 text-emerald-700">
                    We've sent a reset link to <span className="font-medium">{resetEmail}</span>. Check your spam folder if it doesn't arrive within a minute.
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
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={resetEmail}
                  />
                  <Button className="w-full" loading={isSubmitting} type="submit">
                    Send reset link
                  </Button>
                  <p className="text-center text-sm text-slate-500">
                    <button
                      className="font-medium text-[#1565ff] underline underline-offset-2"
                      onClick={() => switchMode('sign-in')}
                      type="button"
                    >
                      Back to sign in
                    </button>
                  </p>
                </form>
              )}
            </div>
          ) : accountCreated ? (
            /* ── Success state ── */
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-sm">
              <p className="text-2xl">🎉</p>
              <p className="mt-2 font-semibold text-emerald-900">Account created!</p>
              <p className="mt-1 text-emerald-700 leading-5">
                Your registration has been sent to the club. An admin will review it and link{' '}
                {signUpKind === 'parent' ? 'your children' : 'you'} to the right team — you'll be able to sign in once that's done.
              </p>
              <button
                className="mt-4 font-medium text-emerald-800 underline underline-offset-2"
                onClick={() => switchMode('sign-in')}
                type="button"
              >
                Back to sign in
              </button>
            </div>
          ) : signUpStep === 'who' ? (
            /* ── Who are you? ── */
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => selectSignUpKind('parent')}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#1565ff]/40 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👨‍👩‍👧</span>
                  <div>
                    <p className="text-base font-semibold text-slate-950">Parent or guardian</p>
                    <p className="mt-0.5 text-sm text-slate-500">Register and add your children — the club will assign them to teams.</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => selectSignUpKind('player')}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#1565ff]/40 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚽</span>
                  <div>
                    <p className="text-base font-semibold text-slate-950">Player (18+)</p>
                    <p className="mt-0.5 text-sm text-slate-500">Create your own account. The club will assign you to a team after approval.</p>
                  </div>
                </div>
              </button>

              {/* Trust note */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs leading-5 text-slate-500">
                  🔒 Your information is only visible to your club's admin and coaches — it is never shared with third parties.
                </p>
              </div>
            </div>
          ) : (
            /* ── Registration form ── */
            <form className="mt-5 space-y-4" onSubmit={handleSignUpSubmit}>
              {/* Stepper breadcrumb */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => { setSignUpStep('who'); setSignUpKind(null); setFormError(null) }}
                  className="font-medium text-[#1565ff] underline underline-offset-2"
                >
                  ← Back
                </button>
                <span>·</span>
                <span>{signUpKind === 'parent' ? 'Parent registration' : 'Player registration (18+)'}</span>
              </div>

              <TextField
                autoComplete="name"
                label={signUpKind === 'player' ? 'Your full name' : 'Your full name (parent / guardian)'}
                onChange={(e) => setSignUpValues((v) => ({ ...v, name: e.target.value }))}
                placeholder="Alex Morgan"
                required
                value={signUpValues.name}
              />
              <TextField
                autoComplete="email"
                label="Email"
                onChange={(e) => setSignUpValues((v) => ({ ...v, email: e.target.value }))}
                placeholder="alex@example.com"
                required
                type="email"
                value={signUpValues.email}
              />
              <TextField
                autoComplete="new-password"
                hint="Minimum 6 characters"
                label="Password"
                onChange={(e) => setSignUpValues((v) => ({ ...v, password: e.target.value }))}
                placeholder="Create a secure password"
                required
                type="password"
                value={signUpValues.password}
              />

              {signUpKind === 'player' ? (
                <TextField
                  label="Your date of birth"
                  hint="You must be 18 or over to self-register as a player."
                  onChange={(e) => setPlayerDob(e.target.value)}
                  required
                  type="date"
                  value={playerDob}
                />
              ) : (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Your children</p>
                    <p className="mt-0.5 text-xs text-slate-500">Add each child registering with the club — you can add more than one.</p>
                  </div>
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
                        onChange={(e) => { const v = e.target.value; setChildren((c) => c.map((r, i) => (i === index ? { ...r, name: v } : r))) }}
                        placeholder="Jamie Morgan"
                        required
                        value={child.name}
                      />
                      <TextField
                        label="Date of birth"
                        onChange={(e) => { const v = e.target.value; setChildren((c) => c.map((r, i) => (i === index ? { ...r, dob: v } : r))) }}
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
                    + Add another child
                  </Button>
                </div>
              )}

              <Button className="mt-1 w-full" loading={isSubmitting} type="submit">
                Create account
              </Button>

              {/* Post-submit expectation */}
              <p className="text-center text-xs leading-5 text-slate-400">
                After creating an account, the club admin will review it before team access is enabled.
              </p>
            </form>
          )}
          {/* Powered by */}
          <p className="mt-6 text-center text-xs text-slate-400">
            Powered by{' '}
            <span className="font-semibold text-slate-500">ClubOS</span>
          </p>
        </section>
      </div>
    </main>
  )
}
