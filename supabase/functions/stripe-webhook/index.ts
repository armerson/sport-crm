import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno&no-check'

Deno.serve(async (request) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const signature = request.headers.get('stripe-signature')
  const body = await request.text()

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', webhookSecret)
  } catch {
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Log event for idempotency — if it already exists, skip
  const { error: logError } = await db.from('payment_events').insert({
    stripe_event_id: event.id,
    type: event.type,
    payload: event,
  })

  if (logError?.code === '23505') {
    // Duplicate — already processed
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Public guest checkout (camp / one-off) — no club account required
        if (session.metadata?.crm_guest_checkout === 'true' && session.metadata?.guest_registration_id) {
          if (session.mode === 'payment' && session.payment_intent) {
            const gid = session.metadata.guest_registration_id
            await db
              .from('guest_checkout_registrations')
              .update({
                status: 'paid',
                stripe_payment_intent_id: session.payment_intent as string,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', gid)
              .eq('status', 'pending_payment')
          }
          break
        }

        const parentId = session.metadata?.crm_parent_id
        if (!parentId) break

        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          await db.from('family_subscriptions').upsert(
            {
              parent_id: parentId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: sub.id,
              status: sub.status,
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              total_pence: sub.items.data.reduce(
                (sum, item) => sum + (item.price.unit_amount ?? 0) * (item.quantity ?? 1),
                0,
              ),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'parent_id' },
          )
        } else if (session.mode === 'payment' && session.payment_intent) {
          const playerIds = (session.metadata?.crm_player_ids ?? '').split(',').filter(Boolean)
          if (playerIds.length > 0) {
            await db.from('one_off_payments').insert({
              parent_id: parentId,
              player_id: playerIds[0],
              stripe_payment_intent_id: session.payment_intent as string,
              amount_pence: session.amount_total ?? 0,
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await db
          .from('family_subscriptions')
          .update({
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await db
          .from('family_subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          await db
            .from('family_subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription as string)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          await db
            .from('family_subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription as string)
        }
        break
      }
    }

    await db
      .from('payment_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id)
  } catch (err) {
    await db
      .from('payment_events')
      .update({ error: err instanceof Error ? err.message : String(err) })
      .eq('stripe_event_id', event.id)
    return new Response(JSON.stringify({ error: 'Event processing failed.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
