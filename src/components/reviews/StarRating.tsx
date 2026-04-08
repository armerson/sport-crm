interface StarRatingProps {
  value: number | null
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}

const LABELS: Record<number, string> = {
  1: 'Needs work',
  2: 'Developing',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
}

export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const starSize = size === 'sm' ? 16 : 20
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          title={readonly ? undefined : LABELS[star]}
          onClick={() => onChange?.(star)}
          className={`transition ${readonly ? 'cursor-default' : 'hover:scale-110 active:scale-95'}`}
        >
          <svg
            width={starSize}
            height={starSize}
            viewBox="0 0 24 24"
            fill={value !== null && star <= value ? '#f59e0b' : 'none'}
            stroke={value !== null && star <= value ? '#f59e0b' : '#cbd5e1'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
      {value ? (
        <span className="ml-1.5 text-xs text-slate-500">{LABELS[value]}</span>
      ) : null}
    </div>
  )
}
