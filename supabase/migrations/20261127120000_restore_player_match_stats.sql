-- Restore per-player match statistics with member-only access.
--
-- 20260413000000 created this table, but it was later removed from some
-- hosted databases outside the migration history, so coaches could not save
-- goals, assists or cards. This migration recreates it where it is missing
-- and replaces the original policies everywhere.
--
-- The original read policy was `using (true)` for every role, which let
-- anyone (including signed-out visitors) read children's match statistics.
-- Reading is now limited to signed-in people who can already see the team:
-- admins, the team's coaches, and parents or linked players of its squad.
-- Writing is limited to admins and the team's coaches.
--
-- Safe to run more than once. Never drops data.

create table if not exists public.player_match_stats (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id)   on delete cascade,
  player_id     uuid not null references public.players(id)  on delete cascade,
  team_id       uuid not null references public.teams(id)    on delete cascade,
  goals         int  not null default 0 check (goals >= 0),
  assists       int  not null default 0 check (assists >= 0),
  yellow_cards  int  not null default 0 check (yellow_cards between 0 and 2),
  red_cards     int  not null default 0 check (red_cards between 0 and 1),
  created_by    uuid references auth.users(id) default auth.uid(),
  updated_at    timestamptz not null default now(),
  unique (event_id, player_id)
);

alter table public.player_match_stats alter column created_by set default auth.uid();

create index if not exists player_match_stats_team_idx on public.player_match_stats (team_id);

alter table public.player_match_stats enable row level security;

revoke all on public.player_match_stats from public, anon, authenticated;
grant select, insert, update, delete on public.player_match_stats to authenticated;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'player_match_stats'
  loop
    execute format('drop policy %I on public.player_match_stats', p.policyname);
  end loop;
end
$$;

create policy player_match_stats_read on public.player_match_stats
  for select to authenticated
  using (crm_private.can_access_team(team_id));

-- A row must describe a match of the same team. Coaches may only record
-- players in their team's squad; admins may correct any row.
create policy player_match_stats_write on public.player_match_stats
  for all to authenticated
  using (public.is_admin() or public.is_coach_for_team(team_id))
  with check (
    exists (select 1 from public.events e where e.id = player_match_stats.event_id and e.team_id = player_match_stats.team_id)
    and (
      public.is_admin()
      or (
        public.is_coach_for_team(team_id)
        and exists (
          select 1 from public.player_teams pt
          where pt.player_id = player_match_stats.player_id and pt.team_id = player_match_stats.team_id
        )
      )
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_match_stats'
    )
  then
    alter publication supabase_realtime add table public.player_match_stats;
  end if;
end
$$;

comment on table public.player_match_stats is
  'Goals, assists and cards per player per match. Readable by people who can see the team; written by its coaches and admins.';
