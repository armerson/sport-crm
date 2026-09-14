import { Suspense, lazy, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { availableRoles, resolveWorkspaceRole } from '../utils/workspace.ts'
import { BottomNav } from '../components/ui/BottomNav.tsx'
import { ADMIN_BOTTOM_NAV, COACH_BOTTOM_NAV, PARENT_BOTTOM_NAV, PLAYER_BOTTOM_NAV } from '../components/ui/bottomNavItems.tsx'
import { InstallBanner } from '../components/ui/InstallBanner.tsx'
import { NotificationBanner } from '../components/ui/NotificationBanner.tsx'
import { NotificationBell } from '../components/ui/NotificationBell.tsx'
import { SettingsPanel } from '../components/settings/SettingsPanel.tsx'
import { PageSkeleton } from '../components/ui/Skeleton.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { markMessagesRead, useUnreadMessages } from '../hooks/useUnreadMessages.ts'
import { useClubSettings } from '../hooks/useClubSettings.ts'
import type { UserRole } from '../types/auth.ts'
import type { AdminTab } from '../components/admin/AdminClubPanel.tsx'
import type { CoachTab } from '../components/coach/CoachEventPanel.tsx'
import type { ParentTab } from '../components/parent/ParentPortal.tsx'
import type { PlayerTab } from '../components/player/PlayerPortal.tsx'

const AdminClubPanel = lazy(async () => {
  const module = await import('../components/admin/AdminClubPanel.tsx')
  return { default: module.AdminClubPanel }
})

const CoachEventPanel = lazy(async () => {
  const module = await import('../components/coach/CoachEventPanel.tsx')
  return { default: module.CoachEventPanel }
})

const ParentPortal = lazy(async () => {
  const module = await import('../components/parent/ParentPortal.tsx')
  return { default: module.ParentPortal }
})

const PlayerPortal = lazy(async () => {
  const module = await import('../components/player/PlayerPortal.tsx')
  return { default: module.PlayerPortal }
})

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
  player: 'Player',
  parent: 'Parent',
}

const roleContent: Record<UserRole, { title: string; summary: string }> = {
  admin: {
    title: 'Club administration',
    summary: 'Set up teams, create player records, and assign coaching staff from one place.',
  },
  coach: {
    title: 'Coach workspace',
    summary: 'Plan training, publish fixtures, and track availability before kickoff.',
  },
  player: {
    title: 'Player portal',
    summary: 'View your schedule, manage your profile, and keep on top of club fees.',
  },
  parent: {
    title: 'Parent portal',
    summary: 'See upcoming activities for your child and respond to attendance quickly.',
  },
}

const tabDescriptions: Record<UserRole, Record<string, string>> = {
  admin: {
    overview: 'See club activity, pending registrations, and the work that needs attention.',
    manage: 'Manage teams, players, coaches, forms, and club settings.',
    posts: 'Share club news and updates with members.',
    billing: 'Manage fees, subscriptions, and payments.',
    messages: 'Send updates to teams, groups, or the whole club.',
  },
  coach: {
    schedule: 'See upcoming sessions, attendance, and match-day details.',
    create: 'Add a training session or fixture and notify the squad.',
    squad: 'Find players, review profiles, and manage your squad.',
    stats: 'Track attendance, results, and player performance.',
    feed: 'Read and share the latest team news.',
    messages: 'Keep players and families informed.',
  },
  parent: {
    schedule: 'See what is coming up and respond to attendance.',
    development: 'Review feedback and your child’s progress.',
    children: 'Manage player profiles and important details.',
    feed: 'Read the latest news from the club.',
    messages: 'Read and reply to team updates.',
  },
  player: {
    schedule: 'See what is coming up and respond to attendance.',
    feed: 'Read the latest news from your club.',
    profile: 'Keep your playing and contact details up to date.',
    billing: 'View subscriptions and outstanding fees.',
    messages: 'Read and reply to team updates.',
  },
}

function SectionFallback() {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
      <PageSkeleton />
    </section>
  )
}

function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// Prefetch the role panels lazily once the page is idle.
// This means the first tab switch after login is instant rather than waiting for a network fetch.
function prefetchPanels() {
  const prefetch = (fn: () => Promise<unknown>) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => { void fn() }, { timeout: 4000 })
    } else {
      setTimeout(() => { void fn() }, 2000)
    }
  }
  prefetch(() => import('../components/admin/AdminClubPanel.tsx'))
  prefetch(() => import('../components/coach/CoachEventPanel.tsx'))
  prefetch(() => import('../components/parent/ParentPortal.tsx'))
  prefetch(() => import('../components/player/PlayerPortal.tsx'))
}

