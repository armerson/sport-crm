import { supabase, supabaseConfigError } from '../lib/supabase.ts'

export interface GuestProductInfo {
  id: string
  name: string
  description: string | null
  pricePence: number
  billingType: string
}

async function parseInvokeError(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as { context?: Response }).context
    if (ctx instanceof Response) {
      try {
        const j = (await ctx.json()) as { error?: string }
        if (j.error) return j.error
      } catch { /* ignore */ }
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Load a one-off or membership product for the public guest checkout page (no login). */
export async function fetchGuestProduct(productId: string): Promise<GuestProductInfo> {
  if (!supabase) throw new Error(supabaseConfigError)

  const { data, error } = await supabase.functions.invoke('get-guest-product', {
    body: { productId },
  })

  if (error) {
    throw new Error(await parseInvokeError(error, 'Could not load this offer.'))
  }

  const body = data as { error?: string; product?: GuestProductInfo }
  if (body?.error) throw new Error(body.error)
  if (!body?.product) throw new Error('Product not found.')

  return body.product
}

export interface GuestCheckoutPayload {
  productId: string
  guardianEmail: string
  guardianName: string
  childName: string
  childDob: string
  notes?: string
}

/** Start Stripe Checkout for a guest; redirects browser to Stripe. */
export async function startGuestCheckout(payload: GuestCheckoutPayload): Promise<void> {
  if (!supabase) throw new Error(supabaseConfigError)

  const { data, error } = await supabase.functions.invoke('create-guest-checkout-session', {
    body: {
      ...payload,
      redirectOrigin: typeof window !== 'undefined' ? window.location.origin : '',
    },
  })

  if (error) {
    throw new Error(await parseInvokeError(error, 'Could not start payment.'))
  }

  const body = data as { error?: string; url?: string }
  if (body?.error) throw new Error(body.error)
  if (!body?.url) throw new Error('No checkout URL returned.')

  window.location.href = body.url
}
