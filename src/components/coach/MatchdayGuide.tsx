interface MatchdayGuideProps {
  attending: number
  pending: number
  selected: number
  isPast: boolean
  resultRecorded: boolean
  winnerRecorded: boolean
  onJump: (target: 'matchday-availability' | 'matchday-squad' | 'matchday-result' | 'matchday-player') => void
}

const stages = [
  { key: 'availability', label: 'Availability', target: 'matchday-availability' as const },
  { key: 'squad', label: 'Squad', target: 'matchday-squad' as const },
  { key: 'result', label: 'Result', target: 'matchday-result' as const },
  { key: 'player', label: 'Player', target: 'matchday-player' as const },
]

export function MatchdayGuide({ attending, pending, selected, isPast, resultRecorded, winnerRecorded, onJump }: MatchdayGuideProps) {
  const done = {
    availability: pending === 0,
    squad: selected > 0,
    result: resultRecorded,
    player: winnerRecorded,
  }
  const next = pending > 0
    ? { target: 'matchday-availability' as const, label: `Check ${pending} response${pending === 1 ? '' : 's'}` }
    : selected === 0
      ? { target: 'matchday-squad' as const, label: 'Pick the match squad' }
      : !isPast
        ? { target: 'matchday-squad' as const, label: 'Review the match squad' }
        : !resultRecorded
          ? { target: 'matchday-result' as const, label: 'Record the result' }
          : !winnerRecorded
            ? { target: 'matchday-player' as const, label: 'Choose player of the match' }
            : { target: 'matchday-result' as const, label: 'Review match summary' }
  const completed = Object.values(done).filter(Boolean).length

  return (
    <section className="mt-4 rounded-[1.4rem] bg-slate-950 p-4 text-white shadow-lg shadow-slate-950/10" aria-label="Matchday checklist">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Matchday</p>
          <h3 className="mt-1 text-base font-semibold">Your match checklist</h3>
          <p className="mt-1 text-xs text-slate-300">{attending} available · {selected} selected</p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">{completed}/4</span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {stages.map((stage, index) => {
          const complete = done[stage.key as keyof typeof done]
          const unavailable = !isPast && (stage.key === 'result' || stage.key === 'player')
          return (
            <button
              key={stage.key}
              className="group rounded-xl px-1 py-2 text-center transition hover:bg-white/10 disabled:cursor-default disabled:opacity-45"
              disabled={unavailable}
              onClick={() => onJump(stage.target)}
              type="button"
            >
              <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${complete ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-white'}`}>
                {complete ? '✓' : index + 1}
              </span>
              <span className="mt-1.5 block text-[10px] font-semibold text-slate-200">{stage.label}</span>
            </button>
          )
        })}
      </div>

      <button
        className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-[#1565ff] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3278ff] active:scale-[0.99]"
        onClick={() => onJump(next.target)}
        type="button"
      >
        <span>{next.label}</span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  )
}
