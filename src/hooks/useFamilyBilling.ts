import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import { calculateFamilyPrice } from '../lib/pricing.ts'
import {
  fetchFamilySubscription,
  fetchOneOffPayments,
  fetchPlayerProductsForParent,
  fetchPricingRules,
} from '../services/payments.ts'
import type { FamilySubscription, OneOffPayment, PlayerProduct, PricingResult, PricingRule } from '../types/payments.ts'
import type { PlayerRecord } from '../types/club.ts'

export function useFamilyBilling(players: PlayerRecord[]) {
  const [rules, setRules] = useState<PricingRule[]>([])
  const [assignments, setAssignments] = useState<PlayerProduct[]>([])
  const [subscription, setSubscription] = useState<FamilySubscription | null>(null)
  const [oneOffPayments, setOneOffPayments] = useState<OneOffPayment[]>([])
  const [pricing, setPricing] = useState<PricingResult | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const playerIds = players.map((p) => p.id)
  const playerKey = playerIds.join(',')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError(supabaseConfigError)
      setLoading(false)
      return
    }
    if (!players.length) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [fetchedRules, fetchedAssignments] = await Promise.all([
          fetchPricingRules(),
          fetchPlayerProductsForParent(playerIds),
        ])

        setRules(fetchedRules)
        setAssignments(fetchedAssignments)

        // Build pricing assignments
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
  }, [playerKey])

  // Load subscription and one-off payments (separate effect, non-critical)
  useEffect(() => {
    if (!isSupabaseConfigured || !players.length) return

    async function loadPaymentHistory(parentId: string) {
      try {
        const [sub, oneOffs] = await Promise.all([
          fetchFamilySubscription(parentId),
          fetchOneOffPayments(parentId),
        ])
        setSubscription(sub)
        setOneOffPayments(oneOffs)
      } catch {
        // Non-critical, don't surface error
      }
    }

    // We don't have parentId here directly; this hook is called from
    // ParentPortal which has profile.id — pass it in via the players array's
    // parent context. For now the parent portal calls this differently.
    // This will be wired up properly in the billing card component.
    void loadPaymentHistory
  }, [playerKey, players.length])

  return {
    rules,
    assignments,
    subscription,
    oneOffPayments,
    pricing,
    loading,
    error,
  }
}
