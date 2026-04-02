create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'coach', 'parent')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age_group text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dob date not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_coaches (
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (team_id, coach_id)
);

create table if not exists public.player_teams (
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (player_id, team_id)
);

create table if not exists public.player_parents (
  player_id uuid not null references public.players(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (player_id, parent_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  type text not null check (type in ('training', 'match')),
  date_time timestamptz not null,
  location text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'pending')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, player_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  actor_name text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  summary text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.team_coaches enable row level security;
alter table public.player_teams enable row level security;
alter table public.player_parents enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.messages enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'admin'
$$;

create or replace function public.is_coach_for_team(team uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.team_coaches where team_id = team and coach_id = auth.uid()
  )
$$;

create or replace function public.is_parent_for_player(player uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.player_parents where player_id = player and parent_id = auth.uid()
  )
$$;

create policy "profiles self or admin read" on public.profiles
for select using (
  auth.uid() = id or public.is_admin()
  or exists (
    select 1 from public.team_coaches tc where tc.coach_id = auth.uid() and tc.coach_id = profiles.id
  )
);

create policy "profiles self insert" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles self update" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "teams read by access" on public.teams
for select using (
  public.is_admin()
  or public.is_coach_for_team(id)
  or exists (
    select 1
    from public.player_teams pt
    join public.player_parents pp on pp.player_id = pt.player_id
    where pt.team_id = teams.id and pp.parent_id = auth.uid()
  )
);

create policy "teams admin write" on public.teams
for all using (public.is_admin()) with check (public.is_admin());

create policy "players read by access" on public.players
for select using (
  public.is_admin()
  or public.is_parent_for_player(id)
  or exists (
    select 1 from public.player_teams pt
    join public.team_coaches tc on tc.team_id = pt.team_id
    where pt.player_id = players.id and tc.coach_id = auth.uid()
  )
);

create policy "players admin write" on public.players
for all using (public.is_admin()) with check (public.is_admin());

create policy "team coaches read by access" on public.team_coaches
for select using (public.is_admin() or coach_id = auth.uid() or public.is_coach_for_team(team_id));

create policy "team coaches admin write" on public.team_coaches
for all using (public.is_admin()) with check (public.is_admin());

create policy "player teams read by access" on public.player_teams
for select using (
  public.is_admin()
  or public.is_coach_for_team(team_id)
  or public.is_parent_for_player(player_id)
);

create policy "player teams admin write" on public.player_teams
for all using (public.is_admin()) with check (public.is_admin());

create policy "player parents read by access" on public.player_parents
for select using (public.is_admin() or parent_id = auth.uid());

create policy "player parents admin write" on public.player_parents
for all using (public.is_admin()) with check (public.is_admin());

create policy "events read by access" on public.events
for select using (public.is_admin() or public.is_coach_for_team(team_id)
  or exists (
    select 1
    from public.player_teams pt
    join public.player_parents pp on pp.player_id = pt.player_id
    where pt.team_id = events.team_id and pp.parent_id = auth.uid()
  )
);

create policy "events coaches or admin write" on public.events
for insert with check (public.is_admin() or public.is_coach_for_team(team_id));

create policy "attendance read by access" on public.attendance
for select using (
  public.is_admin()
  or public.is_parent_for_player(player_id)
  or exists (
    select 1 from public.events e where e.id = attendance.event_id and public.is_coach_for_team(e.team_id)
  )
);

create policy "attendance coaches or admin insert" on public.attendance
for insert with check (
  public.is_admin()
  or exists (
    select 1 from public.events e where e.id = attendance.event_id and public.is_coach_for_team(e.team_id)
  )
);

create policy "attendance parents update" on public.attendance
for update using (public.is_parent_for_player(player_id) or public.is_admin())
with check (public.is_parent_for_player(player_id) or public.is_admin());

create policy "messages read by access" on public.messages
for select using (
  public.is_admin()
  or public.is_coach_for_team(team_id)
  or exists (
    select 1
    from public.player_teams pt
    join public.player_parents pp on pp.player_id = pt.player_id
    where pt.team_id = messages.team_id and pp.parent_id = auth.uid()
  )
);

create policy "messages insert by access" on public.messages
for insert with check (
  auth.uid() = sender_id and (
    public.is_admin()
    or public.is_coach_for_team(team_id)
    or exists (
      select 1
      from public.player_teams pt
      join public.player_parents pp on pp.player_id = pt.player_id
      where pt.team_id = messages.team_id and pp.parent_id = auth.uid()
    )
  )
);

create policy "audit logs admin only" on public.audit_logs
for all using (public.is_admin()) with check (public.is_admin());