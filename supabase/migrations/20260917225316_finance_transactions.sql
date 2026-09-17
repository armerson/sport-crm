-- Normalised cash ledger for the admin finance dashboard.
-- Stripe remains the payment processor; this table is the local reporting copy.

create table public.finance_transactions (
  id                        uuid primary key default gen_random_uuid(),
  source_type               text not null
    check (source_type in ('subscription_invoice', 'member_checkout', 'guest_checkout', 'manual')),
  external_id               text unique,
  stripe_payment_intent_id  text,
  stripe_invoice_id         text,
  parent_id                 uuid references public.profiles(id) on delete set null,
  player_id                 uuid references public.players(id) on delete set null,
  product_id                uuid references public.products(id) on delete set null,
  guest_registration_id     uuid,
  payer_name                text,
  payer_email               text,
  description               text not null default 'Club payment',
  amount_pence              integer not null check (amount_pence >= 0),
  currency                  text not null default 'gbp' check (currency ~ '^[a-z]{3}$'),
  status                    text not null
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at                   timestamptz,
  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now())
);

create index finance_transactions_status_paid_idx
  on public.finance_transactions (status, paid_at desc nulls last);
create index finance_transactions_parent_idx
  on public.finance_transactions (parent_id, created_at desc);

alter table public.finance_transactions enable row level security;

create policy "admins read finance transactions"
  on public.finance_transactions for select
  using (public.is_admin());

comment on table public.finance_transactions is
  'Admin reporting ledger populated from verified Stripe webhook events.';

-- Some existing club installations predate public guest checkout. Add the
-- relationship only where that optional table is present.
do $$
begin
  if to_regclass('public.guest_checkout_registrations') is not null then
    alter table public.finance_transactions
      add constraint finance_transactions_guest_registration_id_fkey
      foreign key (guest_registration_id)
      references public.guest_checkout_registrations(id) on delete set null;
  end if;
end $$;

-- Preserve the payment history already held by the app. Future entries are
-- written directly by the Stripe webhook with stable external identifiers.
insert into public.finance_transactions (
  source_type, external_id, stripe_payment_intent_id, stripe_invoice_id,
  parent_id, player_id, product_id, payer_name, payer_email, description,
  amount_pence, status, paid_at, created_at
)
select
  'member_checkout',
  coalesce(p.stripe_payment_intent_id, 'one_off:' || p.id::text),
  p.stripe_payment_intent_id,
  p.stripe_invoice_id,
  p.parent_id,
  p.player_id,
  p.product_id,
  pr.name,
  pr.email,
  coalesce(prod.name, 'Club payment'),
  p.amount_pence,
  p.status,
  p.paid_at,
  p.created_at
from public.one_off_payments p
left join public.profiles pr on pr.id = p.parent_id
left join public.products prod on prod.id = p.product_id
on conflict (external_id) do nothing;

do $$
begin
  if to_regclass('public.guest_checkout_registrations') is not null then
    execute $backfill$
      insert into public.finance_transactions (
        source_type, external_id, stripe_payment_intent_id, product_id,
        guest_registration_id, payer_name, payer_email, description,
        amount_pence, status, paid_at, created_at
      )
      select
        'guest_checkout',
        coalesce(g.stripe_payment_intent_id, 'guest:' || g.id::text),
        g.stripe_payment_intent_id,
        g.product_id,
        g.id,
        g.guardian_name,
        g.guardian_email,
        coalesce(prod.name, 'Guest checkout'),
        g.amount_pence,
        case g.status when 'paid' then 'paid' when 'cancelled' then 'failed' else 'pending' end,
        g.paid_at,
        g.created_at
      from public.guest_checkout_registrations g
      left join public.products prod on prod.id = g.product_id
      on conflict (external_id) do nothing
    $backfill$;
  end if;
end $$;
