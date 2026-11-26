import { useState } from 'react'
import { clubEntryUrl, filterDirectory, parseClubDirectory, type DirectoryClub } from '../utils/clubDirectory.ts'

function loadDirectory(): { clubs: DirectoryClub[]; error: boolean } {
  try {
    return { clubs: parseClubDirectory(import.meta.env.VITE_CLUB_DIRECTORY_JSON), error: false }
  } catch {
    return { clubs: [], error: true }
  }
}
const directory = loadDirectory()

export function ClubDirectoryPage() {
  const [query, setQuery] = useState('')
  const clubs = filterDirectory(directory.clubs, query)
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-8">
      <section className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700">ClubOS</p>
          <h1 className="mt-3 text-3xl font-bold">Find your club</h1>
          <p className="mt-2 text-slate-600">Choose your club to sign in or register. Each club manages its own accounts and records.</p>
        </header>
        <label className="block">
          <span className="text-sm font-semibold">Club name or code</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clubs" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
        </label>
        <div aria-live="polite" className="space-y-3">
          {directory.error ? <p role="alert">The club directory is unavailable. Please contact your club.</p> : null}
          {!directory.error && clubs.length === 0 ? <p className="text-slate-600">{directory.clubs.length ? 'No matching clubs. Try another name or code.' : 'No clubs are listed yet.'}</p> : null}
          {clubs.map((club) => (
            <article key={club.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold">{club.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{club.code}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white" href={clubEntryUrl(club, 'login')}>Sign in</a>
                <a className="rounded-lg border border-slate-300 px-4 py-2 font-semibold" href={clubEntryUrl(club, 'register')}>Register</a>
                {club.website ? <a className="px-2 py-2 text-sm font-semibold text-blue-700 underline" href={club.website}>Club website</a> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
