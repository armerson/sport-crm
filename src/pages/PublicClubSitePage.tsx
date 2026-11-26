import { Link } from 'react-router-dom'
import { parsePublicClubSite } from '../utils/clubDirectory.ts'

function loadSite() {
  try { return parsePublicClubSite(import.meta.env.VITE_CLUB_PUBLIC_SITE_JSON) } catch { return null }
}
const site = loadSite()

export function PublicClubSitePage() {
  if (!site) return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Club website unavailable</h1><p className="mt-2">This club has not published a ClubOS website.</p><Link to="/login" className="mt-4 inline-block underline">Member sign in</Link></main>
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-t-8 bg-white" style={{ borderColor: site.primaryColor }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <span className="text-xl font-bold">{site.name}</span>
          <nav aria-label="Club links" className="flex gap-4 text-sm font-semibold">
            <a href="#about">About</a><a href="#programmes">Programmes</a><Link to="/login">Member sign in</Link>
          </nav>
        </div>
      </header>
      <section className="bg-slate-900 px-5 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-300">Welcome to</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-6xl">{site.name}</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-200">{site.introduction}</p>
          <Link to="/register" className="mt-8 inline-block rounded-xl bg-white px-6 py-3 font-bold text-slate-950">Join the club</Link>
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-12 px-5 py-12">
        <section id="about"><h2 className="text-2xl font-bold">About us</h2><p className="mt-4 whitespace-pre-line leading-relaxed text-slate-700">{site.about}</p></section>
        <section id="programmes"><h2 className="text-2xl font-bold">Our programmes</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{site.programmes.map((programme, index) => <div key={index} className="rounded-xl border border-slate-200 bg-white p-5 font-semibold">{programme}</div>)}</div></section>
        {site.contactEmail ? <section><h2 className="text-2xl font-bold">Contact us</h2><a className="mt-3 inline-block break-all underline" href={'mailto:' + site.contactEmail}>{site.contactEmail}</a></section> : null}
      </div>
      <footer className="border-t border-slate-200 px-5 py-6 text-center text-sm text-slate-600">{site.name} · Powered by ClubOS</footer>
    </main>
  )
}
