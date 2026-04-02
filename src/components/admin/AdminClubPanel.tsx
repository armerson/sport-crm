import { useMemo, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import { TextField } from '../ui/TextField.tsx'
import { useAdminClubData } from '../../hooks/useAdminClubData.ts'
import { useAuditLogs } from '../../hooks/useAuditLogs.ts'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import type { ProvisionableRole } from '../../services/provisioning.ts'

export function AdminClubPanel() {
  const { addPlayer, assignCoach, coaches, error, isConfigured, isSubmitting, loading, parents, teams, createTeam, linkParent, provisionUser, unlinkParent } =
    useAdminClubData()
  const { logs: auditLogs, loading: loadingAuditLogs, error: auditLogError } = useAuditLogs()
  const [teamValues, setTeamValues] = useState({ name: '', ageGroup: '' })
  const [playerValues, setPlayerValues] = useState({ name: '', dob: '', teamId: '' })
  const [assignmentValues, setAssignmentValues] = useState({ teamId: '', coachId: '' })
  const [linkValues, setLinkValues] = useState({ teamId: '', playerId: '', parentId: '' })
  const [provisionValues, setProvisionValues] = useState({ name: '', email: '', role: 'coach' as ProvisionableRole })
  const [provisionResult, setProvisionResult] = useState<{ email: string; role: ProvisionableRole; passwordSetupLink: string; inviteEmailSent: boolean } | null>(null)
  const [parentSearch, setParentSearch] = useState('')
  const [activeTeamId, setActiveTeamId] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const isSingleTeamClub = teams.length === 1
  const resolvedPlayerTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : playerValues.teamId
  const resolvedAssignmentTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : assignmentValues.teamId
  const resolvedLinkTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : linkValues.teamId
  const resolvedActiveTeamId = isSingleTeamClub ? (teams[0]?.id ?? '') : activeTeamId
  const { players, loading: loadingPlayers } = useTeamPlayers(resolvedActiveTeamId)
  const { players: linkablePlayers, loading: loadingLinkablePlayers } = useTeamPlayers(resolvedLinkTeamId)

  const activeError = localError ?? error
  const teamCards = useMemo(() => teams, [teams])
  const filteredParents = useMemo(() => {
    const normalizedSearch = parentSearch.trim().toLowerCase()

    if (!normalizedSearch) {
      return parents.slice(0, 100)
    }

    return parents.filter((parent) => {
      const haystack = `${parent.name} ${parent.email}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [parentSearch, parents])
  const parentById = useMemo(() => new Map(parents.map((parent) => [parent.id, parent])), [parents])

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
      })
      setTeamValues({ name: '', ageGroup: '' })
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
      await addPlayer({
        name: playerValues.name.trim(),
        dob: playerValues.dob,
        teamId: resolvedPlayerTeamId,
      })
      setPlayerValues({ name: '', dob: '', teamId: '' })
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

    try {
      const result = await provisionUser(
        provisionValues.name.trim(),
        provisionValues.email.trim(),
        provisionValues.role,
      )

      setProvisionResult({
        email: result.email,
        role: result.role,
        passwordSetupLink: result.passwordSetupLink,
        inviteEmailSent: result.inviteEmailSent,
      })
      setProvisionValues({ name: '', email: '', role: 'coach' })
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
    if (!timestamp) {
      return 'Unknown time'
    }

    const parsedDate = new Date(timestamp)

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Unknown time'
    }

    return parsedDate.toLocaleString()
  }

  return (
    <section className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-500">Admin action</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">Create team</h2>
          <form className="mt-4 space-y-4" onSubmit={handleTeamSubmit}>
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
        </article>

        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-500">Admin action</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">{isSingleTeamClub ? 'Add player to your squad' : 'Add player'}</h2>
          <form className="mt-4 space-y-4" onSubmit={handlePlayerSubmit}>
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
        </article>

        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-500">Admin action</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">{isSingleTeamClub ? 'Assign a coach' : 'Assign coach'}</h2>
          <form className="mt-4 space-y-4" onSubmit={handleCoachAssignment}>
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
        </article>

        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-500">Admin action</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">Link parent</h2>
          <form className="mt-4 space-y-4" onSubmit={handleParentLink}>
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
                  label:
                    resolvedLinkTeamId
                      ? loadingLinkablePlayers
                        ? 'Loading players...'
                        : linkablePlayers.length > 0
                          ? 'Choose a player'
                          : 'No players in this team'
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
              placeholder="Search by parent name or email"
              value={parentSearch}
            />
            <SelectField
              label="Parent account"
              onChange={(event) => setLinkValues((current) => ({ ...current, parentId: event.target.value }))}
              options={[
                {
                  label:
                    parents.length > 0
                      ? filteredParents.length > 0
                        ? 'Choose a parent'
                        : 'No parents match your search'
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
        </article>

        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-500">Trusted provisioning</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">Create staff account</h2>
          <form className="mt-4 space-y-4" onSubmit={handleProvisionUser}>
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
            <SelectField
              label="Role"
              onChange={(event) =>
                setProvisionValues((current) => ({
                  ...current,
                  role: event.target.value === 'admin' ? 'admin' : 'coach',
                }))
              }
              options={[
                { label: 'Coach', value: 'coach' },
                { label: 'Admin', value: 'admin' },
              ]}
              value={provisionValues.role}
            />
            <Button className="w-full" loading={isSubmitting} type="submit">
              Provision account
            </Button>
          </form>

          {provisionResult ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">{provisionResult.role} account created</p>
              <p className="mt-1 break-all">{provisionResult.email}</p>
              <p className="mt-2">
                {provisionResult.inviteEmailSent
                  ? 'Invite email sent successfully. Keep the setup link below as a fallback.'
                  : 'Invite email was not sent. Share the password setup link manually.'}
              </p>
              <p className="mt-2">Password setup link:</p>
              <a className="mt-1 block break-all font-semibold underline" href={provisionResult.passwordSetupLink} rel="noreferrer" target="_blank">
                {provisionResult.passwordSetupLink}
              </a>
            </div>
          ) : null}
        </article>
      </section>

      {!isConfigured ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured yet. Add your project values to .env.local before using team management.
        </div>
      ) : null}

      {activeError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{activeError}</div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Live club data</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{isSingleTeamClub ? 'Squad overview' : 'Teams overview'}</h2>
          </div>
          <p className="text-sm text-slate-500">{loading ? 'Loading teams...' : `${teams.length} teams, ${coaches.length} coaches, ${parents.length} parents`}</p>
        </div>

        {teams.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No teams yet. Create your first team to start structuring the club.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Team drill-down</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">{isSingleTeamClub ? 'Active squad' : 'Select a team'}</h3>
                </div>
                <p className="text-sm text-slate-500">{loadingPlayers ? 'Loading players...' : `${players.length} loaded`}</p>
              </div>

              {!isSingleTeamClub ? (
                <div className="mt-4">
                  <SelectField
                    label="Active team"
                    onChange={(event) => setActiveTeamId(event.target.value)}
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
                  players.slice(0, 10).map((player) => (
                    <div key={player.id} className="rounded-2xl bg-white px-4 py-3">
                      <p className="font-medium text-slate-950">{player.name}</p>
                      <p className="text-sm text-slate-500">{player.dob || 'DOB not set'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {player.parentIds.length > 0 ? (
                          player.parentIds.map((parentId) => (
                            <div key={`${player.id}-${parentId}`} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              <span>{parentById.get(parentId)?.name ?? 'Parent'}</span>
                              <button
                                className="text-slate-500 transition hover:text-rose-600"
                                onClick={() => void handleParentUnlink(player.id, parentId)}
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">No linked parents yet.</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    {resolvedActiveTeamId || isSingleTeamClub ? 'No players added yet.' : 'Select a team to inspect its players.'}
                  </div>
                )}
              </div>
            </article>

            {teamCards.map((team) => {
              return (
                <article key={team.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">{team.name}</h3>
                      <p className="text-sm text-slate-500">{team.ageGroup}</p>
                    </div>
                    <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      <span className="rounded-full bg-white px-3 py-1">{team.playerCount} players</span>
                      <span className="rounded-full bg-white px-3 py-1">{team.coachCount} coaches</span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-1">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Assigned coaches</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {team.coaches.length > 0 ? (
                          team.coaches.map((coachId) => (
                            <span key={coachId} className="rounded-full bg-[#123524] px-3 py-1 text-xs font-semibold text-white">
                              {getCoachName(coachId)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">No coaches assigned yet.</span>
                        )}
                      </div>
                    </div>

                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Phase 2 operations</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Recent admin activity</h2>
          </div>
          <p className="text-sm text-slate-500">{loadingAuditLogs ? 'Loading activity...' : `${auditLogs.length} recent entries`}</p>
        </div>

        {auditLogError ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{auditLogError}</div>
        ) : null}

        {auditLogs.length === 0 && !loadingAuditLogs ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No admin activity has been recorded yet.
          </div>
        ) : null}

        {auditLogs.length > 0 ? (
          <div className="mt-6 grid gap-3">
            {auditLogs.map((log) => (
              <article key={log.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{log.summary}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                      {log.action.replaceAll('_', ' ')} • {log.targetType}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">{formatAuditTimestamp(log.timestamp)}</p>
                </div>
                <p className="mt-3 text-sm text-slate-600">Recorded by {log.actorName}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  )
}