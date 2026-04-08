-- ─────────────────────────────────────────────
-- Events: add rich location fields
-- ─────────────────────────────────────────────

alter table public.events
  add column if not exists place_id  text,        -- Google Place ID for embed/link
  add column if not exists lat       numeric,
  add column if not exists lng       numeric;

-- ─────────────────────────────────────────────
-- Products: subscription duration + membership fee type
-- ─────────────────────────────────────────────

-- Allow the new billing types and duration
alter table public.products
  drop constraint if exists products_billing_type_check;

alter table public.products
  add constraint products_billing_type_check
    check (billing_type in ('monthly', 'one_off', 'membership'));

-- How many months to collect for a monthly subscription (null = ongoing)
alter table public.products
  add column if not exists duration_months integer check (duration_months is null or duration_months > 0);

-- Optional: season label for membership fee (e.g. "2025/26 Season")
alter table public.products
  add column if not exists season_label text;
