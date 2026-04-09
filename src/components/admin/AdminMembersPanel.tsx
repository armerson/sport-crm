import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TeamRecord } from '../../types/club.ts'
import type { UserRole } from '../../types/auth.ts'
import { ClubInviteButton } from '../shared/ClubInviteButton.tsx'
import {
  fetchAllProfiles, fetchDuplicatePlayers, mergePlayers,
  adminSetProfileRolesAndCoachTeams,
  type DuplicateGroup, type MemberProfile,
} from '../../services/adminMembers.ts'

// ── Helpers ───────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  admin:  'Admin',
  coach:  'Coach',
  parent: 'Parent',
  player: 'Player',
}
const ROLE_COLOUR: Record<UserRole, string> = {
  admin:  'bg-purple-100 text-purple-700',
  coach:  'bg-[#123524]/10 text-[#123524]',
  parent: 'bg-blue-100 text-blue-700',
  player: 'bg-amber-100 text-amber-700',
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#123524]/10 text-xs font-bold text-[#123524]">
      {letters}
    </div>
  )
}

function RoleChip({ role }: { role: UserRole }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLOUR[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  )
}

// ── Inline member editor ──────────────────────────────────────────

function MemberEditor({
  member,
  teams,
  onSave,
  onCancel,
}: {
  member: MemberProfile
  teams: TeamRecord[]
  onSave: (roles: UserRole[], coachTeams: string[]) => Promise<void>
  onCancel: () => void
}) {
  const [roles, setRoles] = useState<UserRole[]>(member.roles)
  const [coachTeams, setCoachTeams] = useState<string[]>(member.coachTeams)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCoach = roles.includes('coach')

  function toggleRole(role: UserRole) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  function toggleTeam(teamId: string) {
    setCoachTeams((prev) =>
      prev.includes(teamId) ? prev.filter((t) => t !== teamId) : [...prev, teamId],
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await onSave(roles, isCoach ? coachTeams : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-[#123524]/20 bg-[#123524]/5 p-4 space-y-4">
      {/* Role toggles */}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">Roles</p>
        <div className="flex flex-wrap gap-2">
          {(['admin', 'coach', 'parent', 'player'] as UserRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                roles.includes(role)
                  ? `${ROLE_COLOUR[role]} border-transparent`
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {ROLE_LABEL[role]}
            </button>
          ))}
        </div>
      </div>

      {/* Team assignment — only when coach role is toggled on */}
      {isCoach && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">Teams coached</p>
          {teams.length === 0 ? (
            <p className="text-xs text-slate-400">No teams exist yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {teams.map((team) => {
                const checked = coachTeams.includes(team.id)
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                      checked
                        ? 'border-[#123524] bg-[#123524] text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#123524]/40'
                    }`}
                  >
                    <p className="font-semibold">{team.name}</p>
                    <p className={`mt-0.5 ${checked ? 'text-white/70' : 'text-slate-400'}`}>{team.ageGroup}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-[#123524] px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 hover:bg-[#1a4a33]"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Member row ────────────────────────────────────────────────────

function MemberRow({
  member,
  teams,
  onRefetch,
}: {
  member: MemberProfile
  teams: TeamRecord[]
  onRefetch: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const coachTeamNames = member.coachTeams
    .map((id) => teams.find((t) => t.id === id)?.name)
    .filter(Boolean)

  async function handleSave(roles: UserRole[], coachTeamIds: string[]) {
    setSaving(true)
    setSaveError(null)
    try {
      await adminSetProfileRolesAndCoachTeams(member.id, roles, coachTeamIds)
      await onRefetch()
      setEditing(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save. Please try again.'
      setSaveError(msg)
      throw e
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <Initials name={member.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-sm text-slate-900">{member.name}</span>
            {member.roles.map((r) => <RoleChip key={r} role={r} />)}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{member.email || '—'}</p>
          {member.roles.includes('coach') && coachTeamNames.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Coaches: {coachTeamNames.join(', ')}
            </p>
          )}
          {member.roles.includes('coach') && coachTeamNames.length === 0 && !editing && (
            <p className="mt-1 text-xs text-amber-600">No teams assigned</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="shrink-0 rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Edit
        </button>
      </div>
      {editing && (
        <>
          <MemberEditor
            member={member}
            teams={teams}
            onSave={handleSave}
            onCancel={() => { setEditing(false); setSaveError(null) }}
          />
          {saveError && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</p>
          )}
          {saving && (
            <p className="mt-1 text-xs text-slate-400">Saving…</p>
          )}
        </>
      )}
    </li>
  )
}

// ── Members list ──────────────────────────────────────────────────

type RoleFilter = 'all' | UserRole

function MembersList({ teams }: { teams: TeamRecord[] }) {
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  useEffect(() => {
    fetchAllProfiles()
      .then(setMembers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((m) => {
      if (roleFilter !== 'all' && !m.roles.includes(roleFilter)) return false
      if (q && !m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false
      return true
    })
  }, [members, search, roleFilter])

  const refetchMembers = useCallback(async () => {
    const fresh = await fetchAllProfiles()
    setMembers(fresh)
  }, [])

  const FILTERS: { label: string; value: RoleFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Admins', value: 'admin' },
    { label: 'Coaches', value: 'coach' },
    { label: 'Parents', value: 'parent' },
    { label: 'Players', value: 'player' },
  ]

  if (loading) return <p className="py-6 text-center text-sm text-slate-400">Loading members…</p>
  if (error)   return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-[#123524] focus:ring-2 focus:ring-[#123524]/15"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setRoleFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                roleFilter === f.value
                  ? 'bg-[#123524] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-[#123524]/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {search || roleFilter !== 'all' ? 'No members match this filter.' : 'No members yet.'}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {filtered.map((m) => (
            <MemberRow key={m.id} member={m} teams={teams} onRefetch={refetchMembers} />
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400">{filtered.length} of {members.length} member{members.length !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Duplicate merge ───────────────────────────────────────────────

function DuplicateCard({
  group,
  teams,
  onMerged,
}: {
  group: DuplicateGroup
  teams: TeamRecord[]
  onMerged: () => void
}) {
  const [primaryId, setPrimaryId] = useState(group.players[0].id)
  const [merging, setMerging] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const secondary = group.players.filter((p) => p.id !== primaryId)

  async function handleMerge() {
    if (secondary.length === 0) return
    setMerging(true)
    setError(null)
    try {
      for (const sec of secondary) {
        await mergePlayers(primaryId, sec.id)
      }
      setDone(true)
      setTimeout(onMerged, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMerging(false)
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Merged — records combined into one.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm text-slate-900">{group.name}</p>
          {group.dob && <p className="text-xs text-slate-500">DOB: {group.dob}</p>}
        </div>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
          {group.players.length} duplicates
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Choose the record to keep</p>
        {group.players.map((player) => {
          const playerTeams = player.teamIds.map((id) => teams.find((t) => t.id === id)?.name).filter(Boolean)
          const isSelected = player.id === primaryId
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => setPrimaryId(player.id)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                isSelected
                  ? 'border-[#123524] bg-white ring-1 ring-[#123524]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">{player.name}</span>
                {isSelected && (
                  <span className="rounded-full bg-[#123524] px-2 py-0.5 text-[10px] font-bold text-white">Keep</span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {playerTeams.length > 0 ? `Teams: ${playerTeams.join(', ')}` : 'No team assignments'}
              </p>
            </button>
          )
        })}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <p className="text-[11px] text-slate-500">
        All attendance, reviews, and parent links from the other record will be moved to the selected one, then deleted.
      </p>

      <button
        type="button"
        onClick={() => void handleMerge()}
        disabled={merging}
        className="w-full rounded-xl bg-amber-600 py-2 text-xs font-bold text-white transition disabled:opacity-50 hover:bg-amber-700"
      >
        {merging ? 'Merging…' : 'Merge duplicates'}
      </button>
    </div>
  )
}

function DuplicatesView({ teams }: { teams: TeamRecord[] }) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetchDuplicatePlayers()
      .then(setGroups)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Load failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function handleMerged(groupName: string) {
    setGroups((prev) => prev.filter((g) => g.name !== groupName))
  }

  if (loading) return <p className="py-6 text-center text-sm text-slate-400">Scanning for duplicates…</p>
  if (error)   return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 py-10 text-center">
        <p className="text-2xl">✓</p>
        <p className="mt-2 text-sm font-semibold text-green-700">No duplicate players found</p>
        <p className="mt-1 text-xs text-green-600">All player records appear to be unique.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Found <strong>{groups.length}</strong> group{groups.length !== 1 ? 's' : ''} of potential duplicates based on matching name and date of birth.
      </p>
      {groups.map((g) => (
        <DuplicateCard
          key={`${g.name}-${g.dob ?? 'nodob'}`}
          group={g}
          teams={teams}
          onMerged={() => handleMerged(g.name)}
        />
      ))}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────

type MembersView = 'list' | 'duplicates'

export function AdminMembersPanel({ teams }: { teams: TeamRecord[] }) {
  const [view, setView] = useState<MembersView>('list')

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Members</h2>
          <p className="mt-1 text-sm text-slate-500">View all accounts, edit roles and team assignments, and resolve duplicate player records.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <ClubInviteButton role="coach" />
          <ClubInviteButton role="admin" />
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {([
          { label: 'All members', value: 'list' as MembersView },
          { label: 'Duplicates', value: 'duplicates' as MembersView },
        ] as const).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setView(tab.value)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              view === tab.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <MembersList teams={teams} />
      ) : (
        <DuplicatesView teams={teams} />
      )}
    </section>
  )
}
