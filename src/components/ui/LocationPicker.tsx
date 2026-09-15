import { useEffect, useRef, useState } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

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

function googleEmbedUrl(location: string, lat?: number | null, lng?: number | null): string {
  const query = lat != null && lng != null ? `${lat},${lng}` : location
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}

function googleMapsUrl(lat: number, lng: number, placeId?: string | null): string {
  const query = `${lat},${lng}`
  const place = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : ''
  return `https://www.google.com/maps/search/?api=1&query=${query}${place}`
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

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
const mapSearchRegion = import.meta.env.VITE_MAP_SEARCH_REGION?.trim()
let googleMapsConfigured = false

type GoogleAutocompleteElement = google.maps.places.PlaceAutocompleteElement & {
  value: string
}

type GooglePlaceSelectEvent = Event & {
  place?: google.maps.places.Place
  placePrediction?: google.maps.places.PlacePrediction
}

function loadGooglePlaces() {
  if (!googleMapsApiKey) return Promise.reject(new Error('Google Maps is not configured.'))
  if (!googleMapsConfigured) {
    setOptions({
      key: googleMapsApiKey,
      v: 'weekly',
      language: 'en',
      authReferrerPolicy: 'origin',
    })
    googleMapsConfigured = true
  }
  return importLibrary('places')
}

// ── Nominatim search ─────────────────────────────────────────────────────────

async function nominatimSearch(query: string): Promise<NominatimResult[]> {
  const searches = [query, ...(mapSearchRegion ? [`${query}, ${mapSearchRegion}`] : [])]
  const batches = await Promise.all(searches.map(async (search) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&addressdetails=1&namedetails=1&limit=8`,
      { headers: { 'Accept-Language': 'en-GB,en' } },
    )
    if (!res.ok) return []
    return res.json() as Promise<NominatimResult[]>
  }))
  const seen = new Set<string>()
  return batches.flat().filter((result) => {
    const key = result.display_name.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LocationPicker({ value, onChange, placeholder = 'Search for a location…', className = '' }: LocationPickerProps) {
  const [results, setResults] = useState<NominatimResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [completedQuery, setCompletedQuery] = useState('')
  const [placeProvider, setPlaceProvider] = useState<'loading' | 'google' | 'fallback'>(googleMapsApiKey ? 'loading' : 'fallback')
  const containerRef = useRef<HTMLDivElement>(null)
  const googleContainerRef = useRef<HTMLDivElement>(null)
  const googleAutocompleteRef = useRef<GoogleAutocompleteElement | null>(null)
  const onChangeRef = useRef(onChange)
  const initialValueRef = useRef(value)
  const query = value
  const debouncedQuery = useDebounce(query, 400)
  const searchEnabled = placeProvider === 'fallback' && debouncedQuery.length >= 3 && lat === null
  const searching = searchEnabled && completedQuery !== debouncedQuery

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Prefer Google's Places widget. If the key or Places API is unavailable,
  // the existing address search remains usable as a fallback.
  useEffect(() => {
    if (!googleMapsApiKey) return
    let active = true
    let autocomplete: GoogleAutocompleteElement | null = null

    void loadGooglePlaces()
      .then(() => {
        if (!active || !googleContainerRef.current) return
        autocomplete = new google.maps.places.PlaceAutocompleteElement({}) as GoogleAutocompleteElement
        autocomplete.value = initialValueRef.current
        autocomplete.setAttribute('placeholder', placeholder)
        autocomplete.setAttribute('aria-label', 'Search Google Maps for a venue or address')
        autocomplete.className = 'google-place-autocomplete'

        const handleInput = () => {
          if (!autocomplete) return
          const address = autocomplete.value ?? ''
          setLat(null)
          setLng(null)
          setPlaceId(null)
          onChangeRef.current({ address, placeId: null, lat: null, lng: null })
        }

        const handlePlaceSelect = async (rawEvent: Event) => {
          const event = rawEvent as GooglePlaceSelectEvent
          const place = event.placePrediction?.toPlace() ?? event.place
          if (!place || !autocomplete) return
          try {
            await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location'] })
          } catch {
            if (active) setPlaceProvider('fallback')
            return
          }
          if (!active || !autocomplete) return

          const displayName = place.displayName?.trim() ?? ''
          const formattedAddress = place.formattedAddress?.trim() ?? ''
          const address = displayName && formattedAddress && !formattedAddress.toLowerCase().includes(displayName.toLowerCase())
            ? `${displayName}, ${formattedAddress}`
            : formattedAddress || displayName
          const selectedLat = place.location?.lat() ?? null
          const selectedLng = place.location?.lng() ?? null
          const selectedPlaceId = place.id || null

          autocomplete.value = address
          setLat(selectedLat)
          setLng(selectedLng)
          setPlaceId(selectedPlaceId)
          onChangeRef.current({ address, placeId: selectedPlaceId, lat: selectedLat, lng: selectedLng })
        }

        autocomplete.addEventListener('input', handleInput)
        autocomplete.addEventListener('gmp-select', handlePlaceSelect)
        autocomplete.addEventListener('gmp-placeselect', handlePlaceSelect)
        googleContainerRef.current.replaceChildren(autocomplete)
        googleAutocompleteRef.current = autocomplete
        setPlaceProvider('google')
      })
      .catch(() => {
        if (active) setPlaceProvider('fallback')
      })

    return () => {
      active = false
      googleAutocompleteRef.current = null
      autocomplete?.remove()
    }
  }, [placeholder])

  useEffect(() => {
    if (googleAutocompleteRef.current && googleAutocompleteRef.current.value !== value) {
      googleAutocompleteRef.current.value = value
    }
  }, [value])

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

  // Ignore late replies when the user types again or selects a location.
  useEffect(() => {
    if (!searchEnabled) return
    let current = true
    void nominatimSearch(debouncedQuery)
      .then((data) => {
        if (!current) return
        setResults(data)
        setShowResults(data.length > 0)
      })
      .catch(() => { if (current) setResults([]) })
      .finally(() => { if (current) setCompletedQuery(debouncedQuery) })
    return () => { current = false }
  }, [debouncedQuery, searchEnabled])

  function handleSelect(result: NominatimResult) {
    const address = result.display_name
    const selectedLat = parseFloat(result.lat)
    const selectedLng = parseFloat(result.lon)
    setLat(selectedLat)
    setLng(selectedLng)
    setPlaceId(null)
    setResults([])
    setShowResults(false)
    onChange({ address, placeId: null, lat: selectedLat, lng: selectedLng })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setResults([])
    setShowResults(false)
    setLat(null)
    setLng(null)
    setPlaceId(null)
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
        <div ref={googleContainerRef} className={placeProvider === 'google' ? 'google-place-search' : 'hidden'} />
        {placeProvider !== 'google' ? (
          <input
            type="text"
            value={query}
            placeholder={placeProvider === 'loading' ? 'Loading Google Maps…' : placeholder}
            className={`${inputCls} pl-9`}
            onChange={handleInputChange}
            onFocus={() => { if (results.length > 0) setShowResults(true) }}
          />
        ) : null}
        {(searching || placeProvider === 'loading') && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg className="animate-spin text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeOpacity="0.25" />
              <path d="M21 12a9 9 0 0 1-9 9" />
            </svg>
          </span>
        )}

        {placeProvider === 'fallback' && showResults && query === debouncedQuery && completedQuery === query && searchEnabled && results.length > 0 && (
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
              href={googleMapsUrl(lat!, lng!, placeId)}
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
              src={googleEmbedUrl(value, lat, lng)}
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
  placeId,
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
              ? googleMapsUrl(lat!, lng!, placeId)
              : googleMapsSearchUrl(location)
          }
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-[#1565ff] hover:underline"
        >
          Directions ↗
        </a>
      </div>
      <div className="relative w-full" style={{ height: 180 }}>
        <iframe
          title="Event location"
          src={googleEmbedUrl(location, lat, lng)}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  )
}
