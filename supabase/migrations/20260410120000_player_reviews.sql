-- Player development reviews — written by coaches, optionally published to parents.
create table if not exists public.player_reviews (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete cascade,
  coach_id        uuid references public.profiles(id) on delete set null,
  -- e.g. "Mid-Season 2025/26", "End of Season 2025/26"
  period_label    text not null,
  -- Skill ratings 1–5 (null = not rated)
  rating_technical  smallint check (rating_technical  between 1 and 5),
  rating_tactical   smallint check (rating_tactical   between 1 and 5),
  rating_physical   smallint check (rating_physical   between 1 and 5),
  rating_attitude   smallint check (rating_attitude   between 1 and 5),
  -- Parent-visible text
  strengths           text check (char_length(strengths)         <= 1000),
  areas_to_improve    text check (char_length(areas_to_improve)  <= 1000),
  -- Coach/admin only
  coach_notes         text check (char_length(coach_notes)       <= 2000),
  -- Workflow
  status          text not null default 'draft' check (status in ('draft', 'published')),
  published_at    timestamptz,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  -- One review per player per period per team
  unique (player_id, team_id, period_label)
);

create index if not exists player_reviews_player_id_idx on public.player_reviews(player_id);
create index if not exists player_reviews_team_id_idx   on public.player_reviews(team_id);

alter table public.player_reviews enable row level security;

-- Coaches can read all reviews for their teams
create policy "coaches read own team reviews"
  on public.player_reviews for select
  to authenticated
  using (
    exists (
      select 1 from public.team_coaches
      where team_coaches.team_id = player_reviews.team_id
        and team_coaches.coach_id = auth.uid()
    )
    or public.is_admin()
  );

-- Parents can read published reviews for their children only
create policy "parents read published child reviews"
  on public.player_reviews for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.player_parents
      where player_parents.player_id = player_reviews.player_id
        and player_parents.parent_id = auth.uid()
    )
  );

-- Coaches can insert reviews for their team's players
create policy "coaches insert own team reviews"
  on public.player_reviews for insert
  to authenticated
  with check (
    exists (
      select 1 from public.team_coaches
      where team_coaches.team_id = player_reviews.team_id
        and team_coaches.coach_id = auth.uid()
    )
    or public.is_admin()
  );

-- Coaches can update reviews they wrote (or admins)
create policy "coaches update own reviews"
  on public.player_reviews for update
  to authenticated
  using (coach_id = auth.uid() or public.is_admin())
  with check (coach_id = auth.uid() or public.is_admin());

-- Coaches/admins can delete their own reviews
create policy "coaches delete own reviews"
  on public.player_reviews for delete
  to authenticated
  using (coach_id = auth.uid() or public.is_admin());

-- Auto-update updated_at
create or replace function public.touch_player_review()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  if new.status = 'published' and old.status = 'draft' then
    new.published_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

create trigger player_reviews_updated
  before update on public.player_reviews
  for each row execute procedure public.touch_player_review();

-- Realtime
alter publication supabase_realtime add table public.player_reviews;
