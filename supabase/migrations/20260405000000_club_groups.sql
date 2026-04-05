-- ============================================================
-- Club Groups & Group Messaging
-- ============================================================
-- Groups are hierarchical (parent_id → self-reference).
-- Messages gain a nullable group_id and keep a nullable team_id.
-- Club-wide broadcasts have both team_id and group_id as NULL.

-- 1. Groups table (adjacency list, arbitrary depth)
create table if not exists public.groups (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  parent_id  uuid        references public.groups(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- 2. group_teams junction
create table if not exists public.group_teams (
  group_id uuid not null references public.groups(id)  on delete cascade,
  team_id  uuid not null references public.teams(id)   on delete cascade,
  primary key (group_id, team_id)
);

-- 3. Extend messages: make team_id nullable, add group_id
alter table public.messages
  alter column team_id drop not null;

alter table public.messages
  add column if not exists group_id uuid references public.groups(id) on delete set null;

-- A message must target exactly one of: team, group, or club-wide (both null).
alter table public.messages
  drop constraint if exists messages_target_check;

alter table public.messages
  add constraint messages_target_check check (
    not (team_id is not null and group_id is not null)
  );

-- Fast lookup indexes
create index if not exists messages_group_id_idx on public.messages (group_id) where group_id is not null;
create index if not exists groups_parent_id_idx  on public.groups (parent_id)  where parent_id is not null;

-- 4. Recursive helper: all team IDs reachable from a given root group
create or replace function public.teams_in_group(root_group_id uuid)
returns table (team_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  with recursive group_tree as (
    select id from public.groups where id = root_group_id
    union all
    select g.id from public.groups g
    inner join group_tree gt on g.parent_id = gt.id
  )
  select gt2.team_id
  from   public.group_teams gt2
  where  gt2.group_id in (select id from group_tree)
$$;

-- 5. Enable realtime for new tables
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_teams;

-- 6. RLS for groups
alter table public.groups enable row level security;

create policy "groups read by authenticated"
  on public.groups for select
  using (auth.uid() is not null);

create policy "groups admin write"
  on public.groups for all
  using  (public.is_admin())
  with check (public.is_admin());

-- 7. RLS for group_teams
alter table public.group_teams enable row level security;

create policy "group_teams read by authenticated"
  on public.group_teams for select
  using (auth.uid() is not null);

create policy "group_teams admin write"
  on public.group_teams for all
  using  (public.is_admin())
  with check (public.is_admin());

-- 8. Drop old message policies (they assume team_id is NOT NULL)
drop policy if exists "messages read by access"   on public.messages;
drop policy if exists "messages insert by access" on public.messages;

-- 9. New message policies covering team, group, and club-wide messages
create policy "messages read by access" on public.messages
for select using (
  -- Club-wide broadcast: both nulls, visible to all authenticated users
  (team_id is null and group_id is null and auth.uid() is not null)
  -- Group message: admin, or coaches/parents whose teams are in the group subtree
  or (group_id is not null and (
    public.is_admin()
    or exists (
      select 1 from public.teams_in_group(group_id) tig
      where public.is_coach_for_team(tig.team_id)
    )
    or exists (
      select 1
      from   public.teams_in_group(group_id) tig
      join   public.player_teams  pt  on pt.team_id  = tig.team_id
      join   public.player_parents pp on pp.player_id = pt.player_id
      where  pp.parent_id = auth.uid()
    )
  ))
  -- Team message: original logic
  or (team_id is not null and (
    public.is_admin()
    or public.is_coach_for_team(team_id)
    or exists (
      select 1
      from   public.player_teams  pt
      join   public.player_parents pp on pp.player_id = pt.player_id
      where  pt.team_id = messages.team_id and pp.parent_id = auth.uid()
    )
  ))
);

create policy "messages insert by access" on public.messages
for insert with check (
  auth.uid() = sender_id and (
    -- Club-wide or group message: admin only
    (team_id is null and public.is_admin())
    -- Team message: original rules
    or (team_id is not null and (
      public.is_admin()
      or public.is_coach_for_team(team_id)
      or exists (
        select 1
        from   public.player_teams  pt
        join   public.player_parents pp on pp.player_id = pt.player_id
        where  pt.team_id = messages.team_id and pp.parent_id = auth.uid()
      )
    ))
  )
);
