import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'
import {
  assignProduct,
  createProduct,
  fetchAllPlayerProducts,
  fetchFamilyBillingSummaries,
  fetchPricingRules,
  fetchProducts,
  removeAssignment,
  setProductActive,
  updateAssignmentEnds,
  updatePricingRule,
  updateProduct,
} from '../services/payments.ts'
import type {
  FamilyBillingSummary,
  PlayerProduct,
  PricingRule,
  Product,
  ProductFormInput,
} from '../types/payments.ts'

function getError(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

export function useAdminPayments() {
  const [products, setProducts] = useState<Product[]>([])
  const [rules, setRules] = useState<PricingRule[]>([])
  const [assignments, setAssignments] = useState<PlayerProduct[]>([])
  const [families, setFamilies] = useState<FamilyBillingSummary[]>([])

  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingRules, setLoadingRules] = useState(true)
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const [loadingFamilies, setLoadingFamilies] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isConfigured = isSupabaseConfigured

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true)
      setProducts(await fetchProducts())
    } catch (err) {
      setError(getError(err, 'Failed to load products.'))
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  const loadRules = useCallback(async () => {
    try {
      setLoadingRules(true)
      setRules(await fetchPricingRules())
    } catch (err) {
      setError(getError(err, 'Failed to load pricing rules.'))
    } finally {
      setLoadingRules(false)
    }
  }, [])

  const loadAssignments = useCallback(async () => {
    try {
      setLoadingAssignments(true)
      setAssignments(await fetchAllPlayerProducts())
    } catch (err) {
      setError(getError(err, 'Failed to load assignments.'))
    } finally {
      setLoadingAssignments(false)
    }
  }, [])

  const loadFamilies = useCallback(
    async (currentRules: PricingRule[]) => {
      try {
        setLoadingFamilies(true)
        setFamilies(await fetchFamilyBillingSummaries(currentRules))
      } catch (err) {
        setError(getError(err, 'Failed to load family billing.'))
      } finally {
        setLoadingFamilies(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!isConfigured) {
      setError(supabaseConfigError)
      setLoadingProducts(false)
      setLoadingRules(false)
      setLoadingAssignments(false)
      return
    }
    void loadProducts()
    void loadRules()
    void loadAssignments()
  }, [isConfigured, loadProducts, loadRules, loadAssignments])

  // ── Product actions ───────────────────────────────────────────────────────

  async function addProduct(input: ProductFormInput): Promise<void> {
    if (!isConfigured) { setError(supabaseConfigError); return }
    setIsSubmitting(true)
    setError(null)
    try {
      await createProduct(input)
      await loadProducts()
    } catch (err) {
      setError(getError(err, 'Failed to create product.'))
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  async function editProduct(id: string, input: Partial<ProductFormInput>): Promise<void> {
    if (!isConfigured) { setError(supabaseConfigError); return }
    setIsSubmitting(true)
    setError(null)
    try {
      await updateProduct(id, input)
      await loadProducts()
    } catch (err) {
      setError(getError(err, 'Failed to update product.'))
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleProduct(id: string, active: boolean): Promise<void> {
    if (!isConfigured) { setError(supabaseConfigError); return }
    try {
      await setProductActive(id, active)
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)))
    } catch (err) {
      setError(getError(err, 'Failed to update product.'))
    }
  }

  // ── Pricing rule actions ──────────────────────────────────────────────────

  async function saveRule(id: string, patch: { config?: PricingRule['config']; active?: boolean; label?: string }): Promise<void> {
    if (!isConfigured) { setError(supabaseConfigError); return }
    setIsSubmitting(true)
    setError(null)
    try {
      await updatePricingRule(id, patch)
      await loadRules()
    } catch (err) {
      setError(getError(err, 'Failed to update pricing rule.'))
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Assignment actions ────────────────────────────────────────────────────

  /** Assigns a product to a player. Pass `durationMonths` to set a fixed end date. */
  async function assign(playerId: string, productId: string, adminId: string, durationMonths?: number): Promise<void> {
    if (!isConfigured) { setError(supabaseConfigError); return }
    setIsSubmitting(true)
    setError(null)
    try {
      let endsAt: string | null = null
      if (durationMonths && durationMonths > 0) {
        const end = new Date()
        end.setMonth(end.getMonth() + durationMonths)
        endsAt = end.toISOString()
      }
      await assignProduct(playerId, productId, adminId, endsAt)
      await loadAssignments()
    } catch (err) {
      setError(getError(err, 'Failed to assign product.'))
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  /** Updates the end date on an existing assignment. Pass null to make it ongoing. */
  async function editAssignment(assignmentId: string, durationMonths: number | null): Promise<void> {
    if (!isConfigured) { setError(supabaseConfigError); return }
    setIsSubmitting(true)
    setError(null)
    try {
      let endsAt: string | null = null
      if (durationMonths && durationMonths > 0) {
        const end = new Date()
        end.setMonth(end.getMonth() + durationMonths)
        endsAt = end.toISOString()
      }
      await updateAssignmentEnds(assignmentId, endsAt)
      await loadAssignments()
    } catch (err) {
      setError(getError(err, 'Failed to update subscription duration.'))
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  async function unassign(playerId: string, productId: string): Promise<void> {
    if (!isConfigured) { setError(supabaseConfigError); return }
    setIsSubmitting(true)
    setError(null)
    try {
      await removeAssignment(playerId, productId)
      await loadAssignments()
    } catch (err) {
      setError(getError(err, 'Failed to remove assignment.'))
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  async function refreshFamilies(): Promise<void> {
    await loadFamilies(rules)
  }

  return {
    isConfigured,
    products,
    rules,
    assignments,
    families,
    loadingProducts,
    loadingRules,
    loadingAssignments,
    loadingFamilies,
    error,
    isSubmitting,
    addProduct,
    editProduct,
    toggleProduct,
    saveRule,
    assign,
    editAssignment,
    unassign,
    refreshFamilies,
  }
}
