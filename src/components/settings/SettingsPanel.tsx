import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.ts'
import {
  isPushSupported,
  getNotificationPermission,
  requestPermissionAndSubscribe,
} from '../../lib/pushNotifications.ts'

interface Props {
  onClose: () => void
}

type Section = 'main' | 'profile' | 'notifications' | 'security' | 'privacy'

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
      className="flex items-center gap-1.5 text-sm font-medium text-[#123524] hover:opacity-70"
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
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-50' : 'bg-[#123524]/8'}`}>
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#123524] focus:ring-2 focus:ring-[#123524]/20"
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
          className="w-full rounded-xl bg-[#123524] py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function SectionNotifications({ onBack }: { onBack: () => void }) {
  const { profile } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribing, setSubscribing] = useState(false)
  const [done, setDone] = useState(false)
  const pushSupported = isPushSupported()

  useEffect(() => {
    setPermission(getNotificationPermission())
  }, [])

  async function handleEnable() {
    if (!profile) return
    setSubscribing(true)
    await requestPermissionAndSubscribe(profile.id)
    const current = getNotificationPermission()
    setPermission(current)
    if (current === 'granted') setDone(true)
    setSubscribing(false)
  }

  const statusColor = permission === 'granted' ? 'text-green-600 bg-green-50' : permission === 'denied' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'
  const statusLabel = permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Not set up'

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
              <span className="h-1.5 w-1.5 rounded-full bg-[#123524]/50 shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        {!pushSupported && (
          <p className="text-xs text-slate-400">Push notifications are not supported in this browser.</p>
        )}

        {pushSupported && permission !== 'denied' && permission !== 'granted' && (
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={subscribing}
            className="w-full rounded-xl bg-[#123524] py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 active:scale-[0.98]"
          >
            {subscribing ? 'Enabling…' : done ? '✓ Notifications on' : 'Enable notifications'}
          </button>
        )}

        {pushSupported && permission === 'denied' && (
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600">
            Notifications are blocked in your browser settings. To enable them, go to your browser&apos;s site settings and allow notifications for this site, then return here.
          </div>
        )}

        {pushSupported && permission === 'granted' && (
          <div className="rounded-xl bg-green-50 p-3 text-xs text-green-700">
            You&apos;re all set — notifications are active on this device.
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
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#123524]/50 shrink-0" />
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

export function SettingsPanel({ onClose }: Props) {
  const { profile, signOutUser } = useAuth()
  const [section, setSection] = useState<Section>('main')

  const initials = profile?.name
    ? profile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-5 px-1 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          aria-label="Close settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {section === 'main' && (
        <div className="space-y-3">
          {/* Profile summary */}
          <div className="flex items-center gap-3 rounded-2xl bg-[#123524] px-4 py-4 text-white">
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
            <RowButton
              onClick={() => setSection('notifications')}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
              label="Push Notifications"
              sublabel="Events, reminders & announcements"
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

          <p className="text-center text-[10px] text-slate-300">Club CRM · v{__APP_VERSION__}</p>
        </div>
      )}

      {section === 'profile' && <SectionProfile onBack={() => setSection('main')} />}
      {section === 'notifications' && <SectionNotifications onBack={() => setSection('main')} />}
      {section === 'security' && <SectionSecurity onBack={() => setSection('main')} />}
      {section === 'privacy' && <SectionPrivacy onBack={() => setSection('main')} />}
    </div>
  )
}
