import { Suspense, lazy, useMemo, useState } from 'react'
import { AdminBillingPanel } from './AdminBillingPanel.tsx'
import type { BillingTab } from './AdminBillingPanel.tsx'
import { PlayerProfileCard } from '../players/PlayerProfileCard.tsx'
import { Button } from '../ui/Button.tsx'
import { BulkImportPanel } from './BulkImportPanel.tsx'
import { AdminDashboardStats } from './AdminDashboardStats.tsx'
import { ClubTreeView } from './ClubTreeView.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { GroupsManageSection } from './GroupsManageSection.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { SuccessMessage } from '../ui/SuccessMessage.tsx'
import { TabNav } from '../ui/TabNav.tsx'
import { TextField } from '../ui/TextField.tsx'
import { useAdminClubData } from '../../hooks/useAdminClubData.ts'
import { useAuditLogs } from '../../hooks/useAuditLogs.ts'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import { useAuth } from '../../hooks/useAuth.ts'
import { formatDate, formatDateTime } from '../../utils/date.ts'
import type { ProvisionableRole } from '../../services/provisioning.ts'

const TeamMessagesPanel = lazy(async () => {
  const module = await import('../messages/TeamMessagesPanel.tsx')
  return { default: module.TeamMessagesPanel }
})

export type AdminTab = 'overview' | 'manage' | 'activity' | 'messages' | 'billing'
type ManageSection = 'import' | 'team' | 'player' | 'coach' | 'parent' | 'staff' | 'groups'

const ADMIN_TABS = [
  { label: 'Overview', value: 'overview' as AdminTab },
  { label: 'Manage', value: 'manage' as AdminTab },
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
    addPlayer, assignCoach, coaches, createGroup, createTeam, deleteGroup, error, events,
    groups, isConfigured, isSubmitting, loading, linkParent, movePlayer, parents, provisionUser,
    removePlayer, teams, unlinkParent, updateGroup,
  } = useAdminClubData()
  const { logs: auditLogs, loading: loadingAuditLogs, error: auditLogError } = useAuditLogs()
  const [manageSection, setManageSection] = useState<ManageSection>('import')
  const [showAllPlayers, setShowAllPlayers] = useState(false)

  const [teamValues, setTeamValues] = useState({ name: '', ageGroup: '' })
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isSingleTeamClub = teams.length === 1
  const resolvedPlayerTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : playerValues.teamId
  const resolvedAssignmentTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : assignmentValues.teamId
  const resolvedLinkTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : linkValues.teamId
  const resolvedActiveTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : activeTeamId

  const { players, loading: loadingPlayers } = useTeamPlayers(resolvedActiveTeamId)
  const { players: linkablePlayers, loading: loadingLinkablePlayers } = useTeamPlayers(resolvedLinkTeamId)

  const activeError = localError ?? error
  const teamCards = useMemo(() => teams, [teams])
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
      await createTeam({ name: teamValues.name.trim(), ageGroup: teamValues.ageGroup.trim() })
      setTeamValues({ name: '', ageGroup: '' })
      showSuccess('Team saved successfully.')
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

          <AdminDashboardStats teams={teams} events={events} coaches={coaches} parents={parents} />

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
                  <article key={team.id} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-slate-950">{team.name}</h3>
                        <p className="text-sm text-slate-500">{team.ageGroup}</p>
                      </div>
                      <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">{team.playerCount} players</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{team.coachCount} coaches</span>
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
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Club structure tree */}
          {(groups.length > 0 || teams.length > 0) ? (
            <ClubTreeView groups={groups} teams={teams} />
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
              <BulkImportPanel />
            ) : null}

            {manageSection === 'groups' ? (
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
                    placeholder="U12"
                    value={teamValues.ageGroup}
                  />
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
                      { label: coaches.length > 0 ? 'Choose a coach' : 'No coach accounts found', value: '' },
                      ...coaches.map((coach) => ({ label: coach.name, value: coach.id })),
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
        <AdminBillingPanel
          activeTab={billingTab}
          onTabChange={setBillingTab}
        />
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
              <PlayerProfileCard
                playerId={viewingPlayerId}
                role="admin"
                currentUserId={profile.id}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
