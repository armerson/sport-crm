// All monetary values stored as integer pence (e.g. 2500 = £25.00)

export type BillingType = 'monthly' | 'one_off'

export type PricingRuleType = 'tiered_discount' | 'family_cap'

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'incomplete' | 'trialing' | 'paused'

export type OneOffPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

// ── Products ──────────────────────────────────

export interface Product {
  id: string
  name: string
  description: string | null
  pricePence: number
  billingType: BillingType
  teamId: string | null
  active: boolean
  stripeProductId: string | null
  stripePriceId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductFormInput {
  name: string
  description: string
  pricePence: number
  billingType: BillingType
  teamId: string | null
}

// ── Pricing Rules ─────────────────────────────

export interface TieredDiscountTier {
  childIndex: number  // 0-based: 0 = 1st child (full price), 1 = 2nd child, etc.
  discountPct: number // 0-100
}

export interface TieredDiscountConfig {
  tiers: TieredDiscountTier[]
}

export interface FamilyCapConfig {
  amountPence: number
}

export type PricingRuleConfig = TieredDiscountConfig | FamilyCapConfig

export interface PricingRule {
  id: string
  type: PricingRuleType
  config: PricingRuleConfig
  active: boolean
  label: string | null
  createdAt: string
}

// ── Player–Product Assignments ────────────────

export interface PlayerProduct {
  id: string
  playerId: string
  productId: string
  assignedBy: string | null
  assignedAt: string
  endsAt: string | null
  product: Product
}

// ── Pricing Engine Output ─────────────────────

export interface PricingLineItem {
  playerId: string
  playerName: string
  productId: string
  productName: string
  billingType: BillingType
  basePricePence: number
  discountPct: number
  discountPence: number
  finalPricePence: number
}

export interface PricingResult {
  lineItems: PricingLineItem[]
  /** Sum of all base prices before discounts */
  subtotalPence: number
  /** Total discount applied (tiered + cap) */
  totalDiscountPence: number
  /** Final amount charged */
  totalPence: number
  /** True if a family cap rule capped the total */
  capApplied: boolean
  /** Breakdown: monthly items only */
  monthlyPence: number
  /** Breakdown: one-off items */
  oneOffPence: number
}

// ── Subscriptions ─────────────────────────────

export interface FamilySubscription {
  id: string
  parentId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  status: SubscriptionStatus
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  totalPence: number
  createdAt: string
  updatedAt: string
}

export interface SubscriptionItem {
  id: string
  subscriptionId: string
  playerId: string
  productId: string
  stripeSubscriptionItemId: string | null
  basePricePence: number
  discountPct: number
  discountPence: number
  finalPricePence: number
}

// ── One-off Payments ──────────────────────────

export interface OneOffPayment {
  id: string
  parentId: string
  playerId: string | null
  productId: string | null
  stripePaymentIntentId: string | null
  stripeInvoiceId: string | null
  amountPence: number
  status: OneOffPaymentStatus
  paidAt: string | null
  createdAt: string
}

// ── Admin UI helpers ──────────────────────────

/** Full family billing picture for admin overview */
export interface FamilyBillingSummary {
  parentId: string
  parentName: string
  parentEmail: string
  stripeCustomerId: string | null
  subscriptionStatus: SubscriptionStatus | null
  children: {
    playerId: string
    playerName: string
    assignments: PlayerProduct[]
  }[]
  pricing: PricingResult
}
