interface TabNavProps<T extends string> {
  tabs: readonly { label: string; value: T }[]
  active: T
  onChange: (value: T) => void
}

export function TabNav<T extends string>({ tabs, active, onChange }: TabNavProps<T>) {
  return (
    <div role="group" aria-label="Sections" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          aria-pressed={active === tab.value}
          className={`shrink-0 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            active === tab.value
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
