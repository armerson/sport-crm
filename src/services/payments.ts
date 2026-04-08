import { requireSupabase } from './supabaseHelpers.ts'
import { calculateFamilyPrice } from '../lib/pricing.ts'
import type {
  FamilyBillingSummary,
  FamilySubscription,
  OneOffPayment,
  PlayerProduct,
  PricingRule,
  Product,
  ProductFormInput,
  SubscriptionItem,
} from '../types/payments.ts'
import type { PricingAssignment } from '../lib/pricing.ts'

export interface SimplePlayer {
  id: string
  name: string
  teamNames: string[]
}

// ── Row mappers ──────────────────────────────────────────────────────────

function mapProductRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    pricePence: row.price_pence as number,
    billingType: row.billing_type as Product['billingType'],
    durationMonths: (row.duration_months as number | null) ?? null,
    seasonLabel: (row.season_label as string | null) ?? null,
    teamId: (row.team_id as string | null) ?? null,
    active: row.active as boolean,
    stripeProductId: (row.stripe_product_id as string | null) ?? null,
    stripePriceId: (row.stripe_price_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapPricingRuleRow(row: Record<string, unknown>): PricingRule {
  return {
    id: row.id as string,
    type: row.type as PricingRule['type'],
    config: row.config as PricingRule['config'],
    active: row.active as boolean,
    label: (row.label as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

function mapPlayerProductRow(row: Record<string, unknown>): PlayerProduct {
  const productRow = row.products as Record<string, unknown>
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    productId: row.product_id as string,
    assignedBy: (row.assigned_by as string | null) ?? null,
    assignedAt: row.assigned_at as string,
    endsAt: (row.ends_at as string | null) ?? null,
    product: mapProductRow(productRow),
  }
}

// ── All players ───────────────────────────────────────────────────────────

export async function fetchAllPlayers(): Promise<SimplePlayer[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('players')
    .select('id, name, player_teams(teams(id, name))')
    .order('name')

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const playerTeams = (r.player_teams as { teams: { id: string; name: string } | null }[]) ?? []
    return {
      id: r.id as string,
      name: r.name as string,
      teamNames: playerTeams.map((pt) => pt.teams?.name ?? '').filter(Boolean),
    }
  })
}

// ── Products ──────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('products')
    .select('*')
    .order('billing_type', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapProductRow(row as Record<string, unknown>))
}

export async function createProduct(input: ProductFormInput): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('products').insert({
    name: input.name,
    description: input.description || null,
    price_pence: input.pricePence,
    billing_type: input.billingType,
    duration_months: input.billingType === 'monthly' && input.durationMonths ? parseInt(input.durationMonths) : null,
    season_label: input.billingType === 'membership' && input.seasonLabel ? input.seasonLabel : null,
    team_id: input.teamId || null,
  })
  if (error) throw new Error(error.message)
}

export async function updateProduct(id: string, input: Partial<ProductFormInput>): Promise<void> {
  const client = requireSupabase()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description || null
  if (input.pricePence !== undefined) patch.price_pence = input.pricePence
  if (input.billingType !== undefined) {
    patch.billing_type = input.billingType
    patch.duration_months = input.billingType === 'monthly' && input.durationMonths ? parseInt(input.durationMonths) : null
    patch.season_label = input.billingType === 'membership' && input.seasonLabel ? input.seasonLabel : null
  }
  if (input.teamId !== undefined) patch.team_id = input.teamId || null

  const { error } = await client.from('products').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('products')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Pricing Rules ─────────────────────────────────────────────────────────

export async function fetchPricingRules(): Promise<PricingRule[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('pricing_rules').select('*').order('type')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapPricingRuleRow(row as Record<string, unknown>))
}

