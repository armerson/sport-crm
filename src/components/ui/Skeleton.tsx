/** Single shimmer bar */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />
}

/** Skeleton that looks like 3 event cards */
export function EventListSkeleton() {
  return (
    <div className="space-y-3">
      {[72, 60, 72].map((h, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <Bar className="h-4 w-2/5" />
            <Bar className="h-5 w-14 rounded-full" />
          </div>
          <Bar className="h-3 w-1/3" />
          <Bar className={`h-3 w-${h === 72 ? '1/2' : '2/5'}`} />
        </div>
      ))}
    </div>
  )
}

/** Skeleton for an attendance panel */
export function AttendanceSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      <Bar className="h-4 w-32" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Bar className="h-8 w-8 rounded-full" />
          <Bar className="h-4 flex-1" />
          <Bar className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Generic page-level skeleton — two card rows */
export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 space-y-4">
        <Bar className="h-5 w-48" />
        <Bar className="h-4 w-72" />
        <div className="flex gap-3 pt-1">
          {[80, 64, 80, 64, 72].map((w, i) => (
            <Bar key={i} className={`h-8 w-${w === 80 ? '20' : w === 64 ? '16' : '18'} rounded-full`} />
          ))}
        </div>
      </div>
      <EventListSkeleton />
    </div>
  )
}
