interface BottomNavItem {
  value: string
  label: string
  icon: (active: boolean) => React.ReactNode
}

interface BottomNavProps {
  items: readonly BottomNavItem[]
  active: string
  onChange: (value: string) => void
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function SlidersIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="6" r="2" fill={active ? 'currentColor' : 'none'} />
      <circle cx="16" cy="12" r="2" fill={active ? 'currentColor' : 'none'} />
      <circle cx="8" cy="18" r="2" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

function ClipboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  )
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      {active && <rect x="8" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />}
    </svg>
  )
}

function PlusIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill={active ? 'currentColor' : 'none'} stroke="currentColor" />
    </svg>
  )
}

export const ADMIN_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'overview', label: 'Overview', icon: (a) => <HomeIcon active={a} /> },
  { value: 'manage', label: 'Manage', icon: (a) => <SlidersIcon active={a} /> },
  { value: 'activity', label: 'Activity', icon: (a) => <ClipboardIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

export const COACH_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'schedule', label: 'Schedule', icon: (a) => <CalendarIcon active={a} /> },
  { value: 'create', label: 'Create', icon: (a) => <PlusIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

export const PARENT_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'schedule', label: 'Schedule', icon: (a) => <CalendarIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

export function BottomNav({ items, active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 bg-white/95 pb-safe backdrop-blur-md sm:hidden">
      {items.map((item) => {
        const isActive = item.value === active
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`flex flex-1 flex-col items-center gap-1 px-1 pb-3 pt-2.5 transition-colors ${
              isActive ? 'text-[#123524]' : 'text-slate-400 active:text-slate-600'
            }`}
          >
            {item.icon(isActive)}
            <span className={`text-[10px] font-semibold leading-none tracking-wide ${isActive ? 'text-[#123524]' : 'text-slate-400'}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
