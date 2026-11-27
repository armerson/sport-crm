-- ClubOS control plane: the operator-owned directory of clubs.
--
-- This project never holds member, child, payment or safeguarding records.
-- Club data stays in each club's own backend (ADR 0001). Here we keep only:
--   clubs                    the registry the app validates and uses
--   club_domains             app and website domains per club
--   platform_admins          ClubOS operators (no access to club databases)
--   onboarding_applications  clubs asking to join, reviewed by operators
--   support_access_log       append-only record of operator support access
-- Members read the directory through the `clubs_public` view only.

create schema if not exists cp_private;
revoke all on schema cp_private from public, anon;
grant usage on schema cp_private to authenticated, service_role;

create table public.platform_admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  added_at  timestamptz not null default now(),
  added_by  uuid references auth.users(id)
);

create function cp_private.is_platform_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke all on function cp_private.is_platform_admin() from public, anon;
grant execute on function cp_private.is_platform_admin() to authenticated, service_role;

-- Rejects secret keys: sb_secret_ keys and JWTs whose role is service_role.
create function cp_private.is_public_client_key(key text)
returns boolean language plpgsql immutable set search_path = public
as $$
declare
  part text;
  claims jsonb;
begin
  if key is null then return true; end if;
  if key like 'sb_secret_%' then return false; end if;
  if key like 'sb_publishable_%' then return true; end if;
  if key !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then return false; end if;
  part := translate(split_part(key, '.', 2), '-_', '+/');
  part := part || repeat('=', (4 - length(part) % 4) % 4);
  claims := convert_from(decode(part, 'base64'), 'utf8')::jsonb;
  return claims->>'role' = 'anon';
exception when others then
  return false;
end;
$$;

