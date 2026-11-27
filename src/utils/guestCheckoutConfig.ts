/**
 * Guest camp checkout (`/pay/camp`) needs the `guest_checkout_registrations`
 * table and the `create-guest-checkout-session` Edge Function on the club's
 * backend, plus Stripe. It is off unless the deployment opts in, so admins are
 * never handed a payment link that cannot work.
 */
export function isGuestCheckoutEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

export const guestCheckoutEnabled = isGuestCheckoutEnabled(import.meta.env?.VITE_GUEST_CHECKOUT_ENABLED)
