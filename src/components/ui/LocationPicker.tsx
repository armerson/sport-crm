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

function osmEmbedUrl(lat: number, lng: number): string {
  const d = 0.008
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

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

  // Nominatim search — fires when user types and no location is pinned yet
  useEffect(() => {
    if (debouncedQuery.length < 3 || lat !== null) {
      setResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    void fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedQuery)}&format=json&limit=5`,
      { headers: { 'Accept-Language': 'en' } },
    )
      .then((res) => res.json() as Promise<NominatimResult[]>)
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

  const inputCls = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#123524]/30 ${className}`
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
            <span className="mr-2 truncate text-xs font-medium text-slate-500">{value}</span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-[#123524] hover:underline"
            >
              Open in Maps ↗
            </a>
          </div>
          <iframe
            title="Event location map"
            src={osmEmbedUrl(lat!, lng!)}
            width="100%"
            height="200"
            className="border-0"
            loading="lazy"
          />
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
        <span className="flex items-center gap-1.5 mr-2 truncate text-xs font-medium text-slate-600">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {location}
        </span>
        <a
          href={
            hasCoords
              ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
              : `https://maps.google.com/?q=${encodeURIComponent(location)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-[#123524] hover:underline"
        >
          Directions ↗
        </a>
      </div>
      {hasCoords && (
        <iframe
          title="Event location"
          src={osmEmbedUrl(lat!, lng!)}
          width="100%"
          height="180"
          className="border-0"
          loading="lazy"
        />
      )}
    </div>
  )
}
