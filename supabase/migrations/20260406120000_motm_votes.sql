-- ──────────────────────────────────────────────────────────────
-- Man of the Match voting
-- One vote per authenticated user per match event.
-- Any authenticated user can vote; coaches/admins can read all votes.
-- ──────────────────────────────────────────────────────────────

create table public.motm_votes (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references public.events(id) on delete cascade,
  voter_id   uuid        not null references public.profiles(id) on delete cascade,
  player_id  uuid        not null references public.players(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, voter_id)  -- one vote per person per match
);

alter table public.motm_votes enable row level security;

-- Any authenticated user can cast/update their own vote
create policy "motm vote own insert"
  on public.motm_votes
  for insert
  with check (auth.uid() = voter_id);

create policy "motm vote own update"
  on public.motm_votes
  for update
  using (auth.uid() = voter_id);

-- Any authenticated user can read votes (to show tally)
create policy "motm vote read by authenticated"
  on public.motm_votes
  for select
  using (auth.uid() is not null);

-- Real-time
alter publication supabase_realtime add table public.motm_votes;
