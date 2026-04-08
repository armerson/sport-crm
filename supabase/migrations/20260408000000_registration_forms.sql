-- ─────────────────────────────────────────────
-- Registration Forms
-- ─────────────────────────────────────────────

create table if not exists public.registration_forms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  form_type   text not null default 'other'
    check (form_type in ('club_membership', 'camp', 'trial', 'event', 'other')),
  team_id     uuid references public.teams(id) on delete set null,
  -- URL-safe slug for the public link (e.g. "u12-summer-camp-2026")
  slug        text not null unique,
  deadline    timestamptz,
  active          boolean not null default true,
  requires_login  boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create table if not exists public.form_fields (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references public.registration_forms(id) on delete cascade,
  label       text not null,
  -- text | email | phone | date | number | textarea | select | checkbox | checkboxes
  field_type  text not null default 'text'
    check (field_type in ('text', 'email', 'phone', 'date', 'number', 'textarea', 'select', 'checkbox', 'checkboxes')),
  required    boolean not null default false,
  -- JSON array of option strings for select / checkboxes, e.g. ["U10","U12","U14"]
  options     jsonb,
  placeholder text,
  sort_order  integer not null default 0
);

create table if not exists public.form_submissions (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null references public.registration_forms(id) on delete cascade,
  submitter_name  text not null,
  submitter_email text not null,
  status          text not null default 'new'
    check (status in ('new', 'reviewed', 'accepted', 'rejected')),
  notes           text,
  submitted_at    timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create table if not exists public.form_responses (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete cascade,
  field_id      uuid not null references public.form_fields(id) on delete cascade,
  value         text
);

-- Club-wide settings (single row, upserted by admins)
create table if not exists public.club_settings (
  id          integer primary key default 1 check (id = 1),
  name        text not null default 'My Club',
  logo_url    text,
  updated_at  timestamptz not null default timezone('utc', now())
);

insert into public.club_settings (id, name) values (1, 'My Club') on conflict do nothing;

alter table public.club_settings enable row level security;

create policy "anyone reads club settings"
  on public.club_settings for select using (true);

create policy "admins manage club settings"
  on public.club_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────

alter table public.registration_forms enable row level security;
alter table public.form_fields        enable row level security;
alter table public.form_submissions   enable row level security;
alter table public.form_responses     enable row level security;

-- Anyone can read active forms and their fields (public registration links)
create policy "public read active forms"
  on public.registration_forms for select
  using (active = true or public.is_admin());

create policy "admins manage forms"
  on public.registration_forms for all
  using (public.is_admin()) with check (public.is_admin());

create policy "public read fields for active form"
  on public.form_fields for select
  using (
    exists (
      select 1 from public.registration_forms f
      where f.id = form_fields.form_id and (f.active = true or public.is_admin())
    )
  );

create policy "admins manage form fields"
  on public.form_fields for all
  using (public.is_admin()) with check (public.is_admin());

-- Anyone can submit (anonymous allowed)
create policy "anyone can submit"
  on public.form_submissions for insert
  with check (true);

create policy "admins read all submissions"
  on public.form_submissions for select
  using (public.is_admin());

create policy "admins update submissions"
  on public.form_submissions for update
  using (public.is_admin()) with check (public.is_admin());

create policy "anyone can insert responses"
  on public.form_responses for insert
  with check (true);

create policy "admins read responses"
  on public.form_responses for select
  using (public.is_admin());

-- Add forms to realtime
do $$ begin
  alter publication supabase_realtime add table public.registration_forms;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.form_submissions;
exception when duplicate_object then null;
end $$;
