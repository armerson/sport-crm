import { Suspense, lazy, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { BottomNav, ADMIN_BOTTOM_NAV, COACH_BOTTOM_NAV, PARENT_BOTTOM_NAV, PLAYER_BOTTOM_NAV } from '../components/ui/BottomNav.tsx'
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

const ROLE_ORDER: UserRole[] = ['admin', 'coach', 'player', 'parent']

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

/** Returns the user's highest-privilege role (admin > coach > player > parent). */
function defaultRole(roles: UserRole[]): UserRole {
  for (const role of ROLE_ORDER) {
    if (roles.includes(role)) return role
  }
  return 'parent'
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

export function DashboardPage() {
  const { profile, signOutUser } = useAuth()
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

  // Unread messages badge — uses the profile's own team memberships
  const hasUnreadMessages = useUnreadMessages(profile?.id ?? '', profile?.teams ?? [])

  // Active role view — initialised to the user's highest-privilege role.
  const [activeRole, setActiveRole] = useState<UserRole>(() =>
    profile ? defaultRole(profile.roles) : 'parent',
  )

  // Deep link: /parent → /?view=parent (see App.tsx). Must run before any early return — conditional hooks break React.
  useEffect(() => {
    if (!profile) return
    const v = searchParams.get('view')
    if (!v) return
    if (v === 'parent' && (profile.roles.includes('parent') || profile.children.length > 0)) {
      setActiveRole('parent')
    } else if (v === 'coach' && profile.roles.includes('coach')) {
      setActiveRole('coach')
    } else if (v === 'admin' && profile.roles.includes('admin')) {
      setActiveRole('admin')
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('view')
      return next
    }, { replace: true })
  }, [profile, searchParams, setSearchParams])

  if (!profile) {
    return null
  }

  // Sorted roles for the switcher. DB `roles` may omit `parent` even when `player_parents`
  // links exist — still offer Parent (and Player when linked) so multi-hat users can switch.
  const sortedRoles = ROLE_ORDER.filter((r) => {
    if (profile.roles.includes(r)) return true
    if (r === 'parent' && profile.children.length > 0) return true
    if (r === 'player' && profile.linkedPlayerId) return true
    return false
  })
  const hasMultipleRoles = sortedRoles.length > 1

  const isAdmin = activeRole === 'admin'
  const isCoach = activeRole === 'coach'
  const isPlayer = activeRole === 'player'

  const activeContent = roleContent[activeRole]

  const activeTab = isAdmin ? adminTab : isCoach ? coachTab : isPlayer ? playerTab : parentTab
  const bottomNavItems = isAdmin
    ? ADMIN_BOTTOM_NAV
    : isCoach
      ? COACH_BOTTOM_NAV
      : isPlayer
        ? PLAYER_BOTTOM_NAV
        : PARENT_BOTTOM_NAV

  function handleTabChange(value: string) {
    if (value === 'messages') markMessagesRead(profile?.id ?? '')
    if (isAdmin) setAdminTab(value as AdminTab)
    else if (isCoach) setCoachTab(value as CoachTab)
    else if (isPlayer) setPlayerTab(value as PlayerTab)
    else setParentTab(value as ParentTab)
  }

  const navBadges: Record<string, boolean> = { messages: hasUnreadMessages }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <main className="min-h-screen overflow-x-hidden pb-20 sm:pb-0">
      {/* ── Mobile header ── */}
      <header className="flex items-center justify-between px-4 py-3 sm:hidden" style={{ backgroundColor: clubSettings.primaryColor }}>
        <div className="flex items-center gap-2.5">
          {clubSettings.logoUrl ? (
            <img src={clubSettings.logoUrl} alt={clubSettings.name} className="h-8 w-8 rounded-xl object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="2" />
                <polygon points="12,6 15,10 13,10 13,18 11,18 11,10 9,10" fill="white" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-white">{clubSettings.name}</p>
            <p className="text-[10px] text-white/60">{activeContent.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasMultipleRoles ? (
            <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
              {sortedRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActiveRole(role)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize transition ${
                    activeRole === role ? 'bg-white text-[#1565ff]' : 'text-white/70 hover:text-white'
                  }`}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold text-white">
              {initials}
            </span>
            <span className="max-w-[80px] truncate text-xs font-medium text-white">{profile.name.split(' ')[0]}</span>
          </div>
          <NotificationBell
            hasUnread={hasUnreadMessages}
            onClick={() => {
              markMessagesRead(profile.id)
              handleTabChange('messages')
            }}
          />
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition active:bg-white/20"
            aria-label="Settings"
          >
            <GearIcon />
          </button>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition active:bg-white/20"
            aria-label="Sign out"
          >
            <SignOutIcon />
          </button>
        </div>
      </header>

      {/* ── Desktop header ── */}
      <div className="hidden px-6 py-6 sm:block lg:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="overflow-hidden rounded-[2rem] p-6 text-white shadow-2xl sm:p-8" style={{ backgroundColor: clubSettings.primaryColor, boxShadow: `0 25px 50px -12px ${clubSettings.primaryColor}33` }}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {clubSettings.logoUrl ? (
                    <img src={clubSettings.logoUrl} alt={clubSettings.name} className="h-10 w-10 rounded-xl object-cover ring-2 ring-white/30" />
                  ) : null}
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/50">{clubSettings.name}</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{activeContent.title}</h1>
                <p className="max-w-2xl text-sm leading-6 text-white/80 sm:text-base">{activeContent.summary}</p>
                {hasMultipleRoles ? (
                  <div className="flex gap-1 pt-2">
                    {sortedRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setActiveRole(role)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                          activeRole === role
                            ? 'bg-white text-[#1565ff]'
                            : 'border border-white/30 text-white/70 hover:border-white/60 hover:text-white'
                        }`}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-start gap-3 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm sm:min-w-72">
                <p className="text-sm text-white/75">Signed in as</p>
                <div>
                  <p className="text-xl font-semibold">{profile.name}</p>
                  <p className="text-sm text-white/75">
                    {sortedRoles.map((r) => ROLE_LABELS[r]).join(' · ')}
                  </p>
                </div>
                <div className="flex w-full gap-2">
                  <NotificationBell
                    hasUnread={hasUnreadMessages}
                    onClick={() => {
                      markMessagesRead(profile.id)
                      handleTabChange('messages')
                    }}
                    className="h-9 w-9"
                  />
                  <Button className="flex-1" onClick={() => setShowSettings(true)} variant="secondary">
                    Settings
                  </Button>
                  <Button className="flex-1" onClick={() => void signOutUser()} variant="secondary">
                    Sign out
                  </Button>
                </div>
              </div>
            </div>
          </header>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="px-4 py-4 sm:px-6 sm:py-0 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
          {showSettings ? (
            <SettingsPanel onClose={() => setShowSettings(false)} />
          ) : (
            <>
              <InstallBanner />
              <NotificationBanner userId={profile.id} />
              <Suspense fallback={<SectionFallback />}>
                {isAdmin ? (
                  <AdminClubPanel activeTab={adminTab} onTabChange={(t) => setAdminTab(t)} />
                ) : isCoach ? (
                  <CoachEventPanel coachId={profile.id} profile={profile} activeTab={coachTab} onTabChange={(t) => setCoachTab(t)} />
                ) : isPlayer ? (
                  <PlayerPortal profile={profile} activeTab={playerTab} onTabChange={(t) => setPlayerTab(t)} />
                ) : (
                  <ParentPortal profile={profile} activeTab={parentTab} onTabChange={(t) => setParentTab(t)} />
                )}
              </Suspense>
            </>
          )}
        </div>
      </div>

      {/* ── Coach floating create button (mobile only) ── */}
      {isCoach && coachTab !== 'create' ? (
        <button
          type="button"
          aria-label="Create event"
          onClick={() => setCoachTab('create')}
          className="fixed bottom-[4.5rem] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#1565ff] text-white shadow-lg shadow-[#1565ff]/40 transition active:scale-95 hover:bg-[#0d4ed8] sm:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      ) : null}

      {/* ── Mobile bottom navigation ── */}
      <BottomNav items={bottomNavItems} active={activeTab} onChange={handleTabChange} badges={navBadges} />
    </main>
  )
}