export async function updatePricingRule(
  id: string,
  patch: { config?: PricingRule['config']; active?: boolean; label?: string },
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('pricing_rules').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Player–Product Assignments ────────────────────────────────────────────

export async function fetchAllPlayerProducts(): Promise<PlayerProduct[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_products')
    .select('*, products(*)')
    .order('assigned_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapPlayerProductRow(row as Record<string, unknown>))
}

export async function fetchPlayerProductsForParent(playerIds: string[]): Promise<PlayerProduct[]> {
  if (!playerIds.length) return []
  const client = requireSupabase()
  const { data, error } = await client
    .from('player_products')
    .select('*, products(*)')
    .in('player_id', playerIds)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapPlayerProductRow(row as Record<string, unknown>))
}

export async function assignProduct(playerId: string, productId: string, assignedBy: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('player_products').insert({
    player_id: playerId,
    product_id: productId,
    assigned_by: assignedBy,
  })
  if (error) throw new Error(error.message)
}

export async function removeAssignment(playerId: string, productId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('player_products')
    .delete()
    .eq('player_id', playerId)
    .eq('product_id', productId)
  if (error) throw new Error(error.message)
}

// ── Family Subscriptions ──────────────────────────────────────────────────

export async function fetchFamilySubscription(parentId: string): Promise<FamilySubscription | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('family_subscriptions')
    .select('*')
    .eq('parent_id', parentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as Record<string, unknown>
  return {
    id: row.id as string,
    parentId: row.parent_id as string,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    status: row.status as FamilySubscription['status'],
    currentPeriodStart: (row.current_period_start as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    totalPence: row.total_pence as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function fetchSubscriptionItems(subscriptionId: string): Promise<SubscriptionItem[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('subscription_items')
    .select('*')
    .eq('subscription_id', subscriptionId)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      subscriptionId: r.subscription_id as string,
      playerId: r.player_id as string,
      productId: r.product_id as string,
      stripeSubscriptionItemId: (r.stripe_subscription_item_id as string | null) ?? null,
      basePricePence: r.base_price_pence as number,
      discountPct: r.discount_pct as number,
      discountPence: r.discount_pence as number,
      finalPricePence: r.final_price_pence as number,
    }
  })
}

export async function fetchOneOffPayments(parentId: string): Promise<OneOffPayment[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('one_off_payments')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      parentId: r.parent_id as string,
      playerId: (r.player_id as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      stripePaymentIntentId: (r.stripe_payment_intent_id as string | null) ?? null,
      stripeInvoiceId: (r.stripe_invoice_id as string | null) ?? null,
      amountPence: r.amount_pence as number,
      status: r.status as OneOffPayment['status'],
      paidAt: (r.paid_at as string | null) ?? null,
      createdAt: r.created_at as string,
    }
  })
}

// ── Admin: Family Billing Overview ────────────────────────────────────────

/**
 * Build the full billing picture for every parent in the club.
 * Used by the admin billing overview tab.
 */
export async function fetchFamilyBillingSummaries(rules: PricingRule[]): Promise<FamilyBillingSummary[]> {
  const client = requireSupabase()

  // 1. All parents with their Stripe customer IDs and subscription status
  const { data: parentRows, error: parentError } = await client
    .from('profiles')
    .select('id, name, email')
    .eq('role', 'parent')
    .order('name')

  if (parentError) throw new Error(parentError.message)
  const parents = (parentRows ?? []) as { id: string; name: string; email: string }[]

  if (!parents.length) return []

  // 2. All player–parent relationships
  const { data: ppRows, error: ppError } = await client
    .from('player_parents')
    .select('player_id, parent_id, players(id, name)')

  if (ppError) throw new Error(ppError.message)

  // 3. All player–product assignments with product details
  const { data: assignmentRows, error: assignmentError } = await client
    .from('player_products')
    .select('player_id, product_id, assigned_at, ends_at, assigned_by, id, products(*)')

  if (assignmentError) throw new Error(assignmentError.message)

  // 4. All family subscriptions
  const { data: subRows, error: subError } = await client
    .from('family_subscriptions')
    .select('parent_id, stripe_customer_id, status')

  if (subError) throw new Error(subError.message)

  // Index for fast lookup
  const playersByParent = new Map<string, { playerId: string; playerName: string }[]>()
  ;(ppRows ?? []).forEach((row) => {
    const r = row as Record<string, unknown>
    const parentId = r.parent_id as string
    const playerRow = r.players as Record<string, unknown>
    const entry = { playerId: playerRow.id as string, playerName: playerRow.name as string }
    const existing = playersByParent.get(parentId) ?? []
    playersByParent.set(parentId, [...existing, entry])
  })

  const assignmentsByPlayer = new Map<string, PlayerProduct[]>()
  ;(assignmentRows ?? []).forEach((row) => {
    const r = row as Record<string, unknown>
    const playerId = r.player_id as string
    const pp = mapPlayerProductRow(r)
    const existing = assignmentsByPlayer.get(playerId) ?? []
    assignmentsByPlayer.set(playerId, [...existing, pp])
  })

  const subByParent = new Map<string, { stripeCustomerId: string | null; status: string | null }>()
  ;(subRows ?? []).forEach((row) => {
    const r = row as Record<string, unknown>
    subByParent.set(r.parent_id as string, {
      stripeCustomerId: (r.stripe_customer_id as string | null) ?? null,
      status: (r.status as string | null) ?? null,
    })
  })

  // Build summaries
  return parents.map((parent) => {
    const children = (playersByParent.get(parent.id) ?? []).map(({ playerId, playerName }) => ({
      playerId,
      playerName,
      assignments: assignmentsByPlayer.get(playerId) ?? [],
    }))

    const pricingAssignments: PricingAssignment[] = children.flatMap(({ playerId, playerName, assignments }) =>
      assignments.map((a) => ({
        playerId,
        playerName,
        productId: a.productId,
        productName: a.product.name,
        pricePence: a.product.pricePence,
        billingType: a.product.billingType,
      })),
    )

    const sub = subByParent.get(parent.id)

    return {
      parentId: parent.id,
      parentName: parent.name,
      parentEmail: parent.email,
      stripeCustomerId: sub?.stripeCustomerId ?? null,
      subscriptionStatus: (sub?.status as FamilyBillingSummary['subscriptionStatus']) ?? null,
      children,
      pricing: calculateFamilyPrice(pricingAssignments, rules),
    }
  })
}
