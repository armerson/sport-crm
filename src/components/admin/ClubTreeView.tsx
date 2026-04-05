import type { GroupRecord, TeamRecord } from '../../types/club.ts'

interface TreeNodeProps {
  group: GroupRecord
  allGroups: GroupRecord[]
  teamById: Map<string, TeamRecord>
  depth: number
}

function TreeNode({ group, allGroups, teamById, depth }: TreeNodeProps) {
  const children = allGroups.filter((g) => g.parentId === group.id)
  const assignedTeams = group.teamIds.map((id) => teamById.get(id)).filter(Boolean) as TeamRecord[]

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-slate-200 pl-4' : ''}>
      {/* Group row */}
      <div className="flex items-center gap-2 py-1.5">
        <svg className="size-4 shrink-0 text-[#123524]/70" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25A2.25 2.25 0 004.5 16.5h15A2.25 2.25 0 0021.75 14.25v-3.75" />
        </svg>
        <span className="font-semibold text-slate-950">{group.name}</span>
        {assignedTeams.length + children.length === 0 ? (
          <span className="text-xs text-slate-400">Empty</span>
        ) : null}
      </div>

      {/* Directly assigned teams */}
      {assignedTeams.map((team) => (
        <div key={team.id} className="ml-5 flex items-center gap-2 border-l border-slate-200 py-1.5 pl-4">
          <svg className="size-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <span className="text-sm text-slate-800">{team.name}</span>
          <div className="flex gap-1">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{team.playerCount}p</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{team.coachCount}c</span>
          </div>
        </div>
      ))}

      {/* Sub-groups (recursive) */}
      {children.map((child) => (
        <TreeNode key={child.id} group={child} allGroups={allGroups} teamById={teamById} depth={depth + 1} />
      ))}
    </div>
  )
}

interface ClubTreeViewProps {
  groups: GroupRecord[]
  teams: TeamRecord[]
}

export function ClubTreeView({ groups, teams }: ClubTreeViewProps) {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const rootGroups = groups.filter((g) => g.parentId === null)

  // Teams not assigned to any group
  const assignedTeamIds = new Set(groups.flatMap((g) => g.teamIds))
  const ungroupedTeams = teams.filter((t) => !assignedTeamIds.has(t.id))

  if (groups.length === 0 && teams.length === 0) return null

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-slate-950">Club structure</h3>
        <p className="text-sm text-slate-500">{groups.length} {groups.length === 1 ? 'group' : 'groups'}</p>
      </div>

      <div className="mt-4">
        {rootGroups.length > 0 ? (
          <div className="space-y-1">
            {rootGroups.map((group) => (
              <TreeNode key={group.id} group={group} allGroups={groups} teamById={teamById} depth={0} />
            ))}
          </div>
        ) : null}

        {ungroupedTeams.length > 0 ? (
          <div className={rootGroups.length > 0 ? 'mt-3 border-t border-slate-100 pt-3' : ''}>
            {rootGroups.length > 0 ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Ungrouped teams</p>
            ) : null}
            <div className="space-y-1">
              {ungroupedTeams.map((team) => (
                <div key={team.id} className="flex items-center gap-2 py-1.5">
                  <svg className="size-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  <span className="text-sm text-slate-800">{team.name}</span>
                  <div className="flex gap-1">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{team.playerCount}p</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{team.coachCount}c</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {rootGroups.length === 0 && ungroupedTeams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No groups yet. Go to Manage → Groups to build the club structure.
          </div>
        ) : null}
      </div>
    </article>
  )
}
