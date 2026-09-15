import type { PlayerRecord } from '../../types/club.ts'

interface RegistrationStatusCardProps {
  player: Pick<PlayerRecord, 'name' | 'status' | 'registrationMessage' | 'registrationUpdatedAt'>
  compact?: boolean
}

const copy = {
  pending: { label: 'Under review', tone: 'border-amber-200 bg-amber-50 text-amber-950', detail: 'The club has received the registration and will review it.' },
  needs_info: { label: 'Action needed', tone: 'border-orange-200 bg-orange-50 text-orange-950', detail: 'The club needs a little more information before it can finish the review.' },
  active: { label: 'Approved', tone: 'border-emerald-200 bg-emerald-50 text-emerald-950', detail: 'The registration is approved and team access is ready.' },
  rejected: { label: 'Not approved', tone: 'border-rose-200 bg-rose-50 text-rose-950', detail: 'The club has completed its review. See the message below for details.' },
} as const

export function RegistrationStatusCard({ player, compact = false }: RegistrationStatusCardProps) {
  const current = copy[player.status]
  const reviewComplete = player.status === 'active' || player.status === 'rejected'
  return (
    <section className={`rounded-3xl border p-4 ${current.tone}`} aria-label={`${player.name} registration status`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-65">Club registration</p>
          <h3 className="mt-1 font-semibold">{player.name} · {current.label}</h3>
        </div>
        {player.registrationUpdatedAt ? (
          <span className="text-[11px] font-medium opacity-65">Updated {new Date(player.registrationUpdatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        ) : null}
      </div>
      {!compact ? (
        <div className="mt-4 grid grid-cols-3 gap-1.5" aria-label="Registration progress">
          {[
            { label: 'Received', complete: true },
            { label: 'Club review', complete: reviewComplete },
            { label: 'Team access', complete: player.status === 'active' },
          ].map((step, index) => (
            <div className="text-center" key={step.label}>
              <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step.complete ? 'bg-current/15' : 'border border-current/20 bg-white/35'}`}>
                {step.complete ? '✓' : index + 1}
              </span>
              <span className="mt-1 block text-[10px] font-semibold opacity-75">{step.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-sm opacity-85">{current.detail}</p>
      {player.registrationMessage ? (
        <div className="mt-3 rounded-2xl bg-white/65 px-3.5 py-3 text-sm font-medium shadow-sm">{player.registrationMessage}</div>
      ) : null}
      {player.status === 'needs_info' ? <p className="mt-2 text-xs font-semibold">Update the player profile, then the club can continue the review.</p> : null}
    </section>
  )
}
