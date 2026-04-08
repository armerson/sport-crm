import { supabase } from '../lib/supabase.ts'

type CheckoutMode = 'subscription' | 'payment'

async function invokeStripeFunction(fnName: string, body: Record<string, unknown>): Promise<{ url: string }> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.functions.invoke(fnName, {
    body: { ...body, redirectOrigin: window.location.origin },
  })

  if (error) {
    let message = 'Billing request failed.'
    if (error.context instanceof Response) {
      try {
        const json = await error.context.json() as { error?: string }
        if (json.error) message = json.error
      } catch { /* use fallback */ }
    } else if (error.message) {
      message = error.message
    }
    throw new Error(message)
  }

  if (!data?.url) throw new Error('No checkout URL returned.')
  return { url: data.url as string }
}

/** Redirect the user to a Stripe Checkout session (subscription or payment mode). */
export async function redirectToCheckout(mode: CheckoutMode): Promise<void> {
  const { url } = await invokeStripeFunction('create-checkout-session', { mode })
  window.location.href = url
}

/** Redirect the user to the Stripe Customer Portal to manage subscriptions / invoices. */
export async function redirectToPortal(): Promise<void> {
  const { url } = await invokeStripeFunction('create-portal-session', {})
  window.location.href = url
}
