-- ============================================================
-- Match Results
-- ============================================================

create table if not exists public.results (
  id          uuid        primary key default gen_random_uuid(),
  event_id    uuid        not null unique references public.events(id) on delete cascade,
  home_score  integer     not null check (home_score >= 0),
  away_score  integer     not null check (away_score >= 0),
  notes       text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

alter table public.results enable row level security;

-- All club members with event access can read results
create policy "results read by access" on public.results
for select using (
  exists (
    select 1 from public.events e
    where e.id = results.event_id and (
      public.is_admin()
      or public.is_coach_for_team(e.team_id)
      or exists (
        select 1
        from   public.player_teams  pt
        join   public.player_parents pp on pp.player_id = pt.player_id
        where  pt.team_id = e.team_id and pp.parent_id = auth.uid()
      )
    )
  )
);

-- Admins and coaches for the event's team can write results
create policy "results write by coach or admin" on public.results
for all using (
  exists (
    select 1 from public.events e
    where e.id = results.event_id
      and (public.is_admin() or public.is_coach_for_team(e.team_id))
  )
) with check (
  exists (
    select 1 from public.events e
    where e.id = results.event_id
      and (public.is_admin() or public.is_coach_for_team(e.team_id))
  )
);

alter publication supabase_realtime add table public.results;
