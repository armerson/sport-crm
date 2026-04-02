import { Suspense, lazy } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { useAuth } from '../hooks/useAuth.ts'

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

const TeamMessagesPanel = lazy(async () => {
  const module = await import('../components/messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

const roleContent = {
  admin: {
    title: 'Club administration',
    summary: 'Set up teams, create player records, and assign coaching staff from one place.',
    actions: ['Create teams', 'Add players', 'Assign coaches'],
  },
  coach: {
    title: 'Coach workspace',
    summary: 'Plan training, publish fixtures, and track availability before kickoff.',
    actions: ['Create events', 'Review attendance', 'Message the team'],
  },
  parent: {
    title: 'Parent portal',
    summary: 'See upcoming activities for your child and respond to attendance quickly.',
    actions: ['View child events', 'Respond to attendance', 'Read team messages'],
  },
} as const

function SectionFallback({ label }: { label: string }) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
      <div className="text-sm font-medium text-slate-600">Loading {label}...</div>
    </section>
  )
}

export function DashboardPage() {
  const { profile, signOutUser } = useAuth()

  if (!profile) {
    return null
  }

  const activeContent = roleContent[profile.role]
  const isAdmin = profile.role === 'admin'
  const isCoach = profile.role === 'coach'

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] bg-[#123524] p-6 text-white shadow-2xl shadow-[#123524]/20 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                Phase 1 MVP
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{activeContent.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">{activeContent.summary}</p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm sm:min-w-72">
              <p className="text-sm text-white/75">Signed in as</p>
              <div>
                <p className="text-xl font-semibold">{profile.name}</p>
                <p className="text-sm capitalize text-white/75">{profile.role}</p>
              </div>
              <Button className="w-full" onClick={() => void signOutUser()} variant="secondary">
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <Suspense fallback={<SectionFallback label="workspace" />}>
          {isAdmin ? <AdminClubPanel /> : isCoach ? <CoachEventPanel coachId={profile.id} /> : <ParentPortal profile={profile} />}
        </Suspense>

        <Suspense fallback={<SectionFallback label="messages" />}>
          <TeamMessagesPanel profile={profile} />
        </Suspense>
      </div>
    </main>
  )
}