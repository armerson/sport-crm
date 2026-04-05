import { useEffect, useState } from 'react'
import { calculateFamilyPrice, formatPence } from '../../lib/pricing.ts'
import {
  fetchFamilySubscription,
  fetchOneOffPayments,
  fetchPlayerProductsForParent,
  fetchPricingRules,
} from '../../services/payments.ts'
import { isSupabaseConfigured } from '../../lib/supabase.ts'
import type { FamilySubscription, OneOffPayment, PlayerProduct, PricingResult, PricingRule } from '../../types/payments.ts'
import type { PlayerRecord } from '../../types/club.ts'
import type { UserProfile } from '../../types/auth.ts'

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
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        <p className="text-sm text-slate-500">Loading billing…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        <p className="text-sm text-rose-600">{error}</p>
      </div>
    )
  }

  const hasAssignments = assignments.length > 0
  const activeRules = rules.filter((r) => r.active)

  return (
    <div className="space-y-4 rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Family billing</h2>
          <p className="mt-0.5 text-sm text-slate-500">Your current club fees and payment status.</p>
        </div>
        {subscription && <SubscriptionStatusBadge status={subscription.status} />}
      </div>

      {!hasAssignments ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">No products have been assigned to your children yet.</p>
          <p className="mt-1 text-xs text-slate-400">Contact your club admin if you think this is wrong.</p>
        </div>
      ) : (
        <>
          {/* Monthly total */}
          {pricing && pricing.monthlyPence > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-[#123524]/5 to-white p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly total</p>
                  <p className="mt-1 text-3xl font-bold text-[#123524]">
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
                <div key={player.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="font-semibold text-slate-900">{player.name}</p>
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
                </div>
              )
            })}
          </div>

          {/* One-off payments history */}
          {oneOffPayments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">One-off payments</p>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
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

          {/* Stripe portal placeholder */}
          {subscription?.stripeSubscriptionId && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">
                To update your payment method or download invoices, use the{' '}
                <span className="font-semibold text-slate-800">billing portal</span> (coming with Stripe setup).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
