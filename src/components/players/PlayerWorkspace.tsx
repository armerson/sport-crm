import { lazy, Suspense, useState } from 'react'
import { PlayerProfileCard } from './PlayerProfileCard.tsx'
import { PlayerDevelopmentPanel } from '../development/PlayerDevelopmentPanel.tsx'
import { PageSkeleton } from '../ui/Skeleton.tsx'

const PlayerTestingPanel = lazy(async () => {
  const module = await import('../testing/PlayerTestingPanel.tsx')
  return { default: module.PlayerTestingPanel }
})

const PlayerPathwayPanel = lazy(async () => {
  const module = await import('../pathway/PlayerPathwayPanel.tsx')
  return { default: module.PlayerPathwayPanel }
})

const PlayerProgressPanel = lazy(async () => {
  const module = await import('../progress/PlayerProgressPanel.tsx')
  return { default: module.PlayerProgressPanel }
})

type WorkspaceSection = 'overview' | 'development' | 'performance' | 'pathway' | 'reports'

interface PlayerWorkspaceProps {
  playerId: string
  playerName: string
  teamId: string
  currentUserId: string
  role: 'admin' | 'coach'
}

const sections: Array<{ value: WorkspaceSection; label: string; shortLabel: string }> = [
  { value: 'overview', label: 'Overview', shortLabel: 'Overview' },
  { value: 'development', label: 'Development', shortLabel: 'Develop' },
  { value: 'performance', label: 'Performance', shortLabel: 'Testing' },
  { value: 'pathway', label: 'Pathway', shortLabel: 'Pathway' },
  { value: 'reports', label: 'Reports & cards', shortLabel: 'Reports' },
]

function WorkspaceFallback() {
  return (
    <div className="ui-panel p-5 sm:p-6">
      <PageSkeleton />
    </div>
  )
}

export function PlayerWorkspace({ playerId, playerName, teamId, currentUserId, role }: PlayerWorkspaceProps) {
  const [section, setSection] = useState<WorkspaceSection>('overview')

  return (
    <section className="player-workspace" aria-label={`${playerName} player workspace`}>
      <div className="player-workspace-nav" role="tablist" aria-label="Player record sections">
        {sections.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={section === item.value}
            onClick={() => setSection(item.value)}
            className="player-workspace-tab"
          >
            <span className="sm:hidden">{item.shortLabel}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="player-workspace-content ui-view-enter" key={section}>
        {section === 'overview' ? (
          <PlayerProfileCard playerId={playerId} role={role} currentUserId={currentUserId} />
        ) : null}
        {section === 'development' ? (
          <PlayerDevelopmentPanel playerId={playerId} playerName={playerName} teamId={teamId} currentUserId={currentUserId} role={role} />
        ) : null}
        {section === 'performance' ? (
          <Suspense fallback={<WorkspaceFallback />}><PlayerTestingPanel playerId={playerId} /></Suspense>
        ) : null}
        {section === 'pathway' ? (
          <Suspense fallback={<WorkspaceFallback />}><PlayerPathwayPanel playerId={playerId} playerName={playerName} currentUserId={currentUserId} /></Suspense>
        ) : null}
        {section === 'reports' ? (
          <Suspense fallback={<WorkspaceFallback />}><PlayerProgressPanel playerId={playerId} currentUserId={currentUserId} role={role} /></Suspense>
        ) : null}
      </div>
    </section>
  )
}
