interface BottomNavItem {
  value: string
  label: string
  icon: (active: boolean) => React.ReactNode
}

interface BottomNavProps {
  items: readonly BottomNavItem[]
  active: string
  onChange: (value: string) => void
  badges?: Record<string, boolean>
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

function CreditCardIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" fill={active ? 'currentColor' : 'none'} stroke="currentColor" opacity={active ? 0.15 : 1} />
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" strokeWidth={active ? 2.5 : 2} />
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

function NewspaperIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8z" fill={active ? 'currentColor' : 'none'} strokeWidth={0} />
      <path d="M10 6h8v4h-8V6z" />
    </svg>
  )
}


export const ADMIN_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'overview', label: 'Overview', icon: (a) => <HomeIcon active={a} /> },
  { value: 'manage', label: 'Manage', icon: (a) => <SlidersIcon active={a} /> },
  { value: 'posts', label: 'Posts', icon: (a) => <NewspaperIcon active={a} /> },
  { value: 'billing', label: 'Billing', icon: (a) => <CreditCardIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

export const COACH_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'schedule', label: 'Schedule', icon: (a) => <CalendarIcon active={a} /> },
  { value: 'create', label: 'Create', icon: (a) => <PlusIcon active={a} /> },
  { value: 'feed', label: 'Feed', icon: (a) => <NewspaperIcon active={a} /> },
  { value: 'squad', label: 'Squad', icon: (a) => <ClipboardIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

export const PARENT_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'schedule', label: 'Schedule', icon: (a) => <CalendarIcon active={a} /> },
  { value: 'children', label: 'My children', icon: (a) => <ClipboardIcon active={a} /> },
  { value: 'feed', label: 'Feed', icon: (a) => <NewspaperIcon active={a} /> },
  { value: 'billing', label: 'Billing', icon: (a) => <CreditCardIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

/** Senior / self-registered player portal (matches `PlayerTab` values). */
export const PLAYER_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'schedule', label: 'Schedule', icon: (a) => <CalendarIcon active={a} /> },
  { value: 'feed', label: 'Feed', icon: (a) => <NewspaperIcon active={a} /> },
  { value: 'profile', label: 'Profile', icon: (a) => <ClipboardIcon active={a} /> },
  { value: 'billing', label: 'Billing', icon: (a) => <CreditCardIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

export function BottomNav({ items, active, onChange, badges = {} }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 bg-white/95 pb-safe backdrop-blur-md sm:hidden">
      {items.map((item) => {
        const isActive = item.value === active
        const hasBadge = badges[item.value] === true
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`relative flex flex-1 flex-col items-center gap-1 px-1 pb-3 pt-2.5 transition-colors ${
              isActive ? 'text-[#123524]' : 'text-slate-400 active:text-slate-600'
            }`}
          >
            <span className="relative">
              {item.icon(isActive)}
              {hasBadge && !isActive && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </span>
            <span className={`text-[10px] font-semibold leading-none tracking-wide ${isActive ? 'text-[#123524]' : 'text-slate-400'}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
