import { useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { SelectField } from '../components/ui/SelectField.tsx'
import { BottomNav } from '../components/ui/BottomNav.tsx'
import { COACH_BOTTOM_NAV } from '../components/ui/bottomNavItems.tsx'
import { CoachOverview } from '../components/coach/CoachOverview.tsx'
import { EventTypeChip } from '../components/ui/EventTypeChip.tsx'
import { AttendanceReminderPanel } from '../components/coach/AttendanceReminderPanel.tsx'
import type { PlayerRecord } from '../types/club.ts'

const teams = [{ id: 'demo', name: 'Under 12s', ageGroup: 'U12', isSenior: false, coaches: [], players: ['1', '2', '3'], playerCount: 3, coachCount: 1, photoUrl: null, photoFocusX: 50, photoFocusY: 50, cometTeamId: null, cometCompetitionId: null, cometLastSyncedAt: null, cometLastSyncStatus: null, cometLastSyncError: null, cometLastSyncCount: null, archivedAt: null }]
const events = [{ id: 'demo', teamId: 'demo', title: 'Wednesday training', type: 'training' as const, dateTime: new Date(Date.now() + 86400000).toISOString(), meetTime: null, endTime: null, location: 'Community sports ground', placeId: null, lat: null, lng: null, recurrenceGroupId: null, opponent: null, eventStatus: 'confirmed' as const, externalSource: null, externalId: null, competition: null, homeAway: null }]
const reminderPlayers = [{ id: '1', name: 'Jamie Carter' }, { id: '2', name: 'Morgan Kelly' }] as PlayerRecord[]
const reminderAttendance = [
  { id: 'attendance-1', eventId: 'demo', playerId: '1', status: 'pending' as const },
  { id: 'attendance-2', eventId: 'demo', playerId: '2', status: 'pending' as const },
]

/** Development-only gallery. No member data or writes. */
export default function UiPreview() {
  const [active, setActive] = useState('schedule')
  const [notice, setNotice] = useState('')
  const activeLabel = COACH_BOTTOM_NAV.find((item) => item.value === active)?.label ?? 'Schedule'
  return <main className="ui-workspace min-h-screen pb-32">
    <header className="ui-mobile-header relative overflow-hidden bg-[#1f6849] px-5 pb-9 pt-4 text-white sm:hidden">
      <div aria-hidden="true" className="absolute -right-12 -top-20 h-56 w-56 rounded-full border-[38px] border-white/[0.06]" />
      <div className="relative flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 font-bold ring-1 ring-white/20">C</span><div><p className="font-bold">ClubOS</p><p className="text-[11px] text-white/65">Coach workspace</p></div></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xs font-bold">AS</span></div>
      <div className="relative mt-7"><p className="text-sm text-white/70">Good afternoon, Alex</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.035em]">{activeLabel}</h1><p className="mt-2 text-sm leading-5 text-white/65">Plan training, publish fixtures, and track availability before kickoff.</p></div>
    </header>
    <header className="ui-workspace-header mb-8 hidden sm:block"><div className="flex items-center justify-between gap-4 px-6 py-5"><div><p className="font-bold">ClubOS / Design system</p><p className="text-xs text-slate-500">Preview · fictional club data</p></div><a href="/register" className="ui-button ui-button-secondary">Registration →</a></div><nav aria-label="Preview sections" className="ui-desktop-section-nav"><div className="flex gap-1 overflow-x-auto px-6">{COACH_BOTTOM_NAV.map((item) => <button key={item.value} type="button" aria-current={active === item.value ? 'page' : undefined} onClick={() => setActive(item.value)} className="ui-desktop-section-link">{item.label}</button>)}</div></nav></header>
    <div id="workspace-content" className="relative z-10 -mt-4 rounded-t-[1.75rem] bg-[var(--ui-canvas)] px-5 pt-7 sm:mt-0 sm:rounded-none sm:bg-transparent sm:pt-0">
      <div className="mx-auto max-w-6xl space-y-6">
        <CoachOverview name="Alex" teams={teams} events={events} loading={false} attendanceCounts={new Map([['demo', { yes: 2, pending: 1, no: 0 }]])} onCreate={() => setNotice('Create event selected')} onSelectEvent={() => setNotice('Availability selected')} onSquad={() => setActive('squad')} onMessages={() => setActive('messages')} />
        <p role="status" className="text-sm text-slate-600">{notice || `Selected section: ${active}`}</p>
        <section className="ui-panel p-6"><p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Availability follow-up</p><AttendanceReminderPanel eventId="demo" attendance={reminderAttendance} players={reminderPlayers} reminders={[{ eventId: 'demo', playerId: '2', sentAt: new Date().toISOString(), sentBy: 'coach', source: 'manual' }]} sending={false} onSend={async (playerIds) => { setNotice(`Preview reminder prepared for ${playerIds.length} players.`); return { recipients: playerIds.length, players: playerIds.length, skipped: 0, sentAt: new Date().toISOString() } }} /></section>
        <section className="ui-panel p-6"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500">Components</p><h2 className="mt-1 text-xl font-bold">Plan your next session</h2></div><EventTypeChip type="training" /></div><div className="grid gap-5 sm:grid-cols-2"><TextField label="Session name" placeholder="e.g. Wednesday training" hint="Use a name your squad will recognise." /><SelectField label="Team" options={[{ value: 'u12', label: 'Under 12s' }]} /><TextField label="Validation example" error="Enter a location before saving." placeholder="Search for a venue" /><TextField label="Disabled field" disabled value="Assigned by your club" /></div><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => setNotice('Preview saved. No club data was changed.')}>Save session</Button><Button variant="secondary" onClick={() => setNotice('Changes cancelled')}>Cancel</Button><Button loading>Saving session</Button><Button disabled>Unavailable</Button></div></section>
      </div>
    </div><BottomNav items={COACH_BOTTOM_NAV} active={active} onChange={setActive} badges={{ messages: true }} />
  </main>
}
