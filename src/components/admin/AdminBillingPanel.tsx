import { useEffect, useState } from 'react'
import { TabNav } from '../ui/TabNav.tsx'
import { SuccessMessage } from '../ui/SuccessMessage.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { Button } from '../ui/Button.tsx'
import { useAdminPayments } from '../../hooks/useAdminPayments.ts'
import { useAuth } from '../../hooks/useAuth.ts'
import { formatPence, penceToPounds, poundsToPence } from '../../lib/pricing.ts'
import { fetchAllPlayers } from '../../services/payments.ts'
import type { BillingType, FamilyCapConfig, Product, ProductFormInput, TieredDiscountConfig } from '../../types/payments.ts'
import type { SimplePlayer } from '../../services/payments.ts'

type BillingTab = 'products' | 'rules' | 'assign' | 'overview'

const BILLING_TABS = [
  { label: 'Products', value: 'products' as BillingTab },
  { label: 'Pricing rules', value: 'rules' as BillingTab },
  { label: 'Assign', value: 'assign' as BillingTab },
  { label: 'Overview', value: 'overview' as BillingTab },
] as const

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
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Billing type</label>
              <select
                value={form.billingType}
                onChange={(e) => setForm((f) => ({ ...f, billingType: e.target.value as BillingType }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
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
        <p className="text-sm text-slate-500">Loading products…</p>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No products yet. Create your first product above.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {products.map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
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
              <div className="flex shrink-0 items-center gap-3">
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
          <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-5">
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
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565ff]/30"
          />
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
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
                      selectedPlayerId === player.id ? 'bg-[#1565ff]/5 font-semibold text-[#1565ff]' : 'hover:bg-slate-50'
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
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Select a player to manage their products
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-semibold text-slate-800">{selectedPlayer.name}</p>
              {activeProducts.length === 0 ? (
                <p className="text-sm text-slate-500">No active products. Create products first.</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
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

function OverviewSection() {
  const { families, loadingFamilies, rules, refreshFamilies } = useAdminPayments()
  const [loaded, setLoaded] = useState(false)

  async function handleLoad() {
    await refreshFamilies()
    setLoaded(true)
  }

  if (!loaded) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Family billing overview</h3>
          <Button variant="primary" onClick={() => void handleLoad()} disabled={loadingFamilies}>
            {loadingFamilies ? 'Loading…' : 'Load billing data'}
          </Button>
        </div>
        <p className="text-sm text-slate-500">
          Click to calculate billing totals for every family based on current products, assignments, and pricing rules.
        </p>
      </div>
    )
  }

  const totalMonthly = families.reduce((s, f) => s + f.pricing.monthlyPence, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Family billing overview</h3>
        <Button variant="secondary" onClick={() => void handleLoad()} disabled={loadingFamilies}>
          {loadingFamilies ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Active rules summary */}
      <div className="flex flex-wrap gap-2">
        {rules.filter((r) => r.active).map((r) => (
          <span key={r.id} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            {r.label ?? r.type}
          </span>
        ))}
        {!rules.some((r) => r.active) && (
          <span className="text-xs text-slate-400">No pricing rules active — full price billing.</span>
        )}
      </div>

      {/* Summary stat */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#1565ff]/5 to-white p-5">
        <p className="text-sm text-slate-500">Total club monthly revenue (calculated)</p>
        <p className="mt-1 text-3xl font-bold text-[#1565ff]">{formatPence(totalMonthly)}</p>
        <p className="text-xs text-slate-400 mt-0.5">After discounts · {families.filter(f => f.pricing.monthlyPence > 0).length} paying families</p>
      </div>

      {/* Family table */}
      {families.length === 0 ? (
        <p className="text-sm text-slate-500">No families found.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
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

  return (
    <div className="space-y-5">
      <div className="hidden sm:block">
        <TabNav tabs={BILLING_TABS} active={activeTab} onChange={onTabChange} />
      </div>

      {!isConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured. Add your project values to .env.local.
        </div>
      )}

      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm sm:p-6">
        {activeTab === 'products' && <ProductsSection />}
        {activeTab === 'rules' && <PricingRulesSection />}
        {activeTab === 'assign' && <AssignSection />}
        {activeTab === 'overview' && <OverviewSection />}
      </div>
    </div>
  )
}

export type { BillingTab }
