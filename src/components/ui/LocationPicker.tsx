import { useEffect, useRef, useState } from 'react'

export interface LocationValue {
  address: string
  placeId: string | null
  lat: number | null
  lng: number | null
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}


interface LocationPickerProps {
  value: string
  onChange: (value: LocationValue) => void
  placeholder?: string
  className?: string
}

function googleEmbedUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&output=embed`
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function googleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ── Nominatim search ─────────────────────────────────────────────────────────

async function nominatimSearch(query: string): Promise<NominatimResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6`,
    { headers: { 'Accept-Language': 'en' } },
  )
  return res.json() as Promise<NominatimResult[]>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LocationPicker({ value, onChange, placeholder = 'Search for a location…', className = '' }: LocationPickerProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 400)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Autocomplete search
  useEffect(() => {
    if (debouncedQuery.length < 3 || lat !== null) {
      setResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    void nominatimSearch(debouncedQuery)
      .then((data) => {
        setResults(data)
        setShowResults(data.length > 0)
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false))
  }, [debouncedQuery, lat])

  function handleSelect(result: NominatimResult) {
    const address = result.display_name
    const selectedLat = parseFloat(result.lat)
    const selectedLng = parseFloat(result.lon)
    setQuery(address)
    setLat(selectedLat)
    setLng(selectedLng)
    setResults([])
    setShowResults(false)
    onChange({ address, placeId: null, lat: selectedLat, lng: selectedLng })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setQuery(newValue)
    setLat(null)
    setLng(null)
    onChange({ address: newValue, placeId: null, lat: null, lng: null })
  }

  const inputCls = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30 ${className}`
  const showMap = lat !== null && lng !== null && value

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          className={`${inputCls} pl-9`}
          onChange={handleInputChange}
          onFocus={() => { if (results.length > 0) setShowResults(true) }}
        />
        {searching && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg className="animate-spin text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeOpacity="0.25" />
              <path d="M21 12a9 9 0 0 1-9 9" />
            </svg>
          </span>
        )}

        {showResults && results.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10">
            {results.map((result) => (
              <li key={result.place_id}>
                <button
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(result) }}
                  type="button"
                >
                  {result.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showMap && (
        <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-2 bg-slate-50 px-3 py-2">
            <span className="min-w-0 truncate text-xs font-medium text-slate-500">{value}</span>
            <a
              href={googleMapsUrl(lat!, lng!)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-[#1565ff] hover:underline"
            >
              Open in Maps ↗
            </a>
          </div>
          <div className="relative w-full" style={{ height: 200 }}>
            <iframe
              title="Event location map"
              src={googleEmbedUrl(lat!, lng!)}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Read-only map card shown on event detail views.
 */
export function LocationMapCard({
  location,
  lat,
  lng,
}: {
  location: string
  placeId?: string | null
  lat?: number | null
  lng?: number | null
}) {
  if (!location) return null
  const hasCoords = lat != null && lng != null
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex min-w-0 items-center justify-between gap-2 bg-slate-50 px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-600">
          <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <span className="truncate">{location}</span>
        </span>
        <a
          href={
            hasCoords
              ? googleMapsUrl(lat!, lng!)
              : googleMapsSearchUrl(location)
          }
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-[#1565ff] hover:underline"
        >
          Directions ↗
        </a>
      </div>
      {hasCoords && (
        <div className="relative w-full" style={{ height: 180 }}>
          <iframe
            title="Event location"
            src={googleEmbedUrl(lat!, lng!)}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </div>
  )
}
