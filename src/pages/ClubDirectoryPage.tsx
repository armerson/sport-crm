import { useState } from 'react'
import { activeClub, clubOSMode, clubRegistry, clubRegistryError, switchToClub } from '../clubos/runtime.ts'
import { clubEntryPath, listedClubs, searchClubs, type ClubEntryAction, type RegistryClub } from '../clubos/registry.ts'

function ClubBadge({ club }: { club: RegistryClub }) {
  const color = club.branding?.primaryColor ?? '#1e3a8a'
  if (club.branding?.badgeUrl) {
    return <img src={club.branding.badgeUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-slate-200" />
  }
  return (
    <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: color }}>
      {club.name.charAt(0)}
    </span>
  )
}

function locationLabel(club: RegistryClub): string | null {
  if (!club.location) return null
  return [club.location.town, club.location.region].filter(Boolean).join(', ')
}

/** In-app clubs switch the backend; separately deployed clubs are plain links. */
function ClubAction({ club, action, primary }: { club: RegistryClub; action: ClubEntryAction; primary: boolean }) {
  const label = action === 'register' ? 'Join' : 'Sign in'
  const className = primary
    ? 'rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700'
    : 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50'
  if (clubOSMode === 'multi' && club.backend) {
    return (
      <button type="button" className={className} onClick={() => switchToClub(club, clubEntryPath(action) as '/login' | '/register')}>
        {label}
      </button>
    )
  }
  if (club.origin) {
    return <a className={className} href={new URL(clubEntryPath(action), club.origin).href}>{label}</a>
  }
  return null
}

export function ClubDirectoryPage() {
  const [query, setQuery] = useState('')
  const listed = listedClubs(clubRegistry)
  const results = searchClubs(clubRegistry, query)
  const returning = clubOSMode === 'multi' ? activeClub : null

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-8">
      <section className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700">ClubOS</p>
          <h1 className="mt-3 text-3xl font-bold">Find your club</h1>
          <p className="mt-2 text-slate-600">Choose your club to sign in or join. Each club manages its own accounts and records.</p>
        </header>

        {returning ? (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ClubBadge club={returning} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Your club</p>
              <p className="truncate text-lg font-bold">{returning.name}</p>
            </div>
            <button type="button" onClick={() => switchToClub(returning)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
              Continue
            </button>
          </div>
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold">Club name, code or town</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clubs"
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
          />
        </label>

        <div aria-live="polite" className="space-y-3">
          {clubRegistryError ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{clubRegistryError}</p> : null}
          {!clubRegistryError && results.length === 0 ? (
            <p className="text-slate-600">{listed.length ? 'No matching clubs. Try another name, code or town.' : 'No clubs are listed yet.'}</p>
          ) : null}
          {results.map((club) => (
            <article key={club.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <ClubBadge club={club} />
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">{club.name}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {[locationLabel(club), club.sport.charAt(0).toUpperCase() + club.sport.slice(1), club.code].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ClubAction club={club} action="login" primary />
                <ClubAction club={club} action="register" primary={false} />
                {club.website ? <a className="px-2 py-2 text-sm font-semibold text-blue-700 underline" href={club.website}>Club website</a> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
