-- ─────────────────────────────────────────────
-- Player profiles — extended fields
-- ─────────────────────────────────────────────

alter table public.players
  add column if not exists position        text,
  add column if not exists photo_url       text,
  add column if not exists nationality     text,
  add column if not exists dominant_foot   text check (dominant_foot in ('left', 'right', 'both')),
  add column if not exists jersey_number   integer,
  add column if not exists bio             text,
  add column if not exists medical_notes   text,
  add column if not exists updated_at      timestamptz not null default timezone('utc', now());

-- Emergency contacts (separate table — a player may have multiple)
create table if not exists public.emergency_contacts (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  name         text not null,
  relationship text not null,   -- e.g. "Mother", "Father", "Guardian"
  phone        text not null,
  email        text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default timezone('utc', now())
);

alter table public.emergency_contacts enable row level security;

-- Admins manage all contacts
create policy "admins manage emergency contacts"
  on public.emergency_contacts for all
  using (public.is_admin()) with check (public.is_admin());

-- Coaches can read contacts for players in their teams
create policy "coaches read emergency contacts for their players"
  on public.emergency_contacts for select
  using (
    exists (
      select 1
      from public.player_teams pt
      join public.team_coaches tc on tc.team_id = pt.team_id
      where pt.player_id = emergency_contacts.player_id
        and tc.coach_id = auth.uid()
    )
  );

-- Parents can read contacts for their own children
create policy "parents read own children contacts"
  on public.emergency_contacts for select
  using (
    exists (
      select 1 from public.player_parents pp
      where pp.player_id = emergency_contacts.player_id
        and pp.parent_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- Player identity documents
-- (birth certificates, passports — age verification)
-- PRIVATE: signed URLs only, never public
-- ─────────────────────────────────────────────

create table if not exists public.player_documents (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  type          text not null check (type in ('birth_certificate', 'passport', 'other')),
  label         text,                     -- e.g. "Passport - expires Jan 2030"
  storage_path  text not null,            -- path inside the private bucket
  uploaded_by   uuid references public.profiles(id),
  uploaded_at   timestamptz not null default timezone('utc', now()),
  verified      boolean not null default false,
  verified_by   uuid references public.profiles(id),
  verified_at   timestamptz
);

alter table public.player_documents enable row level security;

-- Admins: full access
create policy "admins manage player documents"
  on public.player_documents for all
  using (public.is_admin()) with check (public.is_admin());

-- Coaches: can view documents for players in their teams (read-only)
create policy "coaches read documents for their players"
  on public.player_documents for select
  using (
    exists (
      select 1
      from public.player_teams pt
      join public.team_coaches tc on tc.team_id = pt.team_id
      where pt.player_id = player_documents.player_id
        and tc.coach_id = auth.uid()
    )
  );

-- Parents: can view AND upload documents for their own children only
create policy "parents manage own child documents"
  on public.player_documents for all
  using (
    exists (
      select 1 from public.player_parents pp
      where pp.player_id = player_documents.player_id
        and pp.parent_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.player_parents pp
      where pp.player_id = player_documents.player_id
        and pp.parent_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- Storage buckets
-- ─────────────────────────────────────────────

-- PUBLIC bucket: player profile photos (headshots)
insert into storage.buckets (id, name, public)
  values ('player-photos', 'player-photos', true)
  on conflict (id) do nothing;

create policy "player photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'player-photos');

create policy "admins can upload player photos"
  on storage.objects for insert
  with check (bucket_id = 'player-photos' and public.is_admin());

create policy "admins can update player photos"
  on storage.objects for update
  using (bucket_id = 'player-photos' and public.is_admin());

create policy "admins can delete player photos"
  on storage.objects for delete
  using (bucket_id = 'player-photos' and public.is_admin());

-- PRIVATE bucket: identity documents (birth certs, passports)
-- Never public — access via short-lived signed URLs only
insert into storage.buckets (id, name, public)
  values ('player-documents', 'player-documents', false)
  on conflict (id) do nothing;

-- Admins: full storage access
create policy "admins manage identity documents storage"
  on storage.objects for all
  using (bucket_id = 'player-documents' and public.is_admin())
  with check (bucket_id = 'player-documents' and public.is_admin());

-- Storage access for player-documents is intentionally restrictive.
-- Signed URLs are generated server-side ONLY after the caller has passed
-- database-level RLS on the player_documents table (which gates by role/relationship).
-- Direct object access (non-signed) is limited to admins + parents of the player.
-- Coaches access via signed URLs generated by the server — no direct storage policy needed.

create policy "parents can manage their children documents storage"
  on storage.objects for all
  using (
    bucket_id = 'player-documents'
    and exists (
      -- Extract player_id from path: "<player_id>/filename"
      select 1 from public.player_parents pp
      where pp.player_id = (split_part(name, '/', 1))::uuid
        and pp.parent_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'player-documents'
    and exists (
      select 1 from public.player_parents pp
      where pp.player_id = (split_part(name, '/', 1))::uuid
        and pp.parent_id = auth.uid()
    )
  );
