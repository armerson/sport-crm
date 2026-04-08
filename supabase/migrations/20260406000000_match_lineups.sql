-- ──────────────────────────────────────────────────────────────
-- Match lineups — coach-managed squad selection per match event
-- Idempotent: safe if table already exists (remote drift / partial apply).
-- ──────────────────────────────────────────────────────────────

create table if not exists public.match_lineups (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references public.events(id) on delete cascade,
  player_id  uuid        not null references public.players(id) on delete cascade,
  is_starting boolean    not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, player_id)
);

alter table public.match_lineups enable row level security;

-- Helper: can the current user manage the lineup for this event?
create or replace function public.can_manage_event_lineup(evt_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and (
      'admin' = any(p.roles)
      or exists (
        select 1 from public.team_coaches tc
        join public.events e on e.team_id = tc.team_id
        where e.id = evt_id
          and tc.coach_id = auth.uid()
      )
    )
  );
$$;

drop policy if exists "lineup read by authenticated" on public.match_lineups;
drop policy if exists "lineup insert by coach or admin" on public.match_lineups;
drop policy if exists "lineup update by coach or admin" on public.match_lineups;
drop policy if exists "lineup delete by coach or admin" on public.match_lineups;

create policy "lineup read by authenticated"
  on public.match_lineups
  for select
  using (auth.uid() is not null);

create policy "lineup insert by coach or admin"
  on public.match_lineups
  for insert
  with check (public.can_manage_event_lineup(event_id));

create policy "lineup update by coach or admin"
  on public.match_lineups
  for update
  using (public.can_manage_event_lineup(event_id));

create policy "lineup delete by coach or admin"
  on public.match_lineups
  for delete
  using (public.can_manage_event_lineup(event_id));

-- Real-time (skip if already in publication)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_lineups'
  ) then
    alter publication supabase_realtime add table public.match_lineups;
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────
-- Club-wide attendance rate (last N days) — used by admin dashboard
-- ──────────────────────────────────────────────────────────────

create or replace function public.club_attendance_rate(days_back integer default 60)
returns table(attended bigint, total bigint)
language sql
security definer
as $$
  select
    count(*) filter (where a.status = 'yes') as attended,
    count(*)                                  as total
  from public.attendance a
  join public.events e on e.id = a.event_id
  where e.date_time > now() - make_interval(days => days_back)
    and e.date_time < now();
$$;