create table public.clubs (
  code             text primary key check (code ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$'),
  name             text not null check (length(btrim(name)) between 2 and 120),
  sport            text not null default 'football' check (sport ~ '^[a-z][a-z0-9-]{1,39}$'),
  status           text not null default 'onboarding' check (status in ('onboarding', 'active', 'suspended')),
  town             text check (length(town) <= 80),
  region           text check (length(region) <= 80),
  country          text check (length(country) <= 80),
  primary_color    text check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color  text check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  badge_url        text check (badge_url ~ '^https://'),
  origin           text unique check (origin ~ '^https://[^/]+$'),
  website          text check (website ~ '^https://'),
  supabase_url     text unique check (supabase_url ~ '^https://[^/]+$'),
  anon_key         text check (cp_private.is_public_client_key(anon_key)),
  plan             text check (plan ~ '^[a-z][a-z0-9-]{1,39}$'),
  features         jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  operator_notes   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((supabase_url is null) = (anon_key is null)),
  check (status <> 'active' or origin is not null or supabase_url is not null)
);

create table public.club_domains (
  id          uuid primary key default gen_random_uuid(),
  club_code   text not null references public.clubs(code) on update cascade on delete cascade,
  domain      text not null unique check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  kind        text not null check (kind in ('app', 'website')),
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.onboarding_applications (
  id               uuid primary key default gen_random_uuid(),
  club_name        text not null check (length(btrim(club_name)) between 2 and 120),
  sport            text not null default 'football' check (sport ~ '^[a-z][a-z0-9-]{1,39}$'),
  contact_name     text not null check (length(btrim(contact_name)) between 2 and 120),
  contact_email    text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(contact_email) <= 254),
  contact_phone    text check (length(contact_phone) <= 40),
  town             text check (length(town) <= 80),
  region           text check (length(region) <= 80),
  country          text check (length(country) <= 80),
  website          text check (website ~ '^https?://' and length(website) <= 300),
  primary_color    text check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color  text check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  age_groups       text check (length(age_groups) <= 500),
  team_count       int check (team_count between 0 and 500),
  season_start     date,
  season_end       date check (season_end is null or season_start is null or season_end > season_start),
  payment_methods  text[] not null default '{}' check (payment_methods <@ array['card', 'standing_order', 'cash', 'bank_transfer', 'other']),
  website_wanted   boolean not null default false,
  notes            text check (length(notes) <= 2000),
  status           text not null default 'submitted' check (status in ('submitted', 'reviewing', 'approved', 'rejected')),
  club_code        text references public.clubs(code) on update cascade on delete set null,
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create table public.support_access_log (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null default auth.uid() references auth.users(id),
  club_code    text not null references public.clubs(code) on update cascade,
  reason       text not null check (length(btrim(reason)) >= 10 and length(reason) <= 1000),
  scope        text not null check (scope in ('configuration', 'read_only', 'data_fix')),
  approved_by_club text check (length(approved_by_club) <= 200),
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz not null default now() + interval '2 hours',
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);

create function cp_private.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at := now(); return new; end; $$;
create trigger clubs_touch_updated_at before update on public.clubs
  for each row execute function cp_private.touch_updated_at();

-- Row level security: operators manage everything; the public can only apply.
alter table public.platform_admins enable row level security;
alter table public.clubs enable row level security;
alter table public.club_domains enable row level security;
alter table public.onboarding_applications enable row level security;
alter table public.support_access_log enable row level security;

revoke all on public.platform_admins, public.clubs, public.club_domains,
  public.onboarding_applications, public.support_access_log from public, anon, authenticated;

grant select on public.platform_admins to authenticated;
create policy platform_admins_read on public.platform_admins for select to authenticated
  using (cp_private.is_platform_admin());

grant select, insert, update, delete on public.clubs, public.club_domains to authenticated;
create policy clubs_operators on public.clubs for all to authenticated
  using (cp_private.is_platform_admin()) with check (cp_private.is_platform_admin());
create policy club_domains_operators on public.club_domains for all to authenticated
  using (cp_private.is_platform_admin()) with check (cp_private.is_platform_admin());

-- Anyone may apply; nobody but operators may read or change applications.
grant insert on public.onboarding_applications to anon, authenticated;
grant select, update on public.onboarding_applications to authenticated;
create policy onboarding_apply on public.onboarding_applications for insert to anon, authenticated
  with check (status = 'submitted' and club_code is null and reviewed_by is null and reviewed_at is null);
create policy onboarding_operators_read on public.onboarding_applications for select to authenticated
  using (cp_private.is_platform_admin());
create policy onboarding_operators_review on public.onboarding_applications for update to authenticated
  using (cp_private.is_platform_admin()) with check (cp_private.is_platform_admin());

-- Support access is append-only: operators record their own access; no edits or deletes.
grant select, insert on public.support_access_log to authenticated;
create policy support_log_read on public.support_access_log for select to authenticated
  using (cp_private.is_platform_admin());
create policy support_log_record on public.support_access_log for insert to authenticated
  with check (cp_private.is_platform_admin() and operator_id = auth.uid());

-- The public directory: active clubs only, shaped as registry entries that the
-- app validates with src/clubos/registry.ts. Runs as its owner on purpose so it
-- can expose these columns without exposing the clubs table or operator notes.
create view public.clubs_public with (security_barrier = true) as
select
  c.code,
  jsonb_strip_nulls(jsonb_build_object(
    'code', c.code,
    'name', c.name,
    'sport', c.sport,
    'status', c.status,
    'location', case when c.town is not null then jsonb_strip_nulls(jsonb_build_object('town', c.town, 'region', c.region, 'country', c.country)) end,
    'branding', case when c.primary_color is not null then jsonb_strip_nulls(jsonb_build_object('primaryColor', c.primary_color, 'secondaryColor', c.secondary_color, 'badgeUrl', c.badge_url)) end,
    'origin', c.origin,
    'website', c.website,
    'backend', case when c.supabase_url is not null then jsonb_build_object('supabaseUrl', c.supabase_url, 'anonKey', c.anon_key) end,
    'plan', c.plan,
    'features', case when c.features <> '{}'::jsonb then c.features end
  )) as entry
from public.clubs c
where c.status = 'active';

revoke all on public.clubs_public from public, anon, authenticated;
grant select on public.clubs_public to anon, authenticated;

comment on view public.clubs_public is
  'Active clubs as ClubOS registry entries. Public: contains only public keys and branding.';
