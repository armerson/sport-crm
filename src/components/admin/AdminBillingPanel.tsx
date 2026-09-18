import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TabNav } from '../ui/TabNav.tsx'
import { SuccessMessage } from '../ui/SuccessMessage.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { Button } from '../ui/Button.tsx'
import { useAdminPayments } from '../../hooks/useAdminPayments.ts'
import { useAuth } from '../../hooks/useAuth.ts'
import { formatPence, penceToPounds, poundsToPence } from '../../lib/pricing.ts'
import { fetchAllPlayers } from '../../services/payments.ts'
import type { BillingType, FamilyCapConfig, FinanceTransaction, Product, ProductFormInput, TieredDiscountConfig } from '../../types/payments.ts'
import type { SimplePlayer } from '../../services/payments.ts'

type BillingTab = 'products' | 'rules' | 'assign' | 'overview'

const BILLING_TABS = [
  { label: 'Products', value: 'products' as BillingTab },
  { label: 'Pricing rules', value: 'rules' as BillingTab },
  { label: 'Assign', value: 'assign' as BillingTab },
  { label: 'Overview', value: 'overview' as BillingTab },
] as const

const BILLING_TAB_META: Record<BillingTab, { eyebrow: string; title: string; description: string }> = {
  products: { eyebrow: 'Fees catalogue', title: 'Products', description: 'Create and manage the fees available to players and families.' },
  rules: { eyebrow: 'Pricing controls', title: 'Pricing rules', description: 'Manage sibling discounts and family caps in one place.' },
  assign: { eyebrow: 'Player billing', title: 'Assign products', description: 'Choose a player, then manage the fees linked to their account.' },
  overview: { eyebrow: 'Club finances', title: 'Finance', description: 'See cash received, payments needing attention, subscriptions, and expected fees.' },
}

// ── Icon helpers ────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
      active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function BillingTypeBadge({ type, durationMonths }: { type: BillingType; durationMonths?: number | null }) {
  const label = type === 'monthly'
    ? (durationMonths ? `${durationMonths}mo subscription` : 'Monthly subscription')
    : type === 'membership' ? 'Membership fee'
    : 'One-off'
  const colour = type === 'monthly' ? 'bg-blue-100 text-blue-700'
    : type === 'membership' ? 'bg-violet-100 text-violet-700'
    : 'bg-purple-100 text-purple-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colour}`}>
      {label}
    </span>
  )
}

// ── Products section ────────────────────────────────────────────────────────

