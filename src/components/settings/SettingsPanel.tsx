import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.ts'
import {
  isPushSupported,
  getNotificationPermission,
  hasPushSubscription,
  requestPermissionAndSubscribe,
  sendPushToUsers,
} from '../../lib/pushNotifications.ts'
import { checkForAppUpdate } from '../../registerAppUpdates.ts'
import { registerCurrentMemberAsPlayer } from '../../services/memberRegistration.ts'
import { ageOnDate } from '../../utils/birthDate.ts'
import { createCalendarFeed, getCalendarFeed, rotateCalendarFeed, type CalendarFeed } from '../../services/calendar.ts'

interface Props {
  onClose: () => void
  initialSection?: Section
  onPlayerRegistered?: () => void
}

type Section = 'main' | 'profile' | 'notifications' | 'calendar' | 'security' | 'privacy' | 'player-registration'

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm font-medium text-[#1565ff] hover:opacity-70"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  )
}

function RowButton({ icon, label, sublabel, onClick, danger }: {
  icon: React.ReactNode
  label: string
  sublabel?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-slate-100 transition active:scale-[0.98] ${danger ? 'text-red-600' : 'text-slate-800'}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-50' : 'bg-[#1565ff]/8'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {sublabel ? <span className="block truncate text-xs text-slate-400">{sublabel}</span> : null}
      </span>
      {!danger && <ChevronRight />}
    </button>
  )
}

function SectionProfile({ onBack }: { onBack: () => void }) {
  const { profile, updateProfile, currentUser } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim() || name.trim() === profile?.name) return
    setSaving(true)
    setError(null)
    try {
      await updateProfile(name.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h2 className="text-base font-bold text-slate-800">My Profile</h2>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false) }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1565ff] focus:ring-2 focus:ring-[#1565ff]/20"
            placeholder="Your name"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</span>
          <div className="w-full rounded-xl border border-slate-100 bg-slate-100 px-3 py-2.5 text-sm text-slate-500">
            {currentUser?.email ?? profile?.email ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Contact your club admin to change your email address.</p>
        </label>

        {error ? <p className="text-xs text-red-500">{error}</p> : null}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim() || name.trim() === profile?.name}
          className="w-full rounded-xl bg-[#1565ff] py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function SectionNotifications({ onBack }: { onBack: () => void }) {
  const { profile } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermission)
  const [connection, setConnection] = useState<'checking' | 'active' | 'missing'>('checking')
  const [subscribing, setSubscribing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'sent' | 'failed'>('idle')
  const pushSupported = isPushSupported()

  useEffect(() => {
    let active = true
    void hasPushSubscription().then((subscribed) => {
      if (active) setConnection(subscribed ? 'active' : 'missing')
    })
    return () => { active = false }
  }, [])

  async function handleEnable() {
    if (!profile) return
    setSubscribing(true)
    const subscribed = await requestPermissionAndSubscribe(profile.id)
    const current = getNotificationPermission()
    setPermission(current)
    setConnection(subscribed ? 'active' : 'missing')
    setTestResult('idle')
    setSubscribing(false)
  }

  async function handleTest() {
    if (!profile) return
    setTesting(true)
    setTestResult('idle')
    const sent = await sendPushToUsers(
      [profile.id],
      'ClubOS notifications are working',
      'This device is ready for team updates, reminders and announcements.',
      '/',
    )
    setTestResult(sent ? 'sent' : 'failed')
    setTesting(false)
  }

  const isActive = permission === 'granted' && connection === 'active'
  const statusColor = isActive ? 'text-green-600 bg-green-50' : permission === 'denied' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'
  const statusLabel = connection === 'checking' ? 'Checking…' : isActive ? 'Connected' : permission === 'denied' ? 'Blocked' : 'Needs setup'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h2 className="text-base font-bold text-slate-800">Push Notifications</h2>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
        </div>

        <ul className="space-y-1.5 text-xs text-slate-500">
          {['New events added to your team', 'Event reminders', 'Club announcements', 'Match results'].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1565ff]/50 shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        {!pushSupported && (
          <p className="text-xs text-slate-400">Push notifications are not supported in this browser.</p>
        )}

        {pushSupported && permission !== 'denied' && !isActive && connection !== 'checking' && (
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={subscribing}
            className="w-full rounded-xl bg-[#1565ff] py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 active:scale-[0.98]"
          >
            {subscribing ? 'Connecting…' : permission === 'granted' ? 'Reconnect this device' : 'Enable notifications'}
          </button>
        )}

        {pushSupported && permission === 'denied' && (
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600">
            Notifications are blocked in your browser settings. To enable them, go to your browser&apos;s site settings and allow notifications for this site, then return here.
          </div>
        )}

        {pushSupported && isActive && (
          <div className="space-y-3 rounded-xl bg-green-50 p-3 text-xs text-green-700">
            <p>You&apos;re all set — notifications are connected on this device.</p>
            <button type="button" onClick={() => void handleTest()} disabled={testing} className="w-full rounded-xl bg-white px-3 py-2.5 font-semibold text-green-800 shadow-sm ring-1 ring-green-200 transition active:scale-[0.98] disabled:opacity-50">
              {testing ? 'Sending test…' : testResult === 'sent' ? '✓ Test sent' : 'Send a test notification'}
            </button>
            {testResult === 'failed' ? <p className="text-red-600" role="alert">The test could not be delivered. Reconnect this device and try again.</p> : null}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionSecurity({ onBack }: { onBack: () => void }) {
  const { profile, resetPassword, signOutUser } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    if (!profile?.email) return
    setSending(true)
    setError(null)
    try {
      await resetPassword(profile.email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h2 className="text-base font-bold text-slate-800">Security</h2>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Password</p>
          {sent ? (
            <div className="rounded-xl bg-green-50 p-3 text-xs text-green-700">
              Password reset email sent to <strong>{profile?.email}</strong>. Check your inbox.
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                We&apos;ll email a secure reset link to <span className="font-medium">{profile?.email}</span>.
              </p>
              {error ? <p className="text-xs text-red-500">{error}</p> : null}
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={sending}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition disabled:opacity-40 active:scale-[0.98]"
              >
                {sending ? 'Sending…' : 'Send password reset email'}
              </button>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Session</p>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="w-full rounded-xl border border-red-100 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition active:scale-[0.98]"
          >
            Sign out of this device
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionCalendar({ onBack }: { onBack: () => void }) {
  const { profile } = useAuth()
  const [feed, setFeed] = useState<CalendarFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!profile) return () => { active = false }
    void getCalendarFeed(profile.id)
      .then((value) => { if (active) setFeed(value) })
      .catch(() => { if (active) setError('The calendar connection could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [profile])

  async function handleCreate() {
    if (!profile) return
    setWorking(true)
    setError(null)
    try { setFeed(await createCalendarFeed(profile.id)) }
    catch { setError('The private calendar link could not be created.') }
    finally { setWorking(false) }
  }

  async function handleRotate() {
    if (!profile || !window.confirm('Replace your private calendar link? Your current calendar subscription will stop updating.')) return
    setWorking(true)
    setError(null)
    try { setFeed(await rotateCalendarFeed(profile.id)); setCopied(false) }
    catch { setError('The private calendar link could not be replaced.') }
    finally { setWorking(false) }
  }

  async function handleCopy() {
    if (!feed) return
    await navigator.clipboard.writeText(feed.httpsUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><BackButton onClick={onBack} /><h2 className="text-base font-bold text-slate-800">Calendar</h2></div>
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-900">Keep your schedule in sync</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Subscribe once to see your teams&apos; training and matches in Apple Calendar, Google Calendar or Outlook. Changes in ClubOS will flow into the calendar.</p>
        </div>
        {loading ? <p className="text-xs text-slate-400">Checking your calendar connection…</p> : null}
        {!loading && !feed ? (
          <button type="button" onClick={() => void handleCreate()} disabled={working} className="w-full rounded-xl bg-[#1565ff] py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50">
            {working ? 'Creating…' : 'Create private calendar link'}
          </button>
        ) : null}
        {feed ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><strong>Ready to subscribe.</strong> This private link includes only the teams available in your ClubOS account.</div>
            <a href={feed.webcalUrl} className="block w-full rounded-xl bg-[#1565ff] py-2.5 text-center text-sm font-semibold text-white transition active:scale-[0.98]">Subscribe on this device</a>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void handleCopy()} className="rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700">{copied ? '✓ Copied' : 'Copy link'}</button>
              <a href={feed.httpsUrl} className="rounded-xl border border-slate-200 py-2.5 text-center text-xs font-semibold text-slate-700">Download calendar</a>
            </div>
            <button type="button" onClick={() => void handleRotate()} disabled={working} className="w-full py-1 text-xs font-semibold text-slate-400 hover:text-red-600 disabled:opacity-50">Replace private link</button>
          </div>
        ) : null}
        {error ? <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700" role="alert">{error}</p> : null}
        <p className="text-[11px] leading-4 text-slate-400">Treat this link like a password. Anyone who has it can read your schedule. Replace it here at any time to disable the old link.</p>
      </div>
    </div>
  )
}

function SectionPrivacy({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h2 className="text-base font-bold text-slate-800">Privacy &amp; Data</h2>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 space-y-4 text-sm text-slate-600">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What we store</p>
          <ul className="space-y-1.5 text-xs">
            {[
              'Your name and email address',
              'Team memberships and linked players',
              'Event attendance and match results',
              'Push notification subscription (device token)',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#1565ff]/50 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your rights</p>
          <p className="text-xs text-slate-500">
            You can request deletion of your account and all associated data by contacting your club administrator. Data is stored securely in Supabase with row-level security policies ensuring you can only access your own information.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Third parties</p>
          <p className="text-xs text-slate-500">
            We do not sell or share your data with third parties. Payment processing (where enabled) is handled by Stripe and governed by their privacy policy.
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionPlayerRegistration({ onBack, onDone }: { onBack: () => void; onDone?: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [dob, setDob] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const age = ageOnDate(dob)
    if (age === null) { setError('Enter a valid date of birth.'); return }
    if (age < 18) { setError('Players under 18 must be registered by a parent or guardian.'); return }
    setSaving(true)
    setError(null)
    try {
      await registerCurrentMemberAsPlayer(dob)
      await refreshProfile()
      onDone?.()
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : 'Player registration could not be completed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h2 className="text-base font-bold text-slate-800">Add player workspace</h2>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-semibold text-slate-900">Register {profile?.name} as an adult player</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">Your Admin, Coach and Parent access will stay in place. The club can assign your player profile to a team after registration.</p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Date of birth</span>
            <input type="date" required value={dob} onChange={(event) => setDob(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1565ff] focus:ring-2 focus:ring-[#1565ff]/20" />
          </label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#1565ff] py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 active:scale-[0.98]">
            {saving ? 'Adding player workspace…' : 'Register me as a player'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function SettingsPanel({ onClose, initialSection = 'main', onPlayerRegistered }: Props) {
  const { profile, signOutUser } = useAuth()
  const [section, setSection] = useState<Section>(initialSection)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'current' | 'unsupported' | 'error'>('idle')

  const initials = profile?.name
    ? profile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  async function handleUpdateCheck() {
    setUpdateStatus('checking')
    try {
      setUpdateStatus(await checkForAppUpdate())
    } catch {
      setUpdateStatus('error')
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-5 px-1 pb-6">
      {/* Header */}
      <div className="flex items-center justify-end sm:justify-between">
        <h1 className="hidden text-xl font-bold text-slate-800 sm:block">Settings</h1>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          aria-label="Close settings"
        >
          <span className="sm:hidden">Done</span>
          <svg className="hidden sm:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {section === 'main' && (
        <div className="space-y-3">
          {/* Profile summary */}
          <div className="flex items-center gap-3 rounded-2xl bg-[#1565ff] px-4 py-4 text-white">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{profile?.name}</p>
              <p className="truncate text-xs text-white/60">{profile?.email}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/40">
                {profile?.roles.join(' · ')}
              </p>
            </div>
          </div>

          {/* Menu rows */}
          <div className="space-y-2">
            <RowButton
              onClick={() => setSection('profile')}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
              label="My Profile"
              sublabel="Edit your display name"
            />
            {!profile?.linkedPlayerId ? (
              <RowButton
                onClick={() => setSection('player-registration')}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/><path d="M19 4v6M16 7h6"/></svg>}
                label={profile?.roles.includes('player') ? 'Finish player setup' : 'Add player workspace'}
                sublabel="Register yourself as an adult player"
              />
            ) : null}
            <RowButton
              onClick={() => setSection('notifications')}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
              label="Push Notifications"
              sublabel="Events, reminders & announcements"
            />
            <RowButton
              onClick={() => setSection('calendar')}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>}
              label="Calendar"
              sublabel="Keep matches and training in sync"
            />
            <RowButton
              onClick={() => setSection('security')}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
              label="Security"
              sublabel="Password & sign out"
            />
            <RowButton
              onClick={() => setSection('privacy')}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              label="Privacy & Data"
              sublabel="What we store and your rights"
            />
          </div>

          {/* Sign out */}
          <RowButton
            onClick={() => void signOutUser()}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
            label="Sign out"
            danger
          />

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">ClubOS v{__APP_VERSION__}</p>
                <p className="text-xs text-slate-400">{window.location.host}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleUpdateCheck()}
                disabled={updateStatus === 'checking'}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition active:scale-[0.98] disabled:opacity-50"
              >
                {updateStatus === 'checking' ? 'Checking…' : 'Check for update'}
              </button>
            </div>
            {updateStatus !== 'idle' && updateStatus !== 'checking' ? (
              <p className={`mt-2 text-xs ${updateStatus === 'current' ? 'text-green-600' : 'text-amber-600'}`}>
                {updateStatus === 'current'
                  ? `You have the current release, v${__APP_VERSION__}.`
                  : updateStatus === 'unsupported'
                    ? 'Updates are managed by this browser.'
                    : 'Could not check just now. Close and reopen the app, then try again.'}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {section === 'profile' && <SectionProfile onBack={() => setSection('main')} />}
      {section === 'notifications' && <SectionNotifications onBack={() => setSection('main')} />}
      {section === 'calendar' && <SectionCalendar onBack={() => setSection('main')} />}
      {section === 'security' && <SectionSecurity onBack={() => setSection('main')} />}
      {section === 'privacy' && <SectionPrivacy onBack={() => setSection('main')} />}
      {section === 'player-registration' && <SectionPlayerRegistration onBack={() => setSection('main')} onDone={onPlayerRegistered} />}
    </div>
  )
}
