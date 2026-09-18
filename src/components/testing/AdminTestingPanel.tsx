import { useState } from 'react'
import { useTeamPlayers } from '../../hooks/useTeamPlayers.ts'
import type { TeamRecord } from '../../types/club.ts'
import { SelectField } from '../ui/SelectField.tsx'
import { TestDefinitionsManager } from './TestDefinitionsManager.tsx'
import { TestingEventsPanel } from './TestingEventsPanel.tsx'

export function AdminTestingPanel({ teams, currentUserId }: { teams: TeamRecord[]; currentUserId: string }) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const { players, loading } = useTeamPlayers(teamId)
  const team = teams.find((item) => item.id === teamId)

  return (
    <div className="space-y-6">
      <TestDefinitionsManager />
      <div className="border-t border-slate-200 pt-6">
        <SelectField
          label="Manage testing events for"
          value={teamId}
          options={teams.map((item) => ({ value: item.id, label: `${item.name} (${item.ageGroup})` }))}
          onChange={(event) => setTeamId(event.target.value)}
        />
        {loading ? <p className="mt-4 text-sm text-slate-400">Loading squad…</p> : team ? (
          <div className="mt-5">
            <TestingEventsPanel teamId={team.id} teamName={team.name} players={players} currentUserId={currentUserId} />
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">Create a team before scheduling testing.</p>}
      </div>
    </div>
  )
}
