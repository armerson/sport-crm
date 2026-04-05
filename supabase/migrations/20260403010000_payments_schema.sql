-- ─────────────────────────────────────────────
-- PAYMENT SYSTEM — Step 1 Schema
-- Currency: GBP stored as integer pence throughout
-- ─────────────────────────────────────────────

-- Products: what the club sells
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  -- Price in pence (e.g. 2500 = £25.00)
  price_pence     integer not null check (price_pence >= 0),
  -- monthly = recurring subscription item; one_off = single charge
  billing_type    text not null check (billing_type in ('monthly', 'one_off')),
  -- Optional: restrict product to a specific team (null = club-wide)
  team_id         uuid references public.teams(id) on delete set null,
  active          boolean not null default true,
  -- Stripe IDs populated when Stripe integration is live
  stripe_product_id text,
  stripe_price_id   text,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

-- Pricing rules: club-wide discount/cap logic
-- Multiple rules can be active simultaneously (applied in order: tiered first, cap second)
create table if not exists public.pricing_rules (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('tiered_discount', 'family_cap')),
  -- tiered_discount config: { "tiers": [{"childIndex": 1, "discountPct": 20}, {"childIndex": 2, "discountPct": 50}] }
  --   childIndex 0 = 1st child (full price), 1 = 2nd child, 2 = 3rd child etc.
  -- family_cap config: { "amountPence": 6000 } (£60.00 max per month)
  config      jsonb not null default '{}',
  active      boolean not null default true,
  label       text,  -- Human-readable description for admin UI
  created_at  timestamptz not null default timezone('utc', now())
);

-- Player–product assignments: which products a player has been enrolled in
create table if not exists public.player_products (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  assigned_by  uuid references public.profiles(id),
  assigned_at  timestamptz not null default timezone('utc', now()),
  -- When set, this assignment ends on this date (e.g. camp with fixed end)
  ends_at      timestamptz,
  unique (player_id, product_id)
);

-- Stripe customer mapping — one per parent profile
create table if not exists public.stripe_customers (
  id                  uuid primary key default gen_random_uuid(),
  parent_id           uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id  text not null unique,
  created_at          timestamptz not null default timezone('utc', now())
);

-- Family subscriptions — one recurring subscription per parent covering all children's monthly products
create table if not exists public.family_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  parent_id               uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  status                  text not null default 'incomplete'
    check (status in ('active', 'past_due', 'cancelled', 'incomplete', 'trialing', 'paused')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  -- Calculated total in pence after all discounts (snapshot at last sync)
  total_pence             integer not null default 0,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

-- Line items within a family subscription
create table if not exists public.subscription_items (
  id                          uuid primary key default gen_random_uuid(),
  subscription_id             uuid not null references public.family_subscriptions(id) on delete cascade,
  player_id                   uuid not null references public.players(id),
  product_id                  uuid not null references public.products(id),
  stripe_subscription_item_id text,
  base_price_pence            integer not null,
  discount_pct                integer not null default 0,
  discount_pence              integer not null default 0,
  final_price_pence           integer not null,
  unique (subscription_id, player_id, product_id)
);

-- One-off payment records (camps, kit, sessions)
create table if not exists public.one_off_payments (
  id                      uuid primary key default gen_random_uuid(),
  parent_id               uuid not null references public.profiles(id),
  player_id               uuid references public.players(id),
  product_id              uuid references public.products(id),
  stripe_payment_intent_id text unique,
  stripe_invoice_id       text unique,
  amount_pence            integer not null,
  status                  text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at                 timestamptz,
  created_at              timestamptz not null default timezone('utc', now())
);

-- Webhook event log — idempotency and audit trail
create table if not exists public.payment_events (
  id               uuid primary key default gen_random_uuid(),
  stripe_event_id  text unique not null,
  type             text not null,
  payload          jsonb,
  processed        boolean not null default false,
  error            text,
  processed_at     timestamptz not null default timezone('utc', now())
);

-- ─────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────

alter table public.products             enable row level security;
alter table public.pricing_rules        enable row level security;
alter table public.player_products      enable row level security;
alter table public.stripe_customers     enable row level security;
alter table public.family_subscriptions enable row level security;
alter table public.subscription_items   enable row level security;
alter table public.one_off_payments     enable row level security;
alter table public.payment_events       enable row level security;

-- Products: admins manage, all authenticated users can read active ones
create policy "admins manage products"
  on public.products for all
  using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read active products"
  on public.products for select
  using (active = true or public.is_admin());

-- Pricing rules: admin only
create policy "admins manage pricing rules"
  on public.pricing_rules for all
  using (public.is_admin()) with check (public.is_admin());

-- Player products: admins manage; parents see their own children's assignments
create policy "admins manage player products"
  on public.player_products for all
  using (public.is_admin()) with check (public.is_admin());

create policy "parents see own children products"
  on public.player_products for select
  using (
    exists (
      select 1 from public.player_parents pp
      where pp.player_id = player_products.player_id
        and pp.parent_id = auth.uid()
    )
  );

-- Stripe customers: own record only (or admin)
create policy "own or admin stripe customer"
  on public.stripe_customers for select
  using (parent_id = auth.uid() or public.is_admin());

create policy "admins manage stripe customers"
  on public.stripe_customers for all
  using (public.is_admin()) with check (public.is_admin());

-- Family subscriptions: parent sees own, admin sees all
create policy "own or admin subscription"
  on public.family_subscriptions for select
  using (parent_id = auth.uid() or public.is_admin());

create policy "admins manage subscriptions"
  on public.family_subscriptions for all
  using (public.is_admin()) with check (public.is_admin());

-- Subscription items: same access as parent subscription
create policy "own or admin subscription items"
  on public.subscription_items for select
  using (
    public.is_admin() or
    exists (
      select 1 from public.family_subscriptions fs
      where fs.id = subscription_items.subscription_id
        and fs.parent_id = auth.uid()
    )
  );

create policy "admins manage subscription items"
  on public.subscription_items for all
  using (public.is_admin()) with check (public.is_admin());

-- One-off payments: own or admin
create policy "own or admin one off payments"
  on public.one_off_payments for select
  using (parent_id = auth.uid() or public.is_admin());

create policy "admins manage one off payments"
  on public.one_off_payments for all
  using (public.is_admin()) with check (public.is_admin());

-- Webhook log: admin only
create policy "admins manage payment events"
  on public.payment_events for all
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────
-- Seed default pricing rules
-- ─────────────────────────────────────────────

insert into public.pricing_rules (type, label, config, active) values
  (
    'tiered_discount',
    'Sibling discount — 2nd child 20% off, 3rd+ child 50% off',
    '{"tiers": [{"childIndex": 1, "discountPct": 20}, {"childIndex": 2, "discountPct": 50}]}'::jsonb,
    true
  ),
  (
    'family_cap',
    'Family monthly cap — maximum £60/month',
    '{"amountPence": 6000}'::jsonb,
    false
  )
on conflict do nothing;
