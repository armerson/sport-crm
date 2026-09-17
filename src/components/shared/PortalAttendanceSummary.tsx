interface PortalAttendanceSummaryProps {
  counts: { yes: number; pending: number; no: number } | null
  emptyLabel: string
}

const metrics = [
  { key: 'yes', label: 'Going', tone: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  { key: 'pending', label: 'Awaiting reply', tone: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  { key: 'no', label: 'Not going', tone: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
] as const

export function PortalAttendanceSummary({ counts, emptyLabel }: PortalAttendanceSummaryProps) {
  return (
    <article className="ui-module">
      <div className="ui-module-header">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ui-accent)]">Availability</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Attendance summary</h2>
        <p className="mt-1 text-sm text-slate-500">Your responses across scheduled club events.</p>
      </div>
      <div className="ui-module-body">
        {counts ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {metrics.map((metric) => (
              <div key={metric.key} className={`rounded-xl p-3 sm:p-4 ${metric.tone}`}>
                <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${metric.dot}`} /><p className="text-xs font-semibold">{metric.label}</p></div>
                <p className="mt-3 text-2xl font-bold tabular-nums sm:text-3xl">{counts[metric.key]}</p>
              </div>
            ))}
          </div>
        ) : <div className="ui-empty">{emptyLabel}</div>}
      </div>
    </article>
  )
}
