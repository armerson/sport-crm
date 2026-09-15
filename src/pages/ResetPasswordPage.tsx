import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.ts'
import { useClubSettings } from '../hooks/useClubSettings.ts'
import { Button } from '../components/ui/Button.tsx'
import { TextField } from '../components/ui/TextField.tsx'

export function ResetPasswordPage() {
  const { currentUser, loading, updatePassword, signOutUser } = useAuth()
  const { settings } = useClubSettings()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return }
    setSaving(true)
    try {
      await updatePassword(password)
      setComplete(true)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'The password could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignIn() {
    await signOutUser()
    window.location.assign('/login')
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center px-5 text-sm text-slate-600">Checking your secure link…</main>

  return (
    <main className="ui-registration flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1565ff]">{settings.name}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Choose a new password</h1>
        {!currentUser ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">This reset link has expired or already been used.</p>
            <p className="mt-1">Request a fresh link from the sign-in screen.</p>
            <Link className="mt-4 inline-block font-semibold text-blue-700 underline" to="/login">Return to sign in</Link>
          </div>
        ) : complete ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Password updated</p>
            <p className="mt-1">Your new password is ready to use.</p>
            <button className="mt-4 font-semibold text-emerald-800 underline" onClick={() => void handleSignIn()} type="button">Sign in with the new password</button>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <TextField autoComplete="new-password" label="New password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            <TextField autoComplete="new-password" label="Confirm new password" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
            {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
            <Button className="w-full" loading={saving} type="submit">Save new password</Button>
          </form>
        )}
      </section>
    </main>
  )
}
