import { Suspense, lazy, useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { BottomNav, ADMIN_BOTTOM_NAV, COACH_BOTTOM_NAV, PARENT_BOTTOM_NAV } from '../components/ui/BottomNav.tsx'
import { NotificationBanner } from '../components/ui/NotificationBanner.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import type { UserRole } from '../types/auth.ts'
import type { AdminTab } from '../components/admin/AdminClubPanel.tsx'
import type { CoachTab } from '../components/coach/CoachEventPanel.tsx'
import type { ParentTab } from '../components/parent/ParentPortal.tsx'

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

const ROLE_ORDER: UserRole[] = ['admin', 'coach', 'parent']

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
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
  parent: {
    title: 'Parent portal',
    summary: 'See upcoming activities for your child and respond to attendance quickly.',
  },
}

function SectionFallback({ label }: { label: string }) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
      <div className="text-sm font-medium text-slate-600">Loading {label}...</div>
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

/** Returns the user's highest-privilege role (admin > coach > parent). */
function defaultRole(roles: UserRole[]): UserRole {
  for (const role of ROLE_ORDER) {
    if (roles.includes(role)) return role
  }
  return 'parent'
}

export function DashboardPage() {
  const { profile, signOutUser } = useAuth()
  const [adminTab, setAdminTab] = useState<AdminTab>('overview')
  const [coachTab, setCoachTab] = useState<CoachTab>('schedule')
  const [parentTab, setParentTab] = useState<ParentTab>('schedule')

  // Active role view — initialised to the user's highest-privilege role.
  const [activeRole, setActiveRole] = useState<UserRole>(() =>
    profile ? defaultRole(profile.roles) : 'parent',
  )

  if (!profile) {
    return null
  }

  // Sorted roles to display in consistent order (admin → coach → parent).
  const sortedRoles = ROLE_ORDER.filter((r) => profile.roles.includes(r))
  const hasMultipleRoles = sortedRoles.length > 1

  const isAdmin = activeRole === 'admin'
  const isCoach = activeRole === 'coach'

  const activeContent = roleContent[activeRole]

  const activeTab = isAdmin ? adminTab : isCoach ? coachTab : parentTab
  const bottomNavItems = isAdmin ? ADMIN_BOTTOM_NAV : isCoach ? COACH_BOTTOM_NAV : PARENT_BOTTOM_NAV

  function handleTabChange(value: string) {
    if (isAdmin) setAdminTab(value as AdminTab)
    else if (isCoach) setCoachTab(value as CoachTab)
    else setParentTab(value as ParentTab)
  }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <main className="min-h-screen pb-20 sm:pb-0">
      {/* ── Mobile header ── */}
      <header className="flex items-center justify-between bg-[#123524] px-4 py-3 sm:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="2" />
              <polygon points="12,6 15,10 13,10 13,18 11,18 11,10 9,10" fill="white" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Club CRM</p>
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
                    activeRole === role ? 'bg-white text-[#123524]' : 'text-white/70 hover:text-white'
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
          <header className="overflow-hidden rounded-[2rem] bg-[#123524] p-6 text-white shadow-2xl shadow-[#123524]/20 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
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
                            ? 'bg-white text-[#123524]'
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
                <Button className="w-full" onClick={() => void signOutUser()} variant="secondary">
                  Sign out
                </Button>
              </div>
            </div>
          </header>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="px-4 py-4 sm:px-6 sm:py-0 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
          <NotificationBanner userId={profile.id} />
          <Suspense fallback={<SectionFallback label="workspace" />}>
            {isAdmin ? (
              <AdminClubPanel activeTab={adminTab} onTabChange={(t) => setAdminTab(t)} />
            ) : isCoach ? (
              <CoachEventPanel coachId={profile.id} profile={profile} activeTab={coachTab} onTabChange={(t) => setCoachTab(t)} />
            ) : (
              <ParentPortal profile={profile} activeTab={parentTab} onTabChange={(t) => setParentTab(t)} />
            )}
          </Suspense>
        </div>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <BottomNav items={bottomNavItems} active={activeTab} onChange={handleTabChange} />
    </main>
  )
}
