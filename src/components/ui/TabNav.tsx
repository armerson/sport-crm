interface TabNavProps<T extends string> {
  tabs: readonly { label: string; value: T }[]
  active: T
  onChange: (value: T) => void
}

export function TabNav<T extends string>({ tabs, active, onChange }: TabNavProps<T>) {
  return (
    <div role="group" aria-label="Sections" className="ui-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          aria-pressed={active === tab.value}
          className="ui-tab"
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
