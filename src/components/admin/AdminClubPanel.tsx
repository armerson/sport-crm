import { Suspense, lazy, useMemo, useState } from 'react'
import type { BillingTab } from './AdminBillingPanel.tsx'
import { Button } from '../ui/Button.tsx'
import { AdminDashboardStats } from './AdminDashboardStats.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { SuccessMessage } from '../ui/SuccessMessage.tsx'
import { TabNav } from '../ui/TabNav.tsx'
import { TextField } from '../ui/TextField.tsx'
import { useAdminClubData } from '../../hooks/useAdminClubData.ts'
import { useAuditLogs } from '../../hooks/useAuditLogs.ts'
import { useClubSettings } from '../../hooks/useClubSettings.ts'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import { useAuth } from '../../hooks/useAuth.ts'
import { formatDate, formatDateTime } from '../../utils/date.ts'
import type { ProvisionableRole } from '../../services/provisioning.ts'
import { uploadTeamPhoto, saveTeamPhotoFocus } from '../../services/adminClub.ts'
import { InviteButton } from '../shared/InviteButton.tsx'

// Heavy tab panels — only loaded when their tab is first opened
const TeamMessagesPanel = lazy(async () => {
  const module = await import('../messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

const AdminBillingPanel = lazy(async () => {
  const module = await import('./AdminBillingPanel.tsx')
  return { default: module.AdminBillingPanel }
})

const PostsManageSection = lazy(async () => {
  const module = await import('./PostsManageSection.tsx')
  return { default: module.PostsManageSection }
})

const FormsManageSection = lazy(async () => {
  const module = await import('./FormsManageSection.tsx')
  return { default: module.FormsManageSection }
})

const PlayerProfileCard = lazy(async () => {
  const module = await import('../players/PlayerProfileCard.tsx')
  return { default: module.PlayerProfileCard }
})

const BulkImportPanel = lazy(async () => {
  const module = await import('./BulkImportPanel.tsx')
  return { default: module.BulkImportPanel }
})

const ClubTreeView = lazy(async () => {
  const module = await import('./ClubTreeView.tsx')
  return { default: module.ClubTreeView }
})

const AdminMembersPanel = lazy(async () => {
  const module = await import('./AdminMembersPanel.tsx')
  return { default: module.AdminMembersPanel }
})

const GroupsManageSection = lazy(async () => {
  const module = await import('./GroupsManageSection.tsx')
  return { default: module.GroupsManageSection }
})

const PlayerRegistrationSection = lazy(async () => {
  const module = await import('./PlayerRegistrationSection.tsx')
  return { default: module.PlayerRegistrationSection }
})

export type AdminTab = 'overview' | 'manage' | 'members' | 'activity' | 'messages' | 'billing' | 'forms' | 'registration' | 'posts'
type ManageSection = 'import' | 'team' | 'player' | 'coach' | 'parent' | 'staff' | 'groups'

const ADMIN_TABS = [
  { label: 'Overview', value: 'overview' as AdminTab },
  { label: 'Manage', value: 'manage' as AdminTab },
  { label: 'Members', value: 'members' as AdminTab },
  { label: 'Posts', value: 'posts' as AdminTab },
  { label: 'Forms', value: 'forms' as AdminTab },
  { label: 'Player reg', value: 'registration' as AdminTab },
  { label: 'Billing', value: 'billing' as AdminTab },
  { label: 'Activity', value: 'activity' as AdminTab },
  { label: 'Messages', value: 'messages' as AdminTab },
] as const

const MANAGE_SECTIONS = [
  { label: 'Bulk import', value: 'import' as ManageSection },
  { label: 'Create team', value: 'team' as ManageSection },
  { label: 'Add player', value: 'player' as ManageSection },
  { label: 'Assign coach', value: 'coach' as ManageSection },
  { label: 'Link parent', value: 'parent' as ManageSection },
  { label: 'Staff account', value: 'staff' as ManageSection },
  { label: 'Groups', value: 'groups' as ManageSection },
] as const

function SectionFallback() {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
      Loading messages...
    </div>
  )
}

interface AdminClubPanelProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

export function AdminClubPanel({ activeTab, onTabChange }: AdminClubPanelProps) {
  const setActiveTab = onTabChange
  const [billingTab, setBillingTab] = useState<BillingTab>('products')
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null)
  const { profile } = useAuth()
  const {
    addPlayer, approvePendingPlayer, assignCoach, coaches, createGroup, createTeam, deleteGroup, deleteTeam,
    error, events, groups, isConfigured, isSubmitting, loading, linkParent, movePlayer, parents,
    pendingRegistrations, provisionUser, rejectPendingRegistration, removePlayer, teams,
    unlinkParent, updateGroup, updateTeam,
  } = useAdminClubData()

  const { logs: auditLogs, loading: loadingAuditLogs, error: auditLogError } = useAuditLogs()
  const [manageSection, setManageSection] = useState<ManageSection>('import')
  const [showAllPlayers, setShowAllPlayers] = useState(false)

  const [teamValues, setTeamValues] = useState({ name: '', ageGroup: '', isSenior: false })
  const [pendingTeamPick, setPendingTeamPick] = useState<Record<string, string>>({})
  const [playerValues, setPlayerValues] = useState({ name: '', dob: '', teamId: '' })
  const [assignmentValues, setAssignmentValues] = useState({ teamId: '', coachId: '' })
  const [linkValues, setLinkValues] = useState({ teamId: '', playerId: '', parentId: '' })
  const [provisionValues, setProvisionValues] = useState({ name: '', email: '', roles: ['coach'] as ProvisionableRole[] })
  const [provisionResult, setProvisionResult] = useState<{ email: string; roles: ProvisionableRole[]; passwordSetupLink: string; inviteEmailSent: boolean } | null>(null)

  const [parentSearch, setParentSearch] = useState('')
  const [activeTeamId, setActiveTeamId] = useState('')
  const [movingPlayerId, setMovingPlayerId] = useState<string | null>(null)
  const [moveDestination, setMoveDestination] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  /** Admins-only accounts are not in `coaches` until they have coach role or a team link — still allow self-assign. */
  const assignableCoaches = useMemo(() => {
    if (!profile?.roles.includes('admin')) return coaches
    if (coaches.some((c) => c.id === profile.id)) return coaches
    return [...coaches, profile]
  }, [coaches, profile])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editTeamValues, setEditTeamValues] = useState({ name: '', ageGroup: '', isSenior: false })
  const [uploadingPhotoForTeam, setUploadingPhotoForTeam] = useState<string | null>(null)
  const [repositioningTeamId, setRepositioningTeamId] = useState<string | null>(null)
  const [draftFocus, setDraftFocus] = useState<{ x: number; y: number }>({ x: 50, y: 50 })
  const [savingFocus, setSavingFocus] = useState(false)
  // Optimistic overrides so changes show instantly without waiting for subscription round-trip
  const [photoFocusOverrides, setPhotoFocusOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const [photoUrlOverrides, setPhotoUrlOverrides] = useState<Record<string, string>>({})

  const isSingleTeamClub = teams.length === 1

  // Club branding
  const { settings: clubSettings, saving: savingBranding, save: saveBranding } = useClubSettings()
  const [brandingName, setBrandingName] = useState('')
  const [brandingColor, setBrandingColor] = useState('')
  const [brandingLogoFile, setBrandingLogoFile] = useState<File | null>(null)
  const [brandingSuccess, setBrandingSuccess] = useState(false)

  // Onboarding checklist
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('admin-onboarding-dismissed') === '1',
  )
  function dismissOnboarding() {
    localStorage.setItem('admin-onboarding-dismissed', '1')
    setOnboardingDismissed(true)
  }
  const onboardingSteps = [
    { label: 'Create your first team', done: teams.length > 0, tab: 'manage' as AdminTab },
    { label: 'Assign a coach to a team', done: coaches.length > 0, tab: 'manage' as AdminTab },
    { label: 'Invite a parent', done: parents.length > 0, tab: 'manage' as AdminTab },
    { label: 'Create an event', done: events.length > 0, tab: 'manage' as AdminTab },
  ]
  const onboardingComplete = onboardingSteps.every((s) => s.done)
  const showOnboarding = !loading && !onboardingDismissed && !onboardingComplete

  // Needs-attention items
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
  const eventsToday = events.filter((e) => {
    const d = new Date(e.dateTime)
    return d >= todayStart && d <= todayEnd
  })
  const resolvedPlayerTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : playerValues.teamId
  const resolvedAssignmentTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : assignmentValues.teamId
  const resolvedLinkTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : linkValues.teamId
  const resolvedActiveTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : activeTeamId

  const { players, loading: loadingPlayers } = useTeamPlayers(resolvedActiveTeamId)
  const { players: linkablePlayers, loading: loadingLinkablePlayers } = useTeamPlayers(resolvedLinkTeamId)

  const activeError = localError ?? error
  const teamCards = useMemo(() => teams.map((t) => ({
    ...t,
    photoUrl: photoUrlOverrides[t.id] ?? t.photoUrl,
    photoFocusX: photoFocusOverrides[t.id]?.x ?? t.photoFocusX,
    photoFocusY: photoFocusOverrides[t.id]?.y ?? t.photoFocusY,
  })), [teams, photoUrlOverrides, photoFocusOverrides])
  const PLAYER_PAGE = 8

  const filteredParents = useMemo(() => {
    const normalizedSearch = parentSearch.trim().toLowerCase()
    if (!normalizedSearch) return parents.slice(0, 100)
    return parents.filter((parent) => `${parent.name} ${parent.email}`.toLowerCase().includes(normalizedSearch))
  }, [parentSearch, parents])

  const parentById = useMemo(() => new Map(parents.map((parent) => [parent.id, parent])), [parents])

  const displayedPlayers = showAllPlayers ? players : players.slice(0, PLAYER_PAGE)

  function showSuccess(message: string) {
    setSuccessMessage(null)
    setTimeout(() => setSuccessMessage(message), 10)
  }

  async function handleTeamSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)
    if (!teamValues.name.trim() || !teamValues.ageGroup.trim()) {
      setLocalError('Team name and age group are required.')
      return
    }
    try {
      await createTeam({
        name: teamValues.name.trim(),
        ageGroup: teamValues.ageGroup.trim(),
        isSenior: teamValues.isSenior,
      })
      setTeamValues({ name: '', ageGroup: '', isSenior: false })
      showSuccess('Team saved successfully.')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  async function handleTeamEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingTeamId) return
    setLocalError(null)
    if (!editTeamValues.name.trim() || !editTeamValues.ageGroup.trim()) {
      setLocalError('Team name and age group are required.')
      return
    }
    try {
      await updateTeam(editingTeamId, {
        name: editTeamValues.name.trim(),
        ageGroup: editTeamValues.ageGroup.trim(),
        isSenior: editTeamValues.isSenior,
      })
      setEditingTeamId(null)
      showSuccess('Team updated.')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  async function handlePlayerSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)
    if (!playerValues.name.trim() || !playerValues.dob || !resolvedPlayerTeamId) {
      setLocalError('Player name, date of birth, and team are required.')
      return
    }
    try {
      await addPlayer({ name: playerValues.name.trim(), dob: playerValues.dob, teamId: resolvedPlayerTeamId })
      setPlayerValues({ name: '', dob: '', teamId: '' })
      showSuccess('Player added to squad.')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  async function handleCoachAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)
    if (!resolvedAssignmentTeamId || !assignmentValues.coachId) {
      setLocalError('Select both a team and a coach before assigning.')
      return
    }
    try {
      await assignCoach(resolvedAssignmentTeamId, assignmentValues.coachId)
      setAssignmentValues((current) => ({ ...current, coachId: '' }))
      showSuccess('Coach assigned to team.')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  async function handleParentLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)
    if (!resolvedLinkTeamId || !linkValues.playerId || !linkValues.parentId) {
      setLocalError('Select a team, player, and parent before linking.')
      return
    }
    const selectedPlayer = linkablePlayers.find((player) => player.id === linkValues.playerId)
    if (selectedPlayer?.parentIds.includes(linkValues.parentId)) {
      setLocalError('That parent is already linked to the selected player.')
      return
    }
    try {
      await linkParent(linkValues.playerId, linkValues.parentId)
      setLinkValues((current) => ({ ...current, playerId: '', parentId: '' }))
      showSuccess('Parent linked to player.')
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  async function handleProvisionUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)
    setProvisionResult(null)
    if (provisionValues.name.trim().length < 2 || !provisionValues.email.trim()) {
      setLocalError('Name and email are required to provision an account.')
      return
    }
    if (provisionValues.roles.length === 0) {
      setLocalError('Select at least one role before provisioning.')
      return
    }
    try {
      const result = await provisionUser(provisionValues.name.trim(), provisionValues.email.trim(), provisionValues.roles)
      setProvisionResult({ email: result.email, roles: result.roles, passwordSetupLink: result.passwordSetupLink, inviteEmailSent: result.inviteEmailSent })
      setProvisionValues({ name: '', email: '', roles: ['coach'] })
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  async function handleParentUnlink(playerId: string, parentId: string) {
    setLocalError(null)
    try {
      await unlinkParent(playerId, parentId)
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  function getCoachName(coachId: string) {
    return coaches.find((coach) => coach.id === coachId)?.name ?? 'Unknown coach'
  }

  function formatAuditTimestamp(timestamp: string) {
    if (!timestamp) return 'Unknown time'
    const parsedDate = new Date(timestamp)
    if (Number.isNaN(parsedDate.getTime())) return 'Unknown time'
    return parsedDate.toLocaleString()
  }

  return (
    <section className="space-y-5">
      <div className="hidden sm:block">
        <TabNav tabs={ADMIN_TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {!isConfigured ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured. Add your project values to .env.local before using club management.
        </div>
      ) : null}

      {activeError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{activeError}</div>
      ) : null}

      <SuccessMessage message={successMessage} />

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{isSingleTeamClub ? 'Squad overview' : 'Club overview'}</h2>
            </div>
          </div>

          {/* ── Onboarding checklist ── */}
          {showOnboarding ? (
            <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-emerald-900">🚀 Getting started</p>
                  <p className="mt-0.5 text-xs text-emerald-700">Complete these steps to get your club up and running.</p>
                </div>
                <button
                  type="button"
                  onClick={dismissOnboarding}
                  className="shrink-0 rounded-full p-1 text-emerald-500 transition hover:bg-emerald-100 hover:text-emerald-800"
                  aria-label="Dismiss checklist"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <ul className="mt-4 space-y-2">
                {onboardingSteps.map((step) => (
                  <li key={step.label}>
                    <button
                      type="button"
                      onClick={() => !step.done && setActiveTab(step.tab)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        step.done
                          ? 'cursor-default text-emerald-700'
                          : 'text-emerald-900 hover:bg-emerald-100 active:scale-[0.99]'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                          step.done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-emerald-400 text-emerald-400'
                        }`}
                      >
                        {step.done ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : null}
                      </span>
                      <span className={step.done ? 'line-through opacity-60' : ''}>{step.label}</span>
                      {!step.done ? (
                        <svg className="ml-auto shrink-0 text-emerald-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ── Needs attention ── */}
          {(pendingRegistrations.length > 0 || eventsToday.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Needs attention</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pendingRegistrations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('manage')}
                    className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100 active:scale-[0.98]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-base font-bold text-white">
                      {pendingRegistrations.length}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-amber-900">Pending registrations</p>
                      <p className="text-xs text-amber-700">Tap to assign to teams →</p>
                    </div>
                  </button>
                )}
                {eventsToday.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-blue-900">Today: {event.title}</p>
                      <p className="text-xs text-blue-700">
                        {new Date(event.dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Club branding ── */}
          <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-slate-900">Club branding</h3>
            <p className="mt-1 text-sm text-slate-500">Your club name, badge, and colour appear in the app header for all users.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* Club name */}
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="branding-name">Club name</label>
                <input
                  id="branding-name"
                  type="text"
                  defaultValue={clubSettings.name}
                  onChange={(e) => setBrandingName(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#f18a3f] focus:ring-4 focus:ring-[#f18a3f]/15"
                  placeholder="My Club FC"
                />
              </div>
              {/* Primary colour */}
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="branding-color">Primary colour</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    id="branding-color"
                    type="color"
                    defaultValue={clubSettings.primaryColor}
                    onChange={(e) => setBrandingColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                  />
                  <span className="text-sm text-slate-500">
                    {brandingColor || clubSettings.primaryColor}
                  </span>
                </div>
              </div>
              {/* Logo upload */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Club badge / logo</label>
                <div className="mt-1.5 flex items-center gap-4">
                  {(clubSettings.logoUrl) ? (
                    <img src={clubSettings.logoUrl} alt="Club badge" className="h-14 w-14 rounded-xl object-cover ring-2 ring-slate-200" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-2xl">🏆</div>
                  )}
                  <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                    {brandingLogoFile ? brandingLogoFile.name : 'Choose image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => setBrandingLogoFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
            </div>
            {brandingSuccess ? (
              <p className="mt-3 text-sm font-semibold text-emerald-600">✓ Branding saved!</p>
            ) : null}
            <Button
              className="mt-4"
              loading={savingBranding}
              onClick={async () => {
                setBrandingSuccess(false)
                await saveBranding(
                  {
                    name: brandingName || clubSettings.name,
                    primaryColor: brandingColor || clubSettings.primaryColor,
                  },
                  brandingLogoFile ?? undefined,
                )
                setBrandingLogoFile(null)
                setBrandingSuccess(true)
                setTimeout(() => setBrandingSuccess(false), 3000)
              }}
            >
              Save branding
            </Button>
          </article>

          <AdminDashboardStats teams={teams} events={events} coaches={coaches} parents={parents} />

          {pendingRegistrations.length > 0 ? (
            <article className="rounded-[1.75rem] border border-amber-200 bg-amber-50/80 p-5 shadow-lg shadow-slate-900/5">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">Pending registrations</h3>
                <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingRegistrations.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Parents and senior players who signed up online. Assign each to a team to activate their account.
              </p>
              <div className="mt-4 space-y-3">
                {pendingRegistrations.map((reg) => {
                  const isSeniorReg = reg.parentIds.length === 0
                  const teamOptions = teams.filter((t) => (isSeniorReg ? t.isSenior : true))
                  return (
                    <div key={reg.playerId} className="rounded-2xl border border-amber-200/80 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{reg.name}</p>
                          <p className="text-xs text-slate-500">
                            {reg.dob ? formatDate(reg.dob) : 'DOB not set'} · {isSeniorReg ? 'Senior (self)' : 'Junior'}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">{reg.registeredByLabel}</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="min-w-[10rem]">
                            <SelectField
                              label="Assign to team"
                              onChange={(event) => {
                                setPendingTeamPick((p) => ({ ...p, [reg.playerId]: event.target.value }))
                              }}
                              options={[
                                { label: 'Choose team', value: '' },
                                ...teamOptions.map((team) => ({
                                  label: `${team.name} (${team.ageGroup})${team.isSenior ? ' · Senior' : ''}`,
                                  value: team.id,
                                })),
                              ]}
                              value={pendingTeamPick[reg.playerId] ?? ''}
                            />
                          </div>
                          <Button
                            disabled={!pendingTeamPick[reg.playerId]}
                            loading={isSubmitting}
                            onClick={() => {
                              const tid = pendingTeamPick[reg.playerId]
                              if (!tid) return
                              void (async () => {
                                try {
                                  await approvePendingPlayer(reg.playerId, tid)
                                  setPendingTeamPick((p) => {
                                    const next = { ...p }
                                    delete next[reg.playerId]
                                    return next
                                  })
                                  showSuccess(`${reg.name} approved onto squad.`)
                                } catch { /* hook error */ }
                              })()
                            }}
                            type="button"
                            variant="primary"
                          >
                            Approve
                          </Button>
                          <ConfirmInline
                            confirmLabel="Yes, reject"
                            label="Reject"
                            onConfirm={() => void (async () => {
                              try {
                                await rejectPendingRegistration(reg.playerId)
                                showSuccess(`Rejected ${reg.name}.`)
                              } catch { /* hook error */ }
                            })()}
                          />
                        </div>
                      </div>
                  {isSeniorReg && teamOptions.length === 0 ? (
                    <p className="mt-2 text-xs text-rose-600">
                      Create a senior team (Manage → Create team → check &quot;Senior team&quot;) before approving.
                    </p>
                  ) : null}
                    </div>
                  )
                })}
              </div>
            </article>
          ) : null}

          {teams.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 px-4 py-12 text-center">
              <p className="text-sm font-medium text-slate-600">No teams yet</p>
              <p className="mt-1 text-sm text-slate-400">Go to Manage to create your first team.</p>
              <button
                className="mt-4 text-sm font-semibold text-[#123524] underline underline-offset-2"
                onClick={() => setActiveTab('manage')}
                type="button"
              >
                Create a team
              </button>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950">{isSingleTeamClub ? 'Active squad' : 'Squad drill-down'}</h3>
                    {!isSingleTeamClub ? (
                      <p className="mt-1 text-sm text-slate-500">Select a team to inspect its roster</p>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500">{loadingPlayers ? 'Loading...' : `${players.length} players`}</p>
                </div>

                {!isSingleTeamClub ? (
                  <div className="mt-4">
                    <SelectField
                      label="Team"
                      onChange={(event) => { setActiveTeamId(event.target.value); setShowAllPlayers(false) }}
                      options={[
                        { label: 'Choose a team', value: '' },
                        ...teams.map((team) => ({ label: `${team.name} (${team.ageGroup})`, value: team.id })),
                      ]}
                      value={resolvedActiveTeamId}
                    />
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {players.length > 0 ? (
                    <>
                      {displayedPlayers.map((player) => (
                        <div key={player.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-950">{player.name}</p>
                              <p className="text-sm text-slate-500">{formatDate(player.dob)}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <button
                                className="text-xs font-semibold text-[#123524] hover:underline"
                                onClick={() => setViewingPlayerId(player.id)}
                                type="button"
                              >
                                Profile
                              </button>
                              {movingPlayerId === player.id ? null : (
                                <button
                                  className="text-xs font-medium text-slate-500 hover:text-[#123524]"
                                  onClick={() => { setMovingPlayerId(player.id); setMoveDestination('') }}
                                  type="button"
                                >
                                  Move
                                </button>
                              )}
                              <ConfirmInline
                                confirmLabel="Yes, remove"
                                label="Remove"
                                onConfirm={() => void (async () => {
                                  try { await removePlayer(player.id) } catch { /* hook exposes error */ }
                                })()}
                              />
                            </div>
                          </div>

                          {/* Inline move form */}
                          {movingPlayerId === player.id ? (
                            <div className="mt-3 flex items-center gap-2">
                              <select
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-[#f18a3f] focus:ring-2 focus:ring-[#f18a3f]/15"
                                onChange={(e) => setMoveDestination(e.target.value)}
                                value={moveDestination}
                              >
                                <option value="">Move to team…</option>
                                {teams
                                  .filter((t) => t.id !== resolvedActiveTeamId)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                              </select>
                              <button
                                className="rounded-xl bg-[#123524] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                                disabled={!moveDestination || isSubmitting}
                                onClick={() => void (async () => {
                                  if (!moveDestination) return
                                  try {
                                    await movePlayer(player.id, resolvedActiveTeamId, moveDestination)
                                    setMovingPlayerId(null)
                                    setMoveDestination('')
                                  } catch { /* hook exposes error */ }
                                })()}
                                type="button"
                              >
                                Confirm
                              </button>
                              <button
                                className="text-xs font-medium text-slate-400 hover:text-slate-600"
                                onClick={() => { setMovingPlayerId(null); setMoveDestination('') }}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {player.parentIds.length > 0 ? (
                              player.parentIds.map((parentId) => (
                                <div key={`${player.id}-${parentId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                                  <span>{parentById.get(parentId)?.name ?? 'Parent'}</span>
                                  <ConfirmInline onConfirm={() => void handleParentUnlink(player.id, parentId)} />
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">No linked parents</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {players.length > PLAYER_PAGE ? (
                        <button
                          className="w-full rounded-2xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                          onClick={() => setShowAllPlayers((prev) => !prev)}
                          type="button"
                        >
                          {showAllPlayers ? 'Show fewer players' : `Show all ${players.length} players`}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                      {resolvedActiveTeamId || isSingleTeamClub ? 'No players added yet.' : 'Select a team to inspect its players.'}
                    </div>
                  )}
                </div>
              </article>

              <div className="space-y-4">
                {teamCards.map((team) => (
                  <article key={team.id} className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
                    {/* Team photo header */}
                    <div className="relative select-none">
                      {team.photoUrl ? (
                        repositioningTeamId === team.id ? (
                          /* ── Reposition mode ── */
                          <div
                            className="relative h-44 w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
                            onPointerDown={(e) => {
                              const el = e.currentTarget
                              el.setPointerCapture(e.pointerId)
                              const rect = el.getBoundingClientRect()
                              const startClientY = e.clientY
                              const startFocusY = draftFocus.y
                              const startClientX = e.clientX
                              const startFocusX = draftFocus.x
                              const onMove = (me: PointerEvent) => {
                                const dy = ((me.clientY - startClientY) / rect.height) * 100
                                const dx = ((me.clientX - startClientX) / rect.width) * 100
                                setDraftFocus({
                                  x: Math.max(0, Math.min(100, startFocusX - dx)),
                                  y: Math.max(0, Math.min(100, startFocusY - dy)),
                                })
                              }
                              el.addEventListener('pointermove', onMove)
                              el.addEventListener('pointerup', () => el.removeEventListener('pointermove', onMove), { once: true })
                            }}
                          >
                            <img
                              src={team.photoUrl}
                              alt={`${team.name} photo`}
                              className="h-full w-full object-cover"
                              style={{ objectPosition: `${draftFocus.x}% ${draftFocus.y}%` }}
                              draggable={false}
                            />
                            {/* crosshair indicator */}
                            <div
                              className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                              style={{ left: `${draftFocus.x}%`, top: `${draftFocus.y}%`, boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }}
                            />
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent py-3 text-center text-xs font-semibold text-white">
                              Drag to reposition
                            </div>
                          </div>
                        ) : (
                          <img
                            src={team.photoUrl}
                            alt={`${team.name} photo`}
                            className="h-36 w-full object-cover"
                            style={{ objectPosition: `${team.photoFocusX}% ${team.photoFocusY}%` }}
                          />
                        )
                      ) : (
                        <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                      )}

                      {/* Photo action buttons */}
                      {repositioningTeamId === team.id ? (
                        <div className="absolute bottom-2 right-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setRepositioningTeamId(null) }}
                            className="rounded-xl bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow hover:bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingFocus}
                            onClick={async () => {
                              // Optimistic update — apply immediately so UI reflects change without waiting for subscription
                              setPhotoFocusOverrides((prev) => ({ ...prev, [team.id]: draftFocus }))
                              setRepositioningTeamId(null)
                              setSavingFocus(true)
                              try {
                                await saveTeamPhotoFocus(team.id, draftFocus.x, draftFocus.y)
                              } catch {
                                // Revert on failure
                                setPhotoFocusOverrides((prev) => { const next = { ...prev }; delete next[team.id]; return next })
                                showSuccess('Failed to save position.')
                              } finally {
                                setSavingFocus(false)
                              }
                            }}
                            className="rounded-xl bg-[#123524] px-3 py-1 text-xs font-semibold text-white shadow disabled:opacity-50"
                          >
                            {savingFocus ? 'Saving…' : 'Done'}
                          </button>
                        </div>
                      ) : (
                        <div className="absolute bottom-2 right-2 flex gap-2">
                          {team.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDraftFocus({ x: team.photoFocusX, y: team.photoFocusY })
                                setRepositioningTeamId(team.id)
                              }}
                              className="flex items-center gap-1.5 rounded-xl bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow hover:bg-white"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                              Reposition
                            </button>
                          ) : null}
                          <label className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold shadow transition ${uploadingPhotoForTeam === team.id ? 'bg-white/60 text-slate-400' : 'bg-white/90 text-slate-700 hover:bg-white'}`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            {uploadingPhotoForTeam === team.id ? 'Uploading…' : team.photoUrl ? 'Change' : 'Add photo'}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              disabled={uploadingPhotoForTeam === team.id}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                // Optimistic preview using local object URL
                                const previewUrl = URL.createObjectURL(file)
                                setPhotoUrlOverrides((prev) => ({ ...prev, [team.id]: previewUrl }))
                                setUploadingPhotoForTeam(team.id)
                                try {
                                  const url = await uploadTeamPhoto(team.id, file)
                                  // Replace preview with real CDN URL immediately
                                  setPhotoUrlOverrides((prev) => ({ ...prev, [team.id]: url }))
                                  showSuccess(`Photo updated for ${team.name}.`)
                                } catch {
                                  // Revert preview on failure
                                  setPhotoUrlOverrides((prev) => { const next = { ...prev }; delete next[team.id]; return next })
                                  showSuccess('Photo upload failed.')
                                } finally {
                                  setUploadingPhotoForTeam(null)
                                  e.target.value = ''
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                    {editingTeamId === team.id ? (
                      <form onSubmit={handleTeamEditSubmit} className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Edit team</p>
                        <TextField
                          label="Team name"
                          onChange={(e) => setEditTeamValues((v) => ({ ...v, name: e.target.value }))}
                          value={editTeamValues.name}
                        />
                        <TextField
                          label="Age group"
                          onChange={(e) => setEditTeamValues((v) => ({ ...v, ageGroup: e.target.value }))}
                          value={editTeamValues.ageGroup}
                        />
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input
                            checked={editTeamValues.isSenior}
                            className="rounded border-slate-300"
                            onChange={(e) => setEditTeamValues((v) => ({ ...v, isSenior: e.target.checked }))}
                            type="checkbox"
                          />
                          Senior team (18+)
                        </label>
                        <div className="flex gap-2">
                          <Button loading={isSubmitting} type="submit" variant="primary">Save</Button>
                          <button
                            className="text-sm font-medium text-slate-400 hover:text-slate-600"
                            onClick={() => setEditingTeamId(null)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold text-slate-950">{team.name}</h3>
                            <p className="text-sm text-slate-500">{team.ageGroup}{team.isSenior ? ' · Senior' : ''}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                              <span className="rounded-full bg-slate-100 px-3 py-1">{team.playerCount} players</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1">{team.coachCount} coaches</span>
                            </div>
                            <button
                              className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                              onClick={() => {
                                setEditTeamValues({ name: team.name, ageGroup: team.ageGroup, isSenior: team.isSenior })
                                setEditingTeamId(team.id)
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <ConfirmInline
                              confirmLabel="Yes, delete"
                              label="Delete"
                              onConfirm={() => void (async () => {
                                try {
                                  await deleteTeam(team.id)
                                  showSuccess(`${team.name} deleted.`)
                                } catch { /* hook exposes error */ }
                              })()}
                            />
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm font-medium text-slate-500">Coaches</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {team.coaches.length > 0 ? (
                              team.coaches.map((coachId) => (
                                <span key={coachId} className="rounded-full bg-[#123524] px-3 py-1 text-xs font-semibold text-white">
                                  {getCoachName(coachId)}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-slate-400">No coaches assigned</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <InviteButton teamId={team.id} teamName={team.name} role="parent" />
                          <InviteButton teamId={team.id} teamName={team.name} role="coach" />
                        </div>
                      </>
                    )}
                    </div>{/* end p-5 */}
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Club structure tree */}
          {(groups.length > 0 || teams.length > 0) ? (
            <Suspense fallback={<SectionFallback />}>
              <ClubTreeView groups={groups} teams={teams} />
            </Suspense>
          ) : null}

          {/* Upcoming events across all teams */}
          {teams.length > 0 ? (() => {
            const now = new Date()
            const teamById = new Map(teams.map((t) => [t.id, t]))
            const upcoming = events.filter((e) => new Date(e.dateTime) >= now).slice(0, 20)
            const past = events.filter((e) => new Date(e.dateTime) < now).slice(-5).reverse()

            return (
              <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-slate-950">Club schedule</h3>
                  <p className="text-sm text-slate-500">{loading ? 'Loading...' : `${upcoming.length} upcoming`}</p>
                </div>

                {upcoming.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {upcoming.map((event) => {
                      const team = teamById.get(event.teamId)
                      return (
                        <div key={event.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-slate-950">{event.title}</p>
                              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                                {event.type}
                              </span>
                              {event.recurrenceGroupId ? (
                                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">Recurring</span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-sm text-slate-500">
                              {team?.name ?? 'Unknown team'}{team?.ageGroup ? ` · ${team.ageGroup}` : ''} · {formatDateTime(event.dateTime)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    No upcoming events scheduled.
                  </div>
                )}

                {past.length > 0 ? (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Recent past</p>
                    <div className="space-y-2">
                      {past.map((event) => {
                        const team = teamById.get(event.teamId)
                        return (
                          <div key={event.id} className="flex items-center gap-3 rounded-2xl bg-slate-50/60 px-4 py-2.5 opacity-60">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-700">{event.title}</p>
                              <p className="text-xs text-slate-500">
                                {team?.name ?? 'Unknown team'} · {formatDateTime(event.dateTime)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })() : null}
        </section>
      ) : null}

      {/* MANAGE TAB */}
      {activeTab === 'manage' ? (
        <section className="space-y-5">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-1 rounded-2xl bg-slate-100/90 p-1">
              {MANAGE_SECTIONS.map((section) => (
                <button
                  key={section.value}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                    manageSection === section.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => { setManageSection(section.value); setLocalError(null); setSuccessMessage(null) }}
                  type="button"
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
            {manageSection === 'import' ? (
              <Suspense fallback={<SectionFallback />}>
                <BulkImportPanel />
              </Suspense>
            ) : null}

            {manageSection === 'groups' ? (
              <Suspense fallback={<SectionFallback />}>
                <GroupsManageSection
                  groups={groups}
                  teams={teams}
                  isSubmitting={isSubmitting}
                  onCreate={async (input, teamIds) => {
                    try {
                      await createGroup(input, teamIds)
                      showSuccess('Group created.')
                    } catch { /* hook exposes error */ }
                  }}
                  onUpdate={async (id, input, teamIds) => {
                    try {
                      await updateGroup(id, input, teamIds)
                      showSuccess('Group updated.')
                    } catch { /* hook exposes error */ }
                  }}
                  onDelete={async (id) => {
                    try {
                      await deleteGroup(id)
                      showSuccess('Group deleted.')
                    } catch { /* hook exposes error */ }
                  }}
                />
              </Suspense>
            ) : null}

            {manageSection === 'team' ? (
              <>
                <h2 className="text-xl font-semibold text-slate-950">Create team</h2>
                <p className="mt-1 text-sm text-slate-500">Add a new team to the club with a name and age group.</p>
                <form className="mt-5 space-y-4" onSubmit={handleTeamSubmit}>
                  <TextField
                    label="Team name"
                    onChange={(event) => setTeamValues((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Falcons"
                    value={teamValues.name}
                  />
                  <TextField
                    label="Age group"
                    onChange={(event) => setTeamValues((current) => ({ ...current, ageGroup: event.target.value }))}
                    placeholder="U12 or Senior"
                    value={teamValues.ageGroup}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      checked={teamValues.isSenior}
                      className="rounded border-slate-300"
                      onChange={(e) => setTeamValues((c) => ({ ...c, isSenior: e.target.checked }))}
                      type="checkbox"
                    />
                    Senior team (18+) — players can register themselves
                  </label>
                  <Button className="w-full" loading={isSubmitting} type="submit">
                    Save team
                  </Button>
                </form>
              </>
            ) : null}

            {manageSection === 'player' ? (
              <>
                <h2 className="text-xl font-semibold text-slate-950">{isSingleTeamClub ? 'Add player to squad' : 'Add player'}</h2>
                <p className="mt-1 text-sm text-slate-500">Register a player and assign them to a team.</p>
                <form className="mt-5 space-y-4" onSubmit={handlePlayerSubmit}>
                  <TextField
                    label="Player name"
                    onChange={(event) => setPlayerValues((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Sam Kerr"
                    value={playerValues.name}
                  />
                  <TextField
                    label="Date of birth"
                    onChange={(event) => setPlayerValues((current) => ({ ...current, dob: event.target.value }))}
                    type="date"
                    value={playerValues.dob}
                  />
                  {!isSingleTeamClub ? (
                    <SelectField
                      label="Team"
                      onChange={(event) => setPlayerValues((current) => ({ ...current, teamId: event.target.value }))}
                      options={[
                        { label: teams.length > 0 ? 'Choose a team' : 'Create a team first', value: '' },
                        ...teams.map((team) => ({ label: `${team.name} (${team.ageGroup})`, value: team.id })),
                      ]}
                      value={playerValues.teamId}
                    />
                  ) : null}
                  <Button className="w-full" loading={isSubmitting} type="submit">
                    Add player
                  </Button>
                </form>
              </>
            ) : null}

            {manageSection === 'coach' ? (
              <>
                <h2 className="text-xl font-semibold text-slate-950">Assign coach to team</h2>
                <p className="mt-1 text-sm text-slate-500">Connect a coach account to a team so they can manage events and attendance.</p>
                <form className="mt-5 space-y-4" onSubmit={handleCoachAssignment}>
                  {!isSingleTeamClub ? (
                    <SelectField
                      label="Team"
                      onChange={(event) => setAssignmentValues((current) => ({ ...current, teamId: event.target.value }))}
                      options={[
                        { label: teams.length > 0 ? 'Choose a team' : 'Create a team first', value: '' },
                        ...teams.map((team) => ({ label: `${team.name} (${team.ageGroup})`, value: team.id })),
                      ]}
                      value={assignmentValues.teamId}
                    />
                  ) : null}
                  <SelectField
                    label="Coach"
                    onChange={(event) => setAssignmentValues((current) => ({ ...current, coachId: event.target.value }))}
                    options={[
                      {
                        label:
                          assignableCoaches.length > 0 ? 'Choose a coach' : 'No coach accounts found — add staff or use Members',
                        value: '',
                      },
                      ...assignableCoaches.map((coach) => ({ label: coach.name, value: coach.id })),
                    ]}
                    value={assignmentValues.coachId}
                  />
                  <Button className="w-full" loading={isSubmitting} type="submit">
                    Assign coach
                  </Button>
                </form>
              </>
            ) : null}

            {manageSection === 'parent' ? (
              <>
                <h2 className="text-xl font-semibold text-slate-950">Link parent to player</h2>
                <p className="mt-1 text-sm text-slate-500">Associate a parent's account with a player so they can see events and respond to attendance.</p>
                <form className="mt-5 space-y-4" onSubmit={handleParentLink}>
                  {!isSingleTeamClub ? (
                    <SelectField
                      label="Team"
                      onChange={(event) => setLinkValues((current) => ({ ...current, teamId: event.target.value, playerId: '' }))}
                      options={[
                        { label: teams.length > 0 ? 'Choose a team' : 'Create a team first', value: '' },
                        ...teams.map((team) => ({ label: `${team.name} (${team.ageGroup})`, value: team.id })),
                      ]}
                      value={linkValues.teamId}
                    />
                  ) : null}
                  <SelectField
                    label="Player"
                    onChange={(event) => setLinkValues((current) => ({ ...current, playerId: event.target.value }))}
                    options={[
                      {
                        label: resolvedLinkTeamId
                          ? loadingLinkablePlayers ? 'Loading players...' : linkablePlayers.length > 0 ? 'Choose a player' : 'No players in this team'
                          : 'Choose a team first',
                        value: '',
                      },
                      ...linkablePlayers.map((player) => ({ label: player.name, value: player.id })),
                    ]}
                    value={linkValues.playerId}
                  />
                  <TextField
                    label="Find parent"
                    onChange={(event) => setParentSearch(event.target.value)}
                    placeholder="Search by name or email"
                    value={parentSearch}
                  />
                  <SelectField
                    label="Parent account"
                    onChange={(event) => setLinkValues((current) => ({ ...current, parentId: event.target.value }))}
                    options={[
                      {
                        label: parents.length > 0
                          ? filteredParents.length > 0 ? 'Choose a parent' : 'No parents match your search'
                          : 'No parent accounts found',
                        value: '',
                      },
                      ...filteredParents.slice(0, 100).map((parent) => ({ label: `${parent.name} (${parent.email})`, value: parent.id })),
                    ]}
                    value={linkValues.parentId}
                  />
                  <Button className="w-full" loading={isSubmitting} type="submit">
                    Link parent to player
                  </Button>
                </form>
              </>
            ) : null}

            {manageSection === 'staff' ? (
              <>
                <h2 className="text-xl font-semibold text-slate-950">Create staff account</h2>
                <p className="mt-1 text-sm text-slate-500">Provision a coach or admin account. An invite email will be sent so they can set their password.</p>
                <form className="mt-5 space-y-4" onSubmit={handleProvisionUser}>
                  <TextField
                    label="Full name"
                    onChange={(event) => setProvisionValues((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Jordan Lee"
                    value={provisionValues.name}
                  />
                  <TextField
                    label="Email"
                    onChange={(event) => setProvisionValues((current) => ({ ...current, email: event.target.value }))}
                    placeholder="jordan@club.com"
                    type="email"
                    value={provisionValues.email}
                  />
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium text-slate-700">Roles</legend>
                    <div className="space-y-2">
                      {(['coach', 'admin'] as ProvisionableRole[]).map((role) => (
                        <label key={role} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 hover:bg-slate-100">
                          <input
                            checked={provisionValues.roles.includes(role)}
                            className="h-4 w-4 accent-[#123524]"
                            onChange={(event) => {
                              setProvisionValues((current) => ({
                                ...current,
                                roles: event.target.checked
                                  ? [...current.roles, role]
                                  : current.roles.filter((r) => r !== role),
                              }))
                            }}
                            type="checkbox"
                          />
                          <span className="text-sm font-medium capitalize text-slate-800">{role}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Button className="w-full" loading={isSubmitting} type="submit">
                    Provision account
                  </Button>
                </form>

                {provisionResult ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                    <p className="font-semibold capitalize">{provisionResult.roles.join(' + ')} account created</p>
                    <p className="mt-1 break-all text-emerald-700">{provisionResult.email}</p>
                    <p className="mt-3">
                      {provisionResult.inviteEmailSent
                        ? 'Invite email sent. Keep the setup link below as a backup.'
                        : 'Invite email was not sent. Share the password setup link manually.'}
                    </p>
                    <p className="mt-2 font-medium">Password setup link:</p>
                    <a className="mt-1 block break-all underline" href={provisionResult.passwordSetupLink} rel="noreferrer" target="_blank">
                      {provisionResult.passwordSetupLink}
                    </a>
                  </div>
                ) : null}
              </>
            ) : null}
          </article>
        </section>
      ) : null}

      {/* ACTIVITY TAB */}
      {activeTab === 'activity' ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Admin activity</h2>
              <p className="mt-1 text-sm text-slate-500">
                {loadingAuditLogs ? 'Loading activity...' : `${auditLogs.length} recent entries`}
              </p>
            </div>
          </div>

          {auditLogError ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{auditLogError}</div>
          ) : null}

          {auditLogs.length === 0 && !loadingAuditLogs ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 px-4 py-12 text-center">
              <p className="text-sm text-slate-500">No admin activity recorded yet.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {auditLogs.map((log) => (
                <article key={log.id} className="rounded-[1.5rem] border border-white/70 bg-white/85 px-5 py-4 shadow-sm shadow-slate-900/5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-950">{log.summary}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                        {log.action.replaceAll('_', ' ')} · {log.targetType}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm text-slate-500">{formatAuditTimestamp(log.timestamp)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">By {log.actorName}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* BILLING TAB */}
      {activeTab === 'billing' ? (
        <Suspense fallback={<SectionFallback />}>
          <AdminBillingPanel
            activeTab={billingTab}
            onTabChange={setBillingTab}
          />
        </Suspense>
      ) : null}

      {/* MEMBERS TAB */}
      {activeTab === 'members' ? (
        <Suspense fallback={<SectionFallback />}>
          <AdminMembersPanel teams={teams} />
        </Suspense>
      ) : null}

      {/* POSTS TAB */}
      {activeTab === 'posts' && profile ? (
        <Suspense fallback={<SectionFallback />}>
          <PostsManageSection profile={profile} teams={teams} />
        </Suspense>
      ) : null}

      {/* FORMS TAB */}
      {activeTab === 'forms' && profile ? (
        <Suspense fallback={<SectionFallback />}>
          <FormsManageSection profile={profile} teams={teams} />
        </Suspense>
      ) : null}

      {activeTab === 'registration' ? (
        <Suspense fallback={<SectionFallback />}>
          <PlayerRegistrationSection />
        </Suspense>
      ) : null}

      {/* MESSAGES TAB */}
      {activeTab === 'messages' && profile ? (
        <Suspense fallback={<SectionFallback />}>
          <TeamMessagesPanel profile={profile} />
        </Suspense>
      ) : null}

      {/* PLAYER PROFILE DRAWER */}
      {viewingPlayerId && profile ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingPlayerId(null) }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

          {/* Drawer panel */}
          <div className="relative z-10 flex w-full max-w-2xl flex-col rounded-t-[2rem] bg-slate-50 shadow-2xl sm:max-h-[90vh] sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Player profile</h2>
              <button
                type="button"
                onClick={() => setViewingPlayerId(null)}
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <Suspense fallback={<SectionFallback />}>
                <PlayerProfileCard
                  playerId={viewingPlayerId}
                  role="admin"
                  currentUserId={profile.id}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
