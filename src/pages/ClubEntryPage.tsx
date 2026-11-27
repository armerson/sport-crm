import { useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { activeClub, clubOSMode, clubRegistry } from '../clubos/runtime.ts'
import { findClub } from '../clubos/registry.ts'
import { parseClubEntryPath } from '../clubos/session.ts'

function EntryMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-16 text-slate-950">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-600">{body}</p>
      <Link to="/clubs" className="mt-6 inline-block rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Find your club</Link>
    </main>
  )
}

function ExternalRedirect({ href }: { href: string }) {
  useEffect(() => { window.location.replace(href) }, [href])
  return <p className="p-8 text-slate-600">Opening your club…</p>
}

/**
 * Club-specific links: `/clubs/<code>`, `/clubs/<code>/register`,
 * `/clubs/<code>/join/<invite>` and similar. Only allow-listed public entry
 * routes are opened; everything else is refused.
 */
export function ClubEntryPage() {
  const location = useLocation()
  const entry = parseClubEntryPath(location.pathname)
  const club = findClub(clubRegistry, entry?.code)

  if (!entry || !club) {
    return <EntryMessage title="We couldn't find that club" body="The link may be out of date. Search for your club instead." />
  }
  if (!entry.path) {
    return <EntryMessage title="This link can't be opened" body={`Ask ${club.name} for a new link, or find the club below.`} />
  }

  // The runtime has already selected this club before the backend client was
  // created. Keep search and hash so email confirmation tokens survive.
  if (clubOSMode === 'multi' && activeClub?.code === club.code) {
    return <Navigate replace to={`${entry.path}${location.search}${location.hash}`} />
  }
  if (club.origin) {
    return <ExternalRedirect href={new URL(entry.path, club.origin).href} />
  }
  return <EntryMessage title={`${club.name} isn't available here yet`} body="Use the link your club sent you, or contact the club." />
}
