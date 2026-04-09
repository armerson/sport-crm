-- Guest (no club account) checkout for camps / one-off products.
-- Rows created by Edge Function; marked paid by Stripe webhook.

create table if not exists public.guest_checkout_registrations (
  id                        uuid primary key default gen_random_uuid(),
  product_id                uuid not null references public.products(id) on delete restrict,
  guardian_email            text not null,
  guardian_name             text not null,
  child_name                text not null,
  child_dob                 text not null,
  notes                     text,
  extra                     jsonb not null default '{}',
  status                    text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'cancelled')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text unique,
  amount_pence              integer not null check (amount_pence >= 0),
  paid_at                   timestamptz,
  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now())
);

create index if not exists guest_checkout_registrations_status_created_idx
  on public.guest_checkout_registrations (status, created_at desc);

alter table public.guest_checkout_registrations enable row level security;

create policy "admins read guest checkout registrations"
  on public.guest_checkout_registrations for select
  using (public.is_admin());

create policy "admins manage guest checkout registrations"
  on public.guest_checkout_registrations for all
  using (public.is_admin()) with check (public.is_admin());

comment on table public.guest_checkout_registrations is
  'Public camp/one-off payments without a club login; service role inserts/updates from Edge + webhook.';
