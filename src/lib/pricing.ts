/**
 * Pricing Calculation Engine
 *
 * Pure functions — no Supabase or Stripe dependency.
 * All amounts are integer pence (e.g. 2500 = £25.00).
 *
 * Rule application order:
 *   1. Sort players by product price descending (highest → full price)
 *   2. Apply tiered sibling discounts per child index
 *   3. Apply family monthly cap (if active, monthly total only)
 */

import type {
  BillingType,
  FamilyCapConfig,
  PricingLineItem,
  PricingResult,
  PricingRule,
  TieredDiscountConfig,
} from '../types/payments.ts'

export interface PricingAssignment {
  playerId: string
  playerName: string
  productId: string
  productName: string
  pricePence: number
  billingType: BillingType
}

/**
 * Calculate the full family billing result, applying all active pricing rules.
 *
 * - Monthly and one-off products are priced separately.
 * - Tiered discounts apply to MONTHLY products only (sorted by price desc per child).
 * - Family cap applies to the monthly total only.
 * - One-off products are always at full price (no sibling discount).
 */
export function calculateFamilyPrice(
  assignments: PricingAssignment[],
  rules: PricingRule[],
): PricingResult {
  if (assignments.length === 0) {
    return {
      lineItems: [],
      subtotalPence: 0,
      totalDiscountPence: 0,
      totalPence: 0,
      capApplied: false,
      monthlyPence: 0,
      oneOffPence: 0,
    }
  }

  const tieredRule = rules.find((r) => r.type === 'tiered_discount' && r.active) ?? null
  const capRule = rules.find((r) => r.type === 'family_cap' && r.active) ?? null

  // ── Monthly products ──────────────────────────────────────────────────────
  // Group by player: take the highest-price monthly product per player for
  // sort ordering (the "primary" product that earns the full-price slot).
  // In practice most clubs assign one membership product per player.
  const monthlyAssignments = assignments.filter((a) => a.billingType === 'monthly')

  // Sort by price descending → 1st child gets full price, siblings get discounts
  const sortedMonthly = [...monthlyAssignments].sort((a, b) => b.pricePence - a.pricePence)

  // Build a per-player child-index map (0-based: 0 = most expensive = no discount)
  const playerIndexMap = new Map<string, number>()
  sortedMonthly.forEach((a) => {
    if (!playerIndexMap.has(a.playerId)) {
      playerIndexMap.set(a.playerId, playerIndexMap.size)
    }
  })

  const monthlyLineItems: PricingLineItem[] = sortedMonthly.map((assignment) => {
    const childIndex = playerIndexMap.get(assignment.playerId) ?? 0
    const discountPct = getDiscountPct(childIndex, tieredRule)
    const discountPence = Math.round((assignment.pricePence * discountPct) / 100)
    const finalPricePence = assignment.pricePence - discountPence

    return {
      playerId: assignment.playerId,
      playerName: assignment.playerName,
      productId: assignment.productId,
      productName: assignment.productName,
      billingType: 'monthly',
      basePricePence: assignment.pricePence,
      discountPct,
      discountPence,
      finalPricePence,
    }
  })

  // ── One-off products ──────────────────────────────────────────────────────
  const oneOffLineItems: PricingLineItem[] = assignments
    .filter((a) => a.billingType === 'one_off')
    .map((assignment) => ({
      playerId: assignment.playerId,
      playerName: assignment.playerName,
      productId: assignment.productId,
      productName: assignment.productName,
      billingType: 'one_off',
      basePricePence: assignment.pricePence,
      discountPct: 0,
      discountPence: 0,
      finalPricePence: assignment.pricePence,
    }))

  // ── Totals ────────────────────────────────────────────────────────────────
  const allLineItems = [...monthlyLineItems, ...oneOffLineItems]

  const monthlySubtotal = monthlyLineItems.reduce((s, i) => s + i.basePricePence, 0)
  let monthlyTotal = monthlyLineItems.reduce((s, i) => s + i.finalPricePence, 0)
  const oneOffTotal = oneOffLineItems.reduce((s, i) => s + i.finalPricePence, 0)

  // Apply family cap to monthly total only
  let capApplied = false
  if (capRule) {
    const { amountPence } = capRule.config as FamilyCapConfig
    if (monthlyTotal > amountPence) {
      monthlyTotal = amountPence
      capApplied = true
    }
  }

  const subtotalPence = monthlySubtotal + oneOffTotal
  const totalPence = monthlyTotal + oneOffTotal
  const totalDiscountPence = subtotalPence - totalPence

  return {
    lineItems: allLineItems,
    subtotalPence,
    totalDiscountPence,
    totalPence,
    capApplied,
    monthlyPence: monthlyTotal,
    oneOffPence: oneOffTotal,
  }
}

/**
 * Get the discount percentage for a child at a given index.
 * childIndex 0 = first child (always full price).
 * Returns 0 if no tiered rule is active or no tier found for this index.
 */
function getDiscountPct(childIndex: number, rule: PricingRule | null): number {
  if (!rule || childIndex === 0) return 0
  const config = rule.config as TieredDiscountConfig
  // Find exact tier match, or fall back to the last defined tier for children beyond the list
  const sorted = [...config.tiers].sort((a, b) => a.childIndex - b.childIndex)
  const match = sorted.find((t) => t.childIndex === childIndex)
  if (match) return match.discountPct
  // Apply last tier's discount to all children beyond the configured range
  const last = sorted[sorted.length - 1]
  if (last && childIndex > last.childIndex) return last.discountPct
  return 0
}

// ── Formatting helpers ────────────────────────────────────────────────────

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

/** Format pence as £X.XX */
export function formatPence(pence: number): string {
  return GBP.format(pence / 100)
}

/** Parse a £ string like "25.00" or "£25" to pence integer */
export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100)
}

/** Convert pence to pounds float for display/form inputs */
export function penceToPounds(pence: number): number {
  return pence / 100
}