function scrollWorkspaceToTop() {
  requestAnimationFrame(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  })
}

export function DashboardPage() {
  const { profile, loading: authLoading, error: authError, signOutUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showSettings, setShowSettings] = useState(false)
  const [adminTab, setAdminTab] = useState<AdminTab>('overview')
  const [coachTab, setCoachTab] = useState<CoachTab>('schedule')
  const [parentTab, setParentTab] = useState<ParentTab>('schedule')
  const [playerTab, setPlayerTab] = useState<PlayerTab>('schedule')

  // Kick off prefetch once profile is available (after auth resolves)
  useEffect(() => {
    if (profile) prefetchPanels()
  }, [profile])

  // Club branding — name, logo, primary colour
  const { settings: clubSettings } = useClubSettings()

  const activeRole = profile ? resolveWorkspaceRole(profile, searchParams.get('view')) : 'parent'
  const activeTab = activeRole === 'admin' ? adminTab : activeRole === 'coach' ? coachTab : activeRole === 'player' ? playerTab : parentTab
  const hasUnreadMessages = useUnreadMessages(profile?.id ?? '', activeTab === 'messages' && !showSettings)
  function setActiveRole(role: UserRole) {
    setShowSettings(false)
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('view', role)
      return next
    })
    scrollWorkspaceToTop()
  }

  function openSettings() {
    setShowSettings(true)
    scrollWorkspaceToTop()
  }

  function closeSettings() {
    setShowSettings(false)
    scrollWorkspaceToTop()
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <svg className="h-10 w-10 animate-spin text-[#1565ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <p className="text-sm font-medium text-slate-500">Loading club workspace…</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 to-slate-100 px-4 text-center">
        <p className="text-base font-semibold text-slate-800">
          {authError ?? 'Your profile could not be loaded.'}
        </p>
        <p className="text-sm text-slate-500">Try refreshing the page. If the problem persists, contact your club admin.</p>
        <button
          onClick={() => void signOutUser()}
          className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Sign out and try again
        </button>
      </div>
    )
  }

  const sortedRoles = availableRoles(profile)
  const hasMultipleRoles = sortedRoles.length > 1

  const isAdmin = activeRole === 'admin'
  const isCoach = activeRole === 'coach'
  const isPlayer = activeRole === 'player'

  const activeContent = roleContent[activeRole]

  const bottomNavItems = isAdmin
    ? ADMIN_BOTTOM_NAV
    : isCoach
      ? COACH_BOTTOM_NAV
      : isPlayer
        ? PLAYER_BOTTOM_NAV
        : PARENT_BOTTOM_NAV

  const activeTabLabel = activeRole === 'coach' && activeTab === 'create'
    ? 'New event'
    : bottomNavItems.find((item) => item.value === activeTab)?.label ?? activeContent.title
  const activeTabDescription = tabDescriptions[activeRole][activeTab] ?? activeContent.summary
  const pageTitle = showSettings ? 'Settings' : activeTabLabel
  const pageDescription = showSettings ? 'Manage your profile, notifications, security, and app updates.' : activeTabDescription
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  function handleTabChange(value: string) {
    setShowSettings(false)
    if (value === 'messages') markMessagesRead(profile?.id ?? '')
    if (isAdmin) setAdminTab(value as AdminTab)
    else if (isCoach) setCoachTab(value as CoachTab)
    else if (isPlayer) setPlayerTab(value as PlayerTab)
    else setParentTab(value as ParentTab)
    scrollWorkspaceToTop()
  }

  const navBadges: Record<string, boolean> = { messages: hasUnreadMessages }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <main className="ui-workspace min-h-screen overflow-x-hidden pb-32 sm:pb-10">
      <a href="#workspace-content" className="ui-skip">Skip to workspace</a>
      {/* ── Mobile header ── */}
      <header className="ui-mobile-header relative overflow-hidden px-4 pb-9 pt-4 text-white sm:hidden" style={{ backgroundColor: clubSettings.primaryColor }}>
        <div aria-hidden="true" className="absolute -right-12 -top-20 h-56 w-56 rounded-full border-[38px] border-white/[0.06]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
          {clubSettings.logoUrl ? (
            <img src={clubSettings.logoUrl} alt={clubSettings.name} className="h-11 w-11 rounded-2xl bg-white/10 object-contain p-1 ring-1 ring-white/20" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="2" />
                <polygon points="12,6 15,10 13,10 13,18 11,18 11,10 9,10" fill="white" />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-white">{clubSettings.name}</p>
            <p className="truncate text-[11px] font-medium text-white/65">{activeContent.title}</p>
          </div>
        </div>
          <div className="flex shrink-0 items-center gap-1">
          <NotificationBell
            hasUnread={hasUnreadMessages}
            onClick={() => {
              markMessagesRead(profile.id)
              handleTabChange('messages')
            }}
          />
          <button
            type="button"
            onClick={openSettings}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition active:bg-white/15"
            aria-label="Settings"
          >
            <GearIcon />
          </button>
        </div>
        </div>

        <div className="relative mt-7">
          <p className="text-sm font-medium text-white/70">{greeting}, {profile.name.split(' ')[0]}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-white">{pageTitle}</h1>
          <p className="mt-2 max-w-sm text-sm leading-5 text-white/70">{pageDescription}</p>
        </div>

        {hasMultipleRoles ? (
          <div aria-label="Choose workspace" className="relative mt-5 flex w-fit items-center gap-1 rounded-xl bg-black/15 p-1">
            {sortedRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
                  activeRole === role ? 'bg-white text-slate-900 shadow-sm' : 'text-white/70 hover:text-white'
                }`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {/* Desktop workspace header */}
      <header className="ui-workspace-header mb-8 hidden sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-8 py-5">
          <div className="flex min-w-0 items-center gap-3">
            {clubSettings.logoUrl ? <img src={clubSettings.logoUrl} alt="" className="h-11 w-11 object-contain" /> : (
              <span className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: clubSettings.primaryColor }}>{clubSettings.name.charAt(0)}</span>
            )}
            <div><p className="font-bold tracking-tight text-slate-950">{clubSettings.name}</p><p className="text-xs text-slate-500">{activeContent.title}</p></div>
          </div>
          <div className="flex items-center gap-3">
            {hasMultipleRoles ? <select aria-label="Workspace" value={activeRole} onChange={(event) => setActiveRole(event.target.value as UserRole)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium">
              {sortedRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]} workspace</option>)}
            </select> : null}
            <NotificationBell hasUnread={hasUnreadMessages} onClick={() => handleTabChange('messages')} className="h-10 w-10 !bg-slate-100 !text-slate-600" />
            <button type="button" onClick={openSettings} className="rounded-xl p-3 text-slate-500 hover:bg-slate-100" aria-label="Settings"><GearIcon /></button>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{initials}</span><span className="max-w-36 truncate text-sm font-semibold">{profile.name}</span></div>
            <button type="button" onClick={() => void signOutUser()} className="rounded-xl p-3 text-slate-500 hover:bg-slate-100" aria-label="Sign out"><SignOutIcon /></button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <div id="workspace-content" tabIndex={-1} className="relative z-10 -mt-4 rounded-t-[1.75rem] bg-[var(--ui-canvas)] px-4 pb-5 pt-7 sm:mt-0 sm:rounded-none sm:bg-transparent sm:px-6 sm:py-0 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
          <div key={`${activeRole}:${activeTab}:${showSettings ? 'settings' : 'workspace'}`} className="ui-view-enter">
            {showSettings ? (
              <SettingsPanel onClose={closeSettings} />
            ) : (
              <>
              <InstallBanner />
              <NotificationBanner userId={profile.id} />
              <Suspense fallback={<SectionFallback />}>
                {isAdmin ? (
                  <AdminClubPanel activeTab={adminTab} onTabChange={handleTabChange} />
                ) : isCoach ? (
                  <CoachEventPanel coachId={profile.id} profile={profile} activeTab={coachTab} onTabChange={handleTabChange} />
                ) : isPlayer ? (
                  <PlayerPortal profile={profile} activeTab={playerTab} onTabChange={handleTabChange} />
                ) : (
                  <ParentPortal profile={profile} activeTab={parentTab} onTabChange={handleTabChange} />
                )}
              </Suspense>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Coach floating create button (mobile only) ── */}
      {isCoach && coachTab !== 'create' && !showSettings ? (
        <button
          type="button"
          aria-label="Create event"
          onClick={() => handleTabChange('create')}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-50 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ui-accent)] px-4 text-white shadow-lg transition active:scale-95 sm:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-sm font-bold">New event</span>
        </button>
      ) : null}

      {/* ── Mobile bottom navigation ── */}
      {!showSettings ? <BottomNav items={bottomNavItems} active={activeTab} onChange={handleTabChange} badges={navBadges} /> : null}
    </main>
  )
}
