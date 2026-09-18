import { useEffect, useState } from 'react'
import { calculateFamilyPrice, formatPence } from '../../lib/pricing.ts'
import {
  fetchFamilySubscription,
  fetchOneOffPayments,
  fetchPlayerProductsForParent,
  fetchPricingRules,
} from '../../services/payments.ts'
import { redirectToCheckout, redirectToPortal } from '../../services/stripe.ts'
import { isSupabaseConfigured } from '../../lib/supabase.ts'
import type { FamilySubscription, OneOffPayment, PlayerProduct, PricingResult, PricingRule } from '../../types/payments.ts'
import type { PlayerRecord } from '../../types/club.ts'
import type { UserProfile } from '../../types/auth.ts'
import { Button } from '../ui/Button.tsx'

interface FamilyBillingCardProps {
  profile: UserProfile
  players: PlayerRecord[]
}

function SubscriptionStatusBadge({ status }: { status: FamilySubscription['status'] }) {
  const styles: Record<FamilySubscription['status'], string> = {
    active: 'bg-emerald-100 text-emerald-800',
    past_due: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
    incomplete: 'bg-amber-100 text-amber-700',
    trialing: 'bg-blue-100 text-blue-700',
    paused: 'bg-slate-100 text-slate-500',
  }
  const labels: Record<FamilySubscription['status'], string> = {
    active: 'Active',
    past_due: 'Payment overdue',
    cancelled: 'Cancelled',
    incomplete: 'Setup required',
    trialing: 'Trial',
    paused: 'Paused',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export function FamilyBillingCard({ profile, players }: FamilyBillingCardProps) {
  const [rules, setRules] = useState<PricingRule[]>([])
  const [assignments, setAssignments] = useState<PlayerProduct[]>([])
  const [subscription, setSubscription] = useState<FamilySubscription | null>(null)
  const [oneOffPayments, setOneOffPayments] = useState<OneOffPayment[]>([])
  const [pricing, setPricing] = useState<PricingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stripeLoading, setStripeLoading] = useState<'subscription' | 'payment' | 'portal' | null>(null)
  const [stripeError, setStripeError] = useState<string | null>(null)

  const playerIds = players.map((p) => p.id)

  useEffect(() => {
    if (!isSupabaseConfigured || !players.length) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [fetchedRules, fetchedAssignments, sub, oneOffs] = await Promise.all([
          fetchPricingRules(),
          fetchPlayerProductsForParent(playerIds),
          fetchFamilySubscription(profile.id),
          fetchOneOffPayments(profile.id),
        ])

        setRules(fetchedRules)
        setAssignments(fetchedAssignments)
        setSubscription(sub)
        setOneOffPayments(oneOffs)

        const playerMap = new Map(players.map((p) => [p.id, p.name]))
        const pricingAssignments = fetchedAssignments.map((a) => ({
          playerId: a.playerId,
          playerName: playerMap.get(a.playerId) ?? 'Unknown',
          productId: a.productId,
          productName: a.product.name,
          pricePence: a.product.pricePence,
          billingType: a.product.billingType,
        }))

        setPricing(calculateFamilyPrice(pricingAssignments, fetchedRules))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing.')
      } finally {
        setLoading(false)
      }
    }

    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, playerIds.join(',')])

  if (loading) {
    return (
      <div className="ui-module" aria-label="Loading family billing">
        <div className="ui-module-header space-y-2"><div className="ui-skeleton h-4 w-24 rounded-lg" /><div className="ui-skeleton h-7 w-44 rounded-lg" /></div>
        <div className="ui-module-body space-y-3"><div className="ui-skeleton h-24 rounded-xl" /><div className="ui-skeleton h-20 rounded-xl" /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ui-module">
        <div className="ui-module-body"><p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p></div>
      </div>
    )
  }

  async function handleStripeAction(action: 'subscription' | 'payment' | 'portal') {
    setStripeError(null)
    setStripeLoading(action)
    try {
      if (action === 'portal') {
        await redirectToPortal()
      } else {
        await redirectToCheckout(action)
      }
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStripeLoading(null)
    }
  }

  const hasAssignments = assignments.length > 0
  const activeRules = rules.filter((r) => r.active)
  const hasMonthlyProducts = assignments.some((a) => a.product.billingType === 'monthly')
  const hasOneOffProducts = assignments.some((a) => a.product.billingType === 'one_off' || a.product.billingType === 'membership')
  const subscriptionActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const hasStripeAccount = !!subscription?.stripeCustomerId

  return (
    <section className="ui-module ui-view-enter">
      {/* Header */}
      <div className="ui-module-header flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-accent)]">Payments</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Family billing</h2>
          <p className="mt-0.5 text-sm text-slate-500">Your current club fees and payment status.</p>
        </div>
        {subscription && <SubscriptionStatusBadge status={subscription.status} />}
      </div>

      <div className="ui-module-body space-y-5">
      {!hasAssignments ? (
        <div className="ui-empty">
          <p className="font-semibold text-slate-700">No fees assigned</p>
          <p className="mt-1">Contact your club admin if you think something is missing.</p>
        </div>
      ) : (
        <>
          {/* Monthly total */}
          {pricing && pricing.monthlyPence > 0 && (
            <div className="rounded-xl border border-[var(--ui-accent)]/20 bg-[var(--ui-accent)]/[0.045] p-4 sm:p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly total</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--ui-accent)]">
                    {formatPence(pricing.monthlyPence)}
                    <span className="ml-1 text-base font-normal text-slate-400">/month</span>
                  </p>
                </div>
                {pricing.totalDiscountPence > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400 line-through">{formatPence(pricing.subtotalPence)}</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      saving {formatPence(pricing.totalDiscountPence)}
                      {pricing.capApplied && ' (cap)'}
                    </p>
                  </div>
                )}
              </div>

              {/* Active discount labels */}
              {activeRules.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeRules.map((r) => (
                    <span key={r.id} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      {r.label ?? r.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Per-child breakdown */}
          <div className="space-y-3">
            {players.map((player) => {
              const playerAssignments = assignments.filter((a) => a.playerId === player.id)
              if (!playerAssignments.length) return null

              const playerLineItems = pricing?.lineItems.filter((li) => li.playerId === player.id) ?? []

              return (
                <article key={player.id} className="rounded-xl border border-[var(--ui-border)] bg-white p-4 shadow-[0_1px_2px_#10182808]">
                  <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{player.name.charAt(0)}</span><p className="font-semibold text-slate-900">{player.name}</p></div>
                  <div className="mt-2 divide-y divide-slate-50">
                    {playerLineItems.map((item) => (
                      <div key={`${item.playerId}-${item.productId}`} className="flex items-center justify-between py-1.5">
                        <div>
                          <span className="text-sm text-slate-700">{item.productName}</span>
                          {item.discountPct > 0 && (
                            <span className="ml-2 text-xs text-emerald-600">{item.discountPct}% sibling discount</span>
                          )}
                        </div>
                        <div className="text-right">
                          {item.discountPct > 0 && (
                            <p className="text-xs text-slate-400 line-through">{formatPence(item.basePricePence)}</p>
                          )}
                          <p className="text-sm font-semibold text-slate-800">
                            {formatPence(item.finalPricePence)}
                            {item.billingType === 'monthly' && <span className="font-normal text-slate-400">/mo</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>

          {/* One-off payments history */}
          {oneOffPayments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">One-off payments</p>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
                {oneOffPayments.slice(0, 5).map((payment) => {
                  const assignment = assignments.find((a) => a.productId === payment.productId)
                  return (
                    <div key={payment.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{assignment?.product.name ?? 'Payment'}</p>
                        <p className="text-xs text-slate-400">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Pending'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800">{formatPence(payment.amountPence)}</p>
                        <span className={`text-xs font-semibold ${
                          payment.status === 'paid' ? 'text-emerald-600' :
                          payment.status === 'failed' ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stripe action buttons */}
          {stripeError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {stripeError}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {/* Monthly subscription setup */}
            {hasMonthlyProducts && !subscriptionActive && (
              <Button
                className="w-full sm:w-auto"
                disabled={stripeLoading !== null}
                onClick={() => void handleStripeAction('subscription')}
                type="button"
                loading={stripeLoading === 'subscription'}
              >
                {stripeLoading !== 'subscription' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                ) : null}
                Set up monthly payments
              </Button>
            )}

            {/* One-off / membership payment */}
            {hasOneOffProducts && (
              <Button
                className="w-full sm:w-auto"
                disabled={stripeLoading !== null}
                onClick={() => void handleStripeAction('payment')}
                type="button"
                loading={stripeLoading === 'payment'}
              >
                {stripeLoading !== 'payment' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                ) : null}
                Pay outstanding fees
              </Button>
            )}

            {/* Billing portal (manage existing subscription) */}
            {hasStripeAccount && (
              <Button
                className="w-full sm:w-auto"
                disabled={stripeLoading !== null}
                onClick={() => void handleStripeAction('portal')}
                type="button"
                variant="secondary"
                loading={stripeLoading === 'portal'}
              >
                {stripeLoading !== 'portal' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                ) : null}
                Manage billing ↗
              </Button>
            )}
          </div>
        </>
      )}
      </div>
    </section>
  )
}
