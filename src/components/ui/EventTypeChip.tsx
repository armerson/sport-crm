import type { EventType } from '../../types/club.ts'

interface EventTypeChipProps {
  type: EventType
  /** When chip sits on a dark background (e.g. selected/active card) */
  onDark?: boolean
}

export function EventTypeChip({ type, onDark = false }: EventTypeChipProps) {
  if (onDark) {
    return (
      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold capitalize text-white">
        {type}
      </span>
    )
  }
  if (type === 'match') {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-amber-700">
        Match
      </span>
    )
  }
  return (
    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-sky-700">
      Training
    </span>
  )
}
