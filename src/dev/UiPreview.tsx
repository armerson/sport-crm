import { useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import { SelectField } from '../components/ui/SelectField.tsx'
import { TabNav } from '../components/ui/TabNav.tsx'
import { BottomNav } from '../components/ui/BottomNav.tsx'
import { COACH_BOTTOM_NAV } from '../components/ui/bottomNavItems.tsx'
import { CoachOverview } from '../components/coach/CoachOverview.tsx'
import { EventTypeChip } from '../components/ui/EventTypeChip.tsx'

const teams = [{ id: 'demo', name: 'Under 12s', ageGroup: 'U12', isSenior: false, coaches: [], players: ['1', '2', '3'], playerCount: 3, coachCount: 1, photoUrl: null, photoFocusX: 50, photoFocusY: 50 }]
const events = [{ id: 'demo', teamId: 'demo', title: 'Wednesday training', type: 'training' as const, dateTime: new Date(Date.now() + 86400000).toISOString(), location: 'Community sports ground', placeId: null, lat: null, lng: null, recurrenceGroupId: null, opponent: null, eventStatus: 'confirmed' as const }]

/** Development-only gallery. No member data or writes. */
export default function UiPreview() {
  const [active, setActive] = useState('schedule')
  const [notice, setNotice] = useState('')
  return <main className="ui-workspace min-h-screen pb-24">
    <header className="ui-workspace-header mb-8 flex items-center justify-between gap-4 px-6 py-6"><div><p className="font-bold">ClubOS / Design system</p><p className="text-xs text-slate-500">Preview · fictional club data</p></div><a href="/register" className="ui-button ui-button-secondary">Registration →</a></header>
    <div id="workspace-content" className="px-5">
      <div className="ui-workspace-navigation hidden sm:block"><p className="ui-navigation-label">Workspace</p><TabNav tabs={COACH_BOTTOM_NAV} active={active} onChange={setActive} /></div>
      <div className="mx-auto max-w-6xl space-y-6">
        <CoachOverview name="Alex" teams={teams} events={events} loading={false} onCreate={() => setNotice('Create event selected')} onSelectEvent={() => setNotice('Availability selected')} onSquad={() => setActive('squad')} onMessages={() => setActive('messages')} />
        <p role="status" className="text-sm text-slate-600">{notice || `Selected section: ${active}`}</p>
        <section className="ui-panel p-6"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500">Components</p><h2 className="mt-1 text-xl font-bold">Plan your next session</h2></div><EventTypeChip type="training" /></div><div className="grid gap-5 sm:grid-cols-2"><TextField label="Session name" placeholder="e.g. Wednesday training" hint="Use a name your squad will recognise." /><SelectField label="Team" options={[{ value: 'u12', label: 'Under 12s' }]} /><TextField label="Validation example" error="Enter a location before saving." placeholder="Search for a venue" /><TextField label="Disabled field" disabled value="Assigned by your club" /></div><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => setNotice('Preview saved. No club data was changed.')}>Save session</Button><Button variant="secondary" onClick={() => setNotice('Changes cancelled')}>Cancel</Button><Button loading>Saving session</Button><Button disabled>Unavailable</Button></div></section>
      </div>
    </div><BottomNav items={COACH_BOTTOM_NAV} active={active} onChange={setActive} badges={{ messages: true }} />
  </main>
}
