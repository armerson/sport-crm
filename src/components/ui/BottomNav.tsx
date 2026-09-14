export interface BottomNavItem {
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

export function BottomNav({ items, active, onChange, badges = {} }: BottomNavProps) {
  return (
    <nav aria-label="Main navigation" className="ui-bottom-nav fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 bg-white/95 pb-safe backdrop-blur-md sm:hidden">
      {items.map((item) => {
        const isActive = item.value === active
        const hasBadge = badges[item.value] === true
        return (
          <button
            key={item.value}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(item.value)}
            className={`relative flex flex-1 flex-col items-center gap-1 px-1 pb-3 pt-2.5 transition-colors ${
              isActive ? 'text-[var(--ui-accent)]' : 'text-slate-500 active:text-slate-600'
            }`}
          >
            <span className="relative">
              {item.icon(isActive)}
              {hasBadge && !isActive && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </span>
            <span className={`text-[10px] font-semibold leading-none tracking-wide ${isActive ? 'text-[var(--ui-accent)]' : 'text-slate-500'}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
