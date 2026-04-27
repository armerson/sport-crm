import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fetchClubSettings } from '../services/forms.ts'
import { fetchGuestProduct, startGuestCheckout, type GuestProductInfo } from '../services/guestCheckout.ts'
import type { ClubSettings } from '../types/forms.ts'
import { formatPence } from '../lib/pricing.ts'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function GuestCampCheckoutPage() {
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const cancelled = searchParams.get('cancelled') === '1'

  const [club, setClub] = useState<ClubSettings>({ name: 'My Club', logoUrl: null, primaryColor: '#123524' })
  const [product, setProduct] = useState<GuestProductInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [childName, setChildName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    void fetchClubSettings().then(setClub)
  }, [])

  useEffect(() => {
    if (!productId || !UUID_RE.test(productId)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    void fetchGuestProduct(productId)
      .then(setProduct)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [productId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) return
    setError(null)
    setSubmitting(true)
    try {
      await startGuestCheckout({
        productId,
        guardianEmail: guardianEmail.trim(),
        guardianName: guardianName.trim(),
        childName: childName.trim(),
        childDob: childDob.trim(),
        notes: notes.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    )
  }

  if (notFound || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <p className="text-lg font-semibold text-slate-800">Offer not found</p>
        <p className="mt-2 text-sm text-slate-500">This payment link may be wrong or the product is no longer available.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          {club.logoUrl ? (
            <img src={club.logoUrl} alt={club.name} className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-md" />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#123524] shadow-md">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                <path d="M2 12h20" />
              </svg>
            </div>
          )}
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">{club.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{product.name}</h1>
          {product.description ? (
            <p className="mt-2 text-sm text-slate-600">{product.description}</p>
          ) : null}
          <p className="mt-3 text-lg font-semibold text-[#123524]">{formatPence(product.pricePence)}</p>
          <p className="mt-1 text-xs text-slate-500">Secure payment by card (Stripe). No club login required.</p>
        </div>

        {cancelled ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            Payment was cancelled. You can try again below.
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-5 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-900/8 backdrop-blur-sm"
        >
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Parent / guardian name <span className="text-rose-500">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#123524]/20 focus:border-[#123524]/40"
              required
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#123524]/20 focus:border-[#123524]/40"
              type="email"
              required
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <p className="mt-1 text-xs text-slate-400">Receipt and updates will be sent here.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Participant name <span className="text-rose-500">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#123524]/20 focus:border-[#123524]/40"
              required
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Child or participant full name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Date of birth <span className="text-rose-500">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#123524]/20 focus:border-[#123524]/40"
              type="date"
              required
              value={childDob}
              onChange={(e) => setChildDob(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Notes (optional)</label>
            <textarea
              className="min-h-[72px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#123524]/20 focus:border-[#123524]/40"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, second contact, or other info for the club"
              maxLength={2000}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[#123524] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#1a4d35] disabled:opacity-60"
          >
            {submitting ? 'Redirecting to secure payment…' : `Continue to pay ${formatPence(product.pricePence)}`}
          </button>

          <p className="text-center text-xs text-slate-400">
            You will complete payment on Stripe’s secure page. The club receives your details and payment confirmation.
          </p>
        </form>
      </div>
    </div>
  )
}

export function GuestCampSuccessPage() {
  const [club, setClub] = useState<ClubSettings>({ name: 'My Club', logoUrl: null, primaryColor: '#123524' })

  useEffect(() => {
    void fetchClubSettings().then(setClub)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 px-6 py-10 shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-lg font-bold text-emerald-900">Payment successful</p>
          <p className="mt-2 text-sm text-emerald-800">
            Thank you. {club.name} has received your payment and registration details. You should get a confirmation email from Stripe; the club may follow up separately.
          </p>
        </div>
        <p className="mt-8 text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-[#123524] hover:underline">
            Sign in
          </Link>
          {' '}if you already have a club account.
        </p>
      </div>
    </div>
  )
}
