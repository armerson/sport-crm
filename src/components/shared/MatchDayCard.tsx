import { useEffect, useState } from 'react'
import type { AttendanceRecord, AttendanceStatus, EventRecord } from '../../types/club.ts'

// ── Weather (Open-Meteo — free, no API key) ───────────────────────────────────

interface WeatherData { tempC: number; code: number }

function weatherIcon(code: number) {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}

function weatherLabel(code: number) {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorm'
}

async function fetchWeather(lat: number, lng: number, hour: number): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,weathercode&timezone=auto&forecast_days=1`
    const json = await fetch(url).then((r) => r.json()) as {
      hourly: { temperature_2m: number[]; weathercode: number[] }
    }
    const idx = Math.max(0, Math.min(23, hour))
    return { tempC: Math.round(json.hourly.temperature_2m[idx]), code: json.hourly.weathercode[idx] }
  } catch {
    return null
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MatchDayCardProps {
  event: EventRecord
  teamName?: string
  /** Attendance records for the current user's players (parent / player view) */
  attendance?: AttendanceRecord[]
  onAttendanceChange?: (attendanceId: string, status: AttendanceStatus) => void
  /** Coach mode — shows live score stepper */
  isCoach?: boolean
  homeScore?: number | null
  awayScore?: number | null
  onScoreChange?: (home: number, away: number) => void
}

// ── Score stepper ─────────────────────────────────────────────────────────────

function Stepper({ value, onInc, onDec }: { value: number; onInc: () => void; onDec: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onDec}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white transition hover:bg-white/30 active:scale-90">−</button>
      <span className="w-8 text-center text-3xl font-bold tabular-nums text-white">{value}</span>
      <button type="button" onClick={onInc}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white transition hover:bg-white/30 active:scale-90">+</button>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MatchDayCard({
  event,
  teamName,
  attendance = [],
  onAttendanceChange,
  isCoach = false,
  homeScore,
  awayScore,
  onScoreChange,
}: MatchDayCardProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [localHome, setLocalHome] = useState(homeScore ?? 0)
  const [localAway, setLocalAway] = useState(awayScore ?? 0)

  const kickoff = new Date(event.dateTime)
  const kickoffTime = kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const isMatch = event.type === 'match'

  useEffect(() => {
    if (event.lat != null && event.lng != null) {
      void fetchWeather(event.lat, event.lng, kickoff.getHours()).then(setWeather)
    }
  }, [event.lat, event.lng])

  const myAttendance = attendance[0]
  const rsvpStatus = myAttendance?.status ?? null

  const mapsUrl =
    event.lat && event.lng
      ? `https://www.google.com/maps?q=${event.lat},${event.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#123524] to-[#1e5438] p-6 text-white shadow-2xl shadow-[#123524]/30">
      {/* Decorative circles */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
      <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/5" />

      {/* Header row */}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <span className="inline-block rounded-full bg-[#f18a3f] px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            {isMatch ? '⚽ Match day' : '🏃 Today'}
          </span>
          {teamName ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">{teamName}</p> : null}
        </div>
        {weather ? (
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-xl leading-none">{weatherIcon(weather.code)}</span>
            <div className="text-right">
              <p className="text-sm font-bold">{weather.tempC}°C</p>
              <p className="text-[10px] text-white/60">{weatherLabel(weather.code)}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Title */}
      <div className="relative mt-4">
        <h2 className="text-2xl font-bold leading-tight tracking-tight">{event.title}</h2>
        {isMatch && event.opponent
          ? <p className="mt-1 text-base text-white/70">vs <span className="font-semibold text-white">{event.opponent}</span></p>
          : null}
        <p className="mt-2 text-sm font-semibold text-white/80">⏰ {kickoffTime}</p>
      </div>

      {/* Live score — coach only */}
      {isCoach && isMatch ? (
        <div className="relative mt-5 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/50">Live score</p>
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="mb-1 max-w-[80px] truncate text-xs font-semibold text-white/60">{teamName ?? 'Us'}</p>
              <Stepper
                value={localHome}
                onInc={() => { const v = localHome + 1; setLocalHome(v); onScoreChange?.(v, localAway) }}
                onDec={() => { const v = Math.max(0, localHome - 1); setLocalHome(v); onScoreChange?.(v, localAway) }}
              />
            </div>
            <span className="text-3xl font-black text-white/30">:</span>
            <div className="text-center">
              <p className="mb-1 max-w-[80px] truncate text-xs font-semibold text-white/60">{event.opponent ?? 'Them'}</p>
              <Stepper
                value={localAway}
                onInc={() => { const v = localAway + 1; setLocalAway(v); onScoreChange?.(localHome, v) }}
                onDec={() => { const v = Math.max(0, localAway - 1); setLocalAway(v); onScoreChange?.(localHome, v) }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* RSVP — parent / player */}
      {!isCoach && myAttendance && onAttendanceChange ? (
        <div className="relative mt-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Your RSVP</p>
          <div className="flex gap-2">
            {(['confirmed', 'declined', 'maybe'] as AttendanceStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAttendanceChange(myAttendance.id, s)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition active:scale-95 ${
                  rsvpStatus === s ? 'bg-white text-[#123524] shadow-md' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {s === 'confirmed' ? '✓ Going' : s === 'declined' ? '✕ No' : '? Maybe'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Location */}
      {event.location ? (
        <div className="relative mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2">
            <svg className="shrink-0 text-white/60" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span className="truncate text-sm text-white/80">{event.location}</span>
          </div>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold transition hover:bg-white/30">
            Directions ↗
          </a>
        </div>
      ) : null}
    </div>
  )
}
