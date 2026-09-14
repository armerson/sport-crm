import { publicWebsiteUrl } from '../utils/website.ts'
import { Link } from 'react-router-dom'
import { useClubSettings } from '../hooks/useClubSettings.ts'

export function RegistrationLandingPage() {
  const { settings } = useClubSettings()
  const websiteUrl = publicWebsiteUrl(import.meta.env.VITE_CLUB_WEBSITE_URL)
  const initials = settings.name.split(' ').map((part) => part[0]).join('').slice(0, 3).toUpperCase()
  return (
    <main className="min-h-screen bg-[#f5f7fa] px-5 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-bold text-slate-900">
            {settings.logoUrl ? <img src={settings.logoUrl} alt="" className="h-11 w-11 object-contain" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#12243b] text-white" style={{ backgroundColor: settings.primaryColor }}>{initials}</span>}
            {settings.name}
          </div>
          <Link to="/login" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Already a member? Sign in →</Link>
        </header>
        <section className="mt-8 overflow-hidden rounded-[2rem] bg-[#12243b] px-6 py-10 text-white sm:px-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Your club. Your community.</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Your place in the club<br />starts here.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Be part of the team. Create your account, tell us who’s playing, and we’ll help you find the right team.</p>
        </section>
        <section aria-labelledby="registration-heading" className="mt-8">
          <h2 id="registration-heading" className="text-xl font-bold tracking-tight text-slate-900">Who are you registering?</h2>
          <p className="mt-1 text-sm text-slate-500">Choose a route below. You’ll need an email address and the player’s date of birth.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              { kind: 'parent', number: '01', title: 'My child or children', description: 'For parents and guardians registering players under 18. Manage your children from one family account.', action: 'Register as a parent' },
              { kind: 'player', number: '02', title: 'Myself as a player', description: 'For players aged 18 and over. Manage your own schedule, team updates and club payments.', action: 'Register as a player' },
            ].map((route) => <Link key={route.kind} to={`/login?mode=register&kind=${route.kind}`} className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-blue-400 hover:shadow-lg hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
              <span style={{ color: settings.primaryColor }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-xs font-bold">{route.number}</span>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{route.title}</h3>
              <p className="mb-6 mt-2 text-sm leading-6 text-slate-500">{route.description}</p>
              <span style={{ color: settings.primaryColor }} className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold">{route.action}<span aria-hidden="true">→</span></span>
            </Link>)}
          </div>
        </section>
        <ol className="mt-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-3">
          {['Create your account', 'The club reviews your details', 'Get connected to your team'].map((step, index) => <li key={step} className="flex items-start gap-2.5 text-slate-600"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{index + 1}</span>{step}</li>)}
        </ol>
        <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 text-xs leading-6 text-slate-500">
          <p>Coaches and volunteers: contact the club to arrange access.</p>
          {websiteUrl ? <a href={websiteUrl} className="font-semibold hover:text-blue-700">← Back to the club website</a> : <span>Powered by ClubOS</span>}
        </footer>
      </div>
    </main>
  )
}
