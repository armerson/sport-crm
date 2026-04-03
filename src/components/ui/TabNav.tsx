interface TabNavProps<T extends string> {
  tabs: readonly { label: string; value: T }[]
  active: T
  onChange: (value: T) => void
}

export function TabNav<T extends string>({ tabs, active, onChange }: TabNavProps<T>) {
  return (
    <div className="flex rounded-2xl bg-slate-100/90 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            active === tab.value
              ? 'bg-white text-slate-900 shadow-sm'
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