function ProductsSection() {
  const { profile } = useAuth()
  const { products, loadingProducts, isSubmitting, error, addProduct, editProduct, toggleProduct } = useAdminPayments()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const blankForm: ProductFormInput = { name: '', description: '', pricePence: 0, billingType: 'monthly', durationMonths: '', seasonLabel: '', teamId: null }
  const [form, setForm] = useState<ProductFormInput>(blankForm)
  const [priceInput, setPriceInput] = useState('')

  if (!profile) return null

  function startEdit(product: Product) {
    setEditingId(product.id)
    setForm({
      name: product.name,
      description: product.description ?? '',
      pricePence: product.pricePence,
      billingType: product.billingType,
      durationMonths: product.durationMonths?.toString() ?? '',
      seasonLabel: product.seasonLabel ?? '',
      teamId: product.teamId,
    })
    setPriceInput(penceToPounds(product.pricePence).toFixed(2))
    setShowForm(true)
  }

  function resetForm() {
    setForm(blankForm)
    setPriceInput('')
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pricePence = poundsToPence(parseFloat(priceInput) || 0)
    const payload = { ...form, pricePence }

    try {
      if (editingId) {
        await editProduct(editingId, payload)
        setSuccessMsg('Product updated.')
      } else {
        await addProduct(payload)
        setSuccessMsg('Product created.')
      }
      resetForm()
    } catch {
      // error shown via hook
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Products</h3>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} variant="primary">
            + New product
          </Button>
        )}
      </div>

      <SuccessMessage message={successMsg} />
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {showForm && (
        <form onSubmit={(e) => void handleSubmit(e)} className="ui-form-surface space-y-4">
          <h4 className="font-semibold text-slate-800">{editingId ? 'Edit product' : 'New product'}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Product name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. U10 Monthly Membership"
                required
                className="ui-input"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Price (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="25.00"
                required
                className="ui-input"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Billing type</label>
              <select
                value={form.billingType}
                onChange={(e) => setForm((f) => ({ ...f, billingType: e.target.value as BillingType }))}
                className="ui-input"
              >
                <option value="monthly">Monthly subscription</option>
                <option value="membership">Membership fee (one-off, seasonal)</option>
                <option value="one_off">Ad-hoc one-off payment</option>
              </select>
            </div>

            {/* Duration — monthly subscriptions only */}
            {form.billingType === 'monthly' && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Duration (months)</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={form.durationMonths}
                  onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.value }))}
                  placeholder="Leave blank for ongoing"
                  className="ui-input"
                />
                <p className="text-xs text-slate-400">e.g. 10 months for a Sept–June season. Leave blank for ongoing until cancelled.</p>
              </div>
            )}

            {/* Season label — membership fee only */}
            {form.billingType === 'membership' && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Season label (optional)</label>
                <input
                  type="text"
                  value={form.seasonLabel}
                  onChange={(e) => setForm((f) => ({ ...f, seasonLabel: e.target.value }))}
                  placeholder="e.g. 2025/26 Season"
                  className="ui-input"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Description (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description for parents"
                className="ui-input"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={isSubmitting || !form.name || !priceInput}>
              {isSubmitting ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      )}

      {loadingProducts ? (
        <div aria-label="Loading products" className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="ui-skeleton h-16 rounded-xl" />)}</div>
      ) : products.length === 0 ? (
        <div className="ui-empty"><p className="font-semibold text-slate-700">No products yet</p><p className="mt-1">Create the first fee using the button above.</p></div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
          {products.map((product) => (
            <div key={product.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-slate-900">{product.name}</p>
                  <BillingTypeBadge type={product.billingType} durationMonths={product.durationMonths} />
                  <StatusBadge active={product.active} />
                </div>
                {product.description && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">{product.description}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-800">{formatPence(product.pricePence)}</span>
                <button
                  type="button"
                  onClick={() => startEdit(product)}
                  className="text-xs font-semibold text-slate-500 transition hover:text-slate-800"
                >
                  Edit
                </button>
                {product.active && (product.billingType === 'one_off' || product.billingType === 'membership') ? (
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/pay/camp/${product.id}`
                      void navigator.clipboard.writeText(url).then(() => {
                        setSuccessMsg('Guest pay link copied — share with anyone; no club login required.')
                      })
                    }}
                    className="text-xs font-semibold text-[#1565ff] transition hover:underline"
                  >
                    Copy guest pay link
                  </button>
                ) : null}
                {product.active ? (
                  <ConfirmInline
                    label="Deactivate"
                    confirmLabel="Yes, deactivate"
                    onConfirm={() => void toggleProduct(product.id, false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => void toggleProduct(product.id, true)}
                    className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-800"
                  >
                    Activate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pricing rules section ───────────────────────────────────────────────────

function PricingRulesSection() {
  const { rules, loadingRules, isSubmitting, saveRule } = useAdminPayments()
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [capInput, setCapInput] = useState('')
  const [tierInputs, setTierInputs] = useState<{ childIndex: number; discountPct: number }[]>([])

  function startEditRule(rule: (typeof rules)[0]) {
    setEditingId(rule.id)
    if (rule.type === 'family_cap') {
      const config = rule.config as FamilyCapConfig
      setCapInput(penceToPounds(config.amountPence).toFixed(2))
    }
    if (rule.type === 'tiered_discount') {
      const config = rule.config as TieredDiscountConfig
      setTierInputs([...config.tiers])
    }
  }

  async function saveTieredRule(id: string) {
    try {
      await saveRule(id, { config: { tiers: tierInputs } as TieredDiscountConfig })
      setSuccessMsg('Sibling discount updated.')
      setEditingId(null)
    } catch { /* error surfaced in hook */ }
  }

  async function saveCapRule(id: string) {
    try {
      await saveRule(id, { config: { amountPence: poundsToPence(parseFloat(capInput) || 0) } as FamilyCapConfig })
      setSuccessMsg('Family cap updated.')
      setEditingId(null)
    } catch { /* error surfaced in hook */ }
  }

  async function toggleRule(id: string, active: boolean) {
    await saveRule(id, { active })
    setSuccessMsg(active ? 'Rule enabled.' : 'Rule disabled.')
  }

  if (loadingRules) return <p className="text-sm text-slate-500">Loading rules…</p>

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-slate-900">Pricing rules</h3>
      <SuccessMessage message={successMsg} />
      <p className="text-sm text-slate-500">
        Rules apply automatically when calculating family invoices. Tiered discounts apply to monthly products only.
        The family cap is applied after sibling discounts.
      </p>

      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-xl border border-[var(--ui-border)] bg-white p-5 shadow-[0_1px_2px_#10182808]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">
                    {rule.type === 'tiered_discount' ? 'Sibling discount' : 'Family monthly cap'}
                  </p>
                  <StatusBadge active={rule.active} />
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{rule.label}</p>
              </div>
              <div className="flex items-center gap-2">
                {editingId !== rule.id && (
                  <button
                    type="button"
                    onClick={() => startEditRule(rule)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void toggleRule(rule.id, !rule.active)}
                  className={`text-xs font-semibold transition ${rule.active ? 'text-rose-500 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-800'}`}
                >
                  {rule.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            {/* Tiered discount editor */}
            {editingId === rule.id && rule.type === 'tiered_discount' && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Discount tiers</p>
                {tierInputs.map((tier, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-20">
                      {tier.childIndex === 1 ? '2nd child' : tier.childIndex === 2 ? '3rd child' : `Child ${tier.childIndex + 1}`}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tier.discountPct}
                      onChange={(e) => {
                        const updated = [...tierInputs]
                        updated[i] = { ...tier, discountPct: parseInt(e.target.value) || 0 }
                        setTierInputs(updated)
                      }}
                      className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
                    />
                    <span className="text-sm text-slate-500">% off</span>
                    <button
                      type="button"
                      onClick={() => setTierInputs(tierInputs.filter((_, j) => j !== i))}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const nextIndex = (tierInputs[tierInputs.length - 1]?.childIndex ?? 0) + 1
                    setTierInputs([...tierInputs, { childIndex: nextIndex, discountPct: 0 }])
                  }}
                  className="text-xs font-semibold text-[#1565ff] hover:underline"
                >
                  + Add tier
                </button>
                <div className="flex gap-2 pt-1">
                  <Button variant="primary" disabled={isSubmitting} onClick={() => void saveTieredRule(rule.id)}>
                    {isSubmitting ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Family cap editor */}
            {editingId === rule.id && rule.type === 'family_cap' && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600">Maximum monthly charge per family</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-slate-500">£</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={capInput}
                      onChange={(e) => setCapInput(e.target.value)}
                      className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" disabled={isSubmitting} onClick={() => void saveCapRule(rule.id)}>
                    {isSubmitting ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Current config display */}
            {editingId !== rule.id && (
              <div className="mt-3 text-sm text-slate-600">
                {rule.type === 'tiered_discount' && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(rule.config as TieredDiscountConfig).tiers.map((t) => (
                      <span key={t.childIndex} className="rounded-lg bg-slate-100 px-2 py-1 text-xs">
                        {t.childIndex === 1 ? '2nd' : t.childIndex === 2 ? '3rd' : `${t.childIndex + 1}th`} child: {t.discountPct}% off
                      </span>
                    ))}
                  </div>
                )}
                {rule.type === 'family_cap' && (
                  <span>Cap: {formatPence((rule.config as FamilyCapConfig).amountPence)}/month</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Assign section ──────────────────────────────────────────────────────────

function formatEndsAt(endsAt: string | null): string {
  if (!endsAt) return 'Ongoing'
  const d = new Date(endsAt)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AssignSection() {
  const { profile } = useAuth()
  const { products, assignments, isSubmitting, assign, editAssignment, unassign } = useAdminPayments()
  const [allPlayers, setAllPlayers] = useState<SimplePlayer[]>([])
  const [playerSearch, setPlayerSearch] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Inline "assign" form state — productId → months override string
  const [pendingAssignId, setPendingAssignId] = useState<string | null>(null)
  const [assignMonths, setAssignMonths] = useState('')

  // Inline "edit duration" form state
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null)
  const [editMonths, setEditMonths] = useState('')

  useEffect(() => {
    void fetchAllPlayers().then(setAllPlayers).catch(() => {/* non-critical */})
  }, [])

  if (!profile) return null

  const filteredPlayers = allPlayers.filter((p) =>
    p.name.toLowerCase().includes(playerSearch.toLowerCase()),
  )

  const selectedPlayer = allPlayers.find((p) => p.id === selectedPlayerId)
  const playerAssignments = assignments.filter((a) => a.playerId === selectedPlayerId)
  const assignedProductIds = new Set(playerAssignments.map((a) => a.productId))
  const activeProducts = products.filter((p) => p.active)

  function openAssign(product: (typeof activeProducts)[0]) {
    setPendingAssignId(product.id)
    // Pre-fill with the product's own duration if it has one
    setAssignMonths(product.durationMonths ? String(product.durationMonths) : '')
  }

  async function handleConfirmAssign() {
    if (!pendingAssignId) return
    const months = parseInt(assignMonths) || undefined
    await assign(selectedPlayerId, pendingAssignId, profile!.id, months)
    setSuccessMsg('Product assigned.')
    setPendingAssignId(null)
    setAssignMonths('')
  }

  async function handleUnassign(productId: string) {
    await unassign(selectedPlayerId, productId)
    setSuccessMsg('Product removed.')
    setEditingAssignmentId(null)
  }

  function openEditAssignment(a: (typeof playerAssignments)[0]) {
    setEditingAssignmentId(a.id)
    // Show remaining months if there's an end date, otherwise blank
    if (a.endsAt) {
      const months = Math.ceil((new Date(a.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
      setEditMonths(String(Math.max(1, months)))
    } else {
      setEditMonths('')
    }
  }

  async function handleSaveEditMonths(assignmentId: string) {
    const months = parseInt(editMonths) || null
    await editAssignment(assignmentId, months)
    setSuccessMsg(months ? `Duration updated to ${months} month${months !== 1 ? 's' : ''} from today.` : 'Set to ongoing (no end date).')
    setEditingAssignmentId(null)
    setEditMonths('')
  }

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-slate-900">Assign products to players</h3>
      <SuccessMessage message={successMsg} />

      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        {/* Player picker */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search players…"
            value={playerSearch}
            onChange={(e) => {
              setPlayerSearch(e.target.value)
            }}
            className="ui-input"
          />
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-white">
            {filteredPlayers.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">No players found.</p>
            ) : (
              filteredPlayers.map((player) => {
                const assigned = assignments.filter((a) => a.playerId === player.id).length
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlayerId(player.id)
                      setPendingAssignId(null)
                      setEditingAssignmentId(null)
                    }}
                    className={`w-full px-4 py-3 text-left transition ${
                      selectedPlayerId === player.id ? 'bg-[var(--ui-accent)]/[0.06] font-semibold text-[var(--ui-accent)]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">{player.name}</p>
                    <p className="text-xs text-slate-400">
                      {player.teamNames.join(', ') || 'No team'} · {assigned} product{assigned !== 1 ? 's' : ''}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Product assignment */}
        <div>
          {!selectedPlayer ? (
            <div className="ui-empty flex h-full items-center justify-center">
              Select a player to manage their products
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-semibold text-slate-800">{selectedPlayer.name}</p>
              {activeProducts.length === 0 ? (
                <p className="text-sm text-slate-500">No active products. Create products first.</p>
              ) : (
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
                  {activeProducts.map((product) => {
                    const isAssigned = assignedProductIds.has(product.id)
                    const assignment = playerAssignments.find((a) => a.productId === product.id)
                    const isMonthly = product.billingType === 'monthly'
                    const isPendingThis = pendingAssignId === product.id
                    const isEditingThis = assignment && editingAssignmentId === assignment.id

                    return (
                      <div key={product.id} className="px-4 py-3.5">
                        {/* Product row */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900">{product.name}</p>
                              <BillingTypeBadge type={product.billingType} durationMonths={product.durationMonths} />
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <p className="text-xs text-slate-500">
                                {formatPence(product.pricePence)}{isMonthly ? '/mo' : ''}
                              </p>
                              {/* Show end date for assigned monthly products */}
                              {isAssigned && isMonthly && assignment && !isEditingThis && (
                                <span className="text-xs text-slate-400">
                                  Ends: <span className={assignment.endsAt ? 'text-amber-600 font-medium' : 'text-slate-500'}>
                                    {formatEndsAt(assignment.endsAt)}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            {isAssigned ? (
                              <>
                                {/* Edit duration button — monthly only */}
                                {isMonthly && assignment && !isEditingThis && (
                                  <button
                                    type="button"
                                    onClick={() => openEditAssignment(assignment)}
                                    className="text-xs font-semibold text-slate-500 transition hover:text-slate-800"
                                  >
                                    Edit months
                                  </button>
                                )}
                                <ConfirmInline
                                  onConfirm={() => void handleUnassign(product.id)}
                                  label="Remove"
                                  disabled={isSubmitting}
                                />
                              </>
                            ) : isPendingThis ? null : (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => (isMonthly ? openAssign(product) : void (async () => {
                                  await assign(selectedPlayerId, product.id, profile!.id)
                                  setSuccessMsg('Product assigned.')
                                })())}
                                className="text-xs font-semibold text-[#1565ff] transition hover:underline disabled:opacity-40"
                              >
                                Assign
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline assign form — monthly products only */}
                        {isPendingThis && (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <p className="text-xs font-semibold text-slate-600">How many months should this subscription run?</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="60"
                                value={assignMonths}
                                onChange={(e) => setAssignMonths(e.target.value)}
                                placeholder="Leave blank for ongoing"
                                className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
                              />
                              <span className="text-xs text-slate-500">months</span>
                            </div>
                            {assignMonths && parseInt(assignMonths) > 0 && (
                              <p className="text-xs text-slate-400">
                                Will end on{' '}
                                {(() => {
                                  const d = new Date()
                                  d.setMonth(d.getMonth() + parseInt(assignMonths))
                                  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                                })()}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Button variant="primary" disabled={isSubmitting} onClick={() => void handleConfirmAssign()}>
                                {isSubmitting ? 'Assigning…' : 'Confirm assign'}
                              </Button>
                              <Button variant="secondary" onClick={() => setPendingAssignId(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}

                        {/* Inline edit duration form */}
                        {isEditingThis && assignment && (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <p className="text-xs font-semibold text-slate-600">Update subscription duration from today</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="60"
                                value={editMonths}
                                onChange={(e) => setEditMonths(e.target.value)}
                                placeholder="Leave blank for ongoing"
                                className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
                              />
                              <span className="text-xs text-slate-500">months</span>
                            </div>
                            {editMonths && parseInt(editMonths) > 0 ? (
                              <p className="text-xs text-slate-400">
                                New end date:{' '}
                                {(() => {
                                  const d = new Date()
                                  d.setMonth(d.getMonth() + parseInt(editMonths))
                                  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                                })()}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400">Leave blank to set as ongoing (no end date)</p>
                            )}
                            <div className="flex gap-2">
                              <Button variant="primary" disabled={isSubmitting} onClick={() => void handleSaveEditMonths(assignment.id)}>
                                {isSubmitting ? 'Saving…' : 'Save duration'}
                              </Button>
                              <Button variant="secondary" onClick={() => setEditingAssignmentId(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Overview section ────────────────────────────────────────────────────────

function financeSourceLabel(source: FinanceTransaction['sourceType']) {
  if (source === 'subscription_invoice') return 'Subscription'
  if (source === 'guest_checkout') return 'Guest checkout'
  if (source === 'member_checkout') return 'Member checkout'
  return 'Manual'
}

function financeStatusClass(status: FinanceTransaction['status']) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800'
  if (status === 'failed') return 'bg-rose-100 text-rose-800'
  if (status === 'refunded') return 'bg-violet-100 text-violet-800'
  return 'bg-amber-100 text-amber-800'
}

function csvCell(value: string | number) {
  const raw = String(value)
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

function OverviewSection() {
  const { families, financeTransactions, loadingFamilies, loadingFinance, loadingRules, rules, refreshFamilies, refreshFinance } = useAdminPayments()
  const [loaded, setLoaded] = useState(false)
  const [transactionSearch, setTransactionSearch] = useState('')
  const [transactionStatus, setTransactionStatus] = useState<'all' | FinanceTransaction['status']>('all')

  async function handleLoad() {
    await Promise.all([refreshFamilies(), refreshFinance()])
    setLoaded(true)
  }

  useEffect(() => {
    if (!loadingRules && !loaded) void handleLoad()
    // handleLoad is deliberately tied to the loaded state and completed rule fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRules, loaded])

  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase()
    return financeTransactions.filter((transaction) => {
      if (transactionStatus !== 'all' && transaction.status !== transactionStatus) return false
      if (!query) return true
      return [transaction.payerName, transaction.payerEmail, transaction.description, financeSourceLabel(transaction.sourceType)]
        .some((value) => value?.toLowerCase().includes(query))
    })
  }, [financeTransactions, transactionSearch, transactionStatus])

  if (!loaded) {
    return (
      <div className="space-y-4" aria-label="Loading finance overview">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="ui-skeleton h-28 rounded-xl" />)}</div>
        <div className="grid gap-4 lg:grid-cols-2"><div className="ui-skeleton h-72 rounded-xl" /><div className="ui-skeleton h-72 rounded-xl" /></div>
      </div>
    )
  }

  const totalMonthly = families.reduce((s, f) => s + f.pricing.monthlyPence, 0)
  const totalOneOff = families.reduce((s, f) => s + f.pricing.oneOffPence, 0)
  const totalDiscounts = families.reduce((s, f) => s + f.pricing.totalDiscountPence, 0)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const paidTransactions = financeTransactions.filter((transaction) => transaction.status === 'paid')
  const receivedThisMonth = paidTransactions
    .filter((transaction) => new Date(transaction.paidAt ?? transaction.createdAt) >= monthStart)
    .reduce((sum, transaction) => sum + transaction.amountPence, 0)
  const receivedAllTime = paidTransactions.reduce((sum, transaction) => sum + transaction.amountPence, 0)
  const failedOrPending = financeTransactions.filter((transaction) => transaction.status === 'failed' || transaction.status === 'pending')
  const failedOrPendingPence = failedOrPending.reduce((sum, transaction) => sum + transaction.amountPence, 0)
  const refundedPence = financeTransactions.filter((transaction) => transaction.status === 'refunded').reduce((sum, transaction) => sum + transaction.amountPence, 0)
  const activeSubscriptions = families.filter((family) => family.subscriptionStatus === 'active' || family.subscriptionStatus === 'trialing').length
  const attentionSubscriptions = families.filter((family) => family.subscriptionStatus === 'past_due' || family.subscriptionStatus === 'incomplete').length
  const statusData = [
    { name: 'Active / trial', value: activeSubscriptions, color: '#087a55' },
    { name: 'Needs attention', value: attentionSubscriptions, color: '#b42318' },
    { name: 'Paused / cancelled', value: families.filter((family) => family.subscriptionStatus === 'paused' || family.subscriptionStatus === 'cancelled').length, color: '#667085' },
    { name: 'Not set up', value: families.filter((family) => !family.subscriptionStatus && family.pricing.monthlyPence > 0).length, color: '#f59e0b' },
  ].filter((item) => item.value > 0)
  const productTotals = new Map<string, number>()
  for (const family of families) {
    for (const item of family.pricing.lineItems) {
      productTotals.set(item.productName, (productTotals.get(item.productName) ?? 0) + item.finalPricePence)
    }
  }
  const productData = [...productTotals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  function exportTransactions() {
    const headings = ['Date', 'Payer', 'Email', 'Description', 'Type', 'Status', 'Amount (GBP)', 'Reference']
    const rows = filteredTransactions.map((transaction) => [
      new Date(transaction.paidAt ?? transaction.createdAt).toLocaleDateString('en-GB'),
      transaction.payerName ?? '',
      transaction.payerEmail ?? '',
      transaction.description,
      financeSourceLabel(transaction.sourceType),
      transaction.status,
      (transaction.amountPence / 100).toFixed(2),
      transaction.externalId ?? '',
    ])
    const csv = [headings, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = href
    link.download = `club-finance-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(href)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-slate-900">Finance control centre</h3><p className="mt-1 text-sm text-slate-500">Confirmed cash, payment issues, and expected club fees.</p></div>
        <Button variant="secondary" onClick={() => void handleLoad()} disabled={loadingFamilies || loadingFinance}>
          {loadingFamilies || loadingFinance ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ui-metric border-emerald-200 bg-emerald-50/60">
          <p className="ui-metric-label">Received this month</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-700">{formatPence(receivedThisMonth)}</p>
          <p className="mt-1 text-xs text-slate-500">Confirmed Stripe payments</p>
        </div>
        <div className="ui-metric">
          <p className="ui-metric-label">Received all time</p>
          <p className="ui-metric-value">{formatPence(receivedAllTime)}</p>
          <p className="mt-1 text-xs text-slate-500">{paidTransactions.length} successful payment{paidTransactions.length === 1 ? '' : 's'}</p>
        </div>
        <div className={`ui-metric ${failedOrPending.length > 0 ? 'border-rose-200 bg-rose-50/60' : ''}`}>
          <p className="ui-metric-label">Needs attention</p>
          <p className={`ui-metric-value ${failedOrPending.length > 0 ? 'text-rose-700' : ''}`}>{formatPence(failedOrPendingPence)}</p>
          <p className="mt-1 text-xs text-slate-500">{failedOrPending.length} pending or failed</p>
        </div>
        <div className="ui-metric">
          <p className="ui-metric-label">Refunded</p>
          <p className="ui-metric-value">{formatPence(refundedPence)}</p>
          <p className="mt-1 text-xs text-slate-500">Recorded from Stripe refunds</p>
        </div>
      </div>

      <article className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div><h4 className="font-semibold text-slate-900">Payment activity</h4><p className="mt-1 text-sm text-slate-500">Who paid, what they paid for, and payment status.</p></div>
          <Button variant="secondary" onClick={exportTransactions} disabled={filteredTransactions.length === 0}>Export CSV</Button>
        </div>
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-[1fr_12rem]">
          <input className="ui-input" value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Search payer, email or payment…" aria-label="Search payments" />
          <select className="ui-input" value={transactionStatus} onChange={(event) => setTransactionStatus(event.target.value as typeof transactionStatus)} aria-label="Filter payment status">
            <option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
          </select>
        </div>
        {filteredTransactions.length === 0 ? (
          <div className="ui-empty m-4"><p className="font-semibold text-slate-700">No matching payments</p><p className="mt-1">New Stripe payments will appear here automatically.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Payer</th><th className="px-4 py-3 font-semibold">Payment</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredTransactions.slice(0, 100).map((transaction) => <tr key={transaction.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(transaction.paidAt ?? transaction.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="px-4 py-3"><p className="font-medium text-slate-900">{transaction.payerName || 'Unknown payer'}</p><p className="text-xs text-slate-500">{transaction.payerEmail || 'No email recorded'}</p></td>
                <td className="px-4 py-3"><p className="font-medium text-slate-800">{transaction.description}</p><p className="text-xs text-slate-500">{financeSourceLabel(transaction.sourceType)}</p></td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${financeStatusClass(transaction.status)}`}>{transaction.status}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">{formatPence(transaction.amountPence)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </article>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
        <strong>Expected fees:</strong> the figures below use current product assignments and pricing rules, so they may differ from confirmed cash received above.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ui-metric border-[var(--ui-accent)]/20 bg-[var(--ui-accent)]/[0.045]">
          <p className="ui-metric-label">Expected monthly fees</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--ui-accent)]">{formatPence(totalMonthly)}</p>
          <p className="mt-1 text-xs text-slate-500">Current recurring assignments</p>
        </div>
        <div className="ui-metric">
          <p className="ui-metric-label">Active subscriptions</p>
          <p className="ui-metric-value">{activeSubscriptions}</p>
          <p className="mt-1 text-xs text-slate-500">Active or trialling</p>
        </div>
        <div className={`ui-metric ${attentionSubscriptions > 0 ? 'border-rose-200 bg-rose-50/60' : ''}`}>
          <p className="ui-metric-label">Needs attention</p>
          <p className={`ui-metric-value ${attentionSubscriptions > 0 ? 'text-rose-700' : ''}`}>{attentionSubscriptions}</p>
          <p className="mt-1 text-xs text-slate-500">Past due or incomplete</p>
        </div>
        <div className="ui-metric">
          <p className="ui-metric-label">Discounts applied</p>
          <p className="ui-metric-value">{formatPence(totalDiscounts)}</p>
          <p className="mt-1 text-xs text-slate-500">Across current family pricing</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-[var(--ui-border)] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-900">Subscription health</h4><p className="mt-1 text-sm text-slate-500">Families with recurring fees</p></div><span className="text-xs font-semibold text-slate-500">{statusData.reduce((sum, item) => sum + item.value, 0)} accounts</span></div>
          {statusData.length > 0 ? <div className="mt-4 grid items-center gap-4 sm:grid-cols-[12rem_1fr]">
            <div className="h-48" aria-label="Subscription status chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={75} paddingAngle={2}>{statusData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <div className="space-y-2">{statusData.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><strong className="text-slate-900">{item.value}</strong></div>)}</div>
          </div> : <div className="ui-empty mt-4"><p>No recurring subscription data yet.</p></div>}
        </article>

        <article className="rounded-xl border border-[var(--ui-border)] bg-white p-4 sm:p-5">
          <div><h4 className="font-semibold text-slate-900">Fees by product</h4><p className="mt-1 text-sm text-slate-500">Top current assignments after discounts</p></div>
          {productData.length > 0 ? <div className="mt-4 h-56" aria-label="Calculated fees by product chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={productData} layout="vertical" margin={{ left: 4, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e7ec" /><XAxis type="number" tickFormatter={(value) => `£${Math.round(Number(value) / 100)}`} tick={{ fontSize: 11, fill: '#667085' }} /><YAxis dataKey="name" type="category" width={92} tick={{ fontSize: 11, fill: '#475467' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => formatPence(Number(value))} /><Bar dataKey="value" fill="var(--ui-accent)" radius={[0, 5, 5, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div> : <div className="ui-empty mt-4"><p>No product assignments yet.</p></div>}
        </article>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ui-metric"><p className="ui-metric-label">Families with monthly fees</p><p className="ui-metric-value">{families.filter((family) => family.pricing.monthlyPence > 0).length}</p></div>
        <div className="ui-metric"><p className="ui-metric-label">Assigned one-off fees</p><p className="ui-metric-value">{formatPence(totalOneOff)}</p></div>
        <div className="ui-metric"><p className="ui-metric-label">Active pricing rules</p><p className="ui-metric-value">{rules.filter((rule) => rule.active).length}</p></div>
      </div>

      <div className="flex items-end justify-between gap-3"><div><h4 className="font-semibold text-slate-900">Family accounts</h4><p className="mt-1 text-sm text-slate-500">Drill down into current assigned fees.</p></div><span className="text-xs font-semibold text-slate-500">{families.length} total</span></div>
      {families.length === 0 ? (
        <div className="ui-empty"><p className="font-semibold text-slate-700">No families found</p><p className="mt-1">Family billing records will appear here.</p></div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
          {families.map((family) => (
            <div key={family.parentId} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{family.parentName}</p>
                  <p className="text-xs text-slate-400">{family.parentEmail}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {family.children.map((child) => (
                      <span key={child.playerId} className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {child.playerName}
                        {child.assignments.length > 0 && ` · ${child.assignments.map(a => a.product.name).join(', ')}`}
                      </span>
                    ))}
                    {family.children.length === 0 && (
                      <span className="text-xs text-slate-400">No linked children</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {family.pricing.monthlyPence > 0 ? (
                    <>
                      <p className="text-lg font-bold text-[#1565ff]">{formatPence(family.pricing.monthlyPence)}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                      {family.pricing.totalDiscountPence > 0 && (
                        <p className="text-xs text-emerald-600">
                          saving {formatPence(family.pricing.totalDiscountPence)}
                          {family.pricing.capApplied && ' (cap applied)'}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No products</p>
                  )}
                  {family.pricing.oneOffPence > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">{formatPence(family.pricing.oneOffPence)} one-off</p>
                  )}
                  {family.subscriptionStatus && (
                    <StatusBadge active={family.subscriptionStatus === 'active'} />
                  )}
                </div>
              </div>

              {/* Pricing breakdown */}
              {family.pricing.lineItems.filter(i => i.billingType === 'monthly').length > 1 && (
                <div className="mt-2 space-y-0.5 pl-2 border-l-2 border-slate-100">
                  {family.pricing.lineItems.filter(i => i.billingType === 'monthly').map((item, idx) => (
                    <div key={`${item.playerId}-${item.productId}`} className="flex items-center justify-between text-xs text-slate-500">
                      <span>{item.playerName} — {item.productName}{idx > 0 && item.discountPct > 0 ? ` (${item.discountPct}% off)` : ''}</span>
                      <span>{formatPence(item.finalPricePence)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────

interface AdminBillingPanelProps {
  activeTab: BillingTab
  onTabChange: (tab: BillingTab) => void
}

export function AdminBillingPanel({ activeTab, onTabChange }: AdminBillingPanelProps) {
  const { isConfigured } = useAdminPayments()
  const meta = BILLING_TAB_META[activeTab]

  return (
    <div className="space-y-5 ui-view-enter">
      <div className="hidden sm:block">
        <TabNav tabs={BILLING_TABS} active={activeTab} onChange={onTabChange} />
      </div>

      {!isConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured. Add your project values to .env.local.
        </div>
      )}

      <section className="ui-module">
        <div className="ui-module-header">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-accent)]">{meta.eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{meta.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{meta.description}</p>
        </div>
        <div className="ui-module-body">
        {activeTab === 'products' && <ProductsSection />}
        {activeTab === 'rules' && <PricingRulesSection />}
        {activeTab === 'assign' && <AssignSection />}
        {activeTab === 'overview' && <OverviewSection />}
        </div>
      </section>
    </div>
  )
}

export type { BillingTab }
