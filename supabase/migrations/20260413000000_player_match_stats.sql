-- Per-player match statistics (goals, assists, cards)
create table if not exists public.player_match_stats (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id)   on delete cascade,
  player_id     uuid not null references public.players(id)  on delete cascade,
  team_id       uuid not null references public.teams(id)    on delete cascade,
  goals         int  not null default 0 check (goals >= 0),
  assists       int  not null default 0 check (assists >= 0),
  yellow_cards  int  not null default 0 check (yellow_cards between 0 and 2),
  red_cards     int  not null default 0 check (red_cards between 0 and 1),
  created_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now(),
  unique (event_id, player_id)
);

alter table public.player_match_stats enable row level security;

-- Coaches can insert/update/delete stats for their teams
create policy "coaches_manage_match_stats" on public.player_match_stats
  for all using (
    exists (
      select 1 from public.team_coaches tc
      where tc.team_id = player_match_stats.team_id
        and tc.coach_id = auth.uid()
    )
  );

-- Admins can manage all
create policy "admins_manage_match_stats" on public.player_match_stats
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and 'admin' = any(p.roles)
    )
  );

-- Everyone can read (parents/players see their own data via the app)
create policy "read_match_stats" on public.player_match_stats
  for select using (true);
