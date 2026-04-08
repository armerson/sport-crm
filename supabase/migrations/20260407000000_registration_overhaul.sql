-- ─────────────────────────────────────────────
-- Registration overhaul: pending players, senior teams, player role
-- ─────────────────────────────────────────────

-- Senior teams (18+ self-registration)
alter table public.teams
  add column if not exists is_senior boolean not null default false;

-- Player lifecycle (junior via parent signup, senior via self-signup)
alter table public.players
  add column if not exists status text not null default 'active'
    check (status in ('pending', 'active'));

update public.players set status = 'active' where status is null;

-- Allow senior self-reg without DOB until they complete profile
alter table public.players alter column dob drop not null;

-- Link auth profile to own player row (senior accounts)
alter table public.profiles
  add column if not exists linked_player_id uuid references public.players(id) on delete set null;

create unique index if not exists profiles_linked_player_id_unique
  on public.profiles (linked_player_id) where linked_player_id is not null;

-- Extend roles to include 'player'
alter table public.profiles drop constraint if exists profiles_roles_valid;

alter table public.profiles
  add constraint profiles_roles_valid check (
    array_length(roles, 1) > 0
    and roles <@ array['admin', 'coach', 'parent', 'player']::text[]
  );

-- Helper: senior player viewing their own player row
create or replace function public.is_linked_player(p_player uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and linked_player_id = p_player
  )
$$;

-- Dashboard / RLS: player between coach and parent
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when 'admin' = any(roles) then 'admin'
    when 'coach' = any(roles) then 'coach'
    when 'player' = any(roles) then 'player'
    else 'parent'
  end
  from public.profiles where id = auth.uid()
$$;

-- ── RLS: players ───────────────────────────────────────────

drop policy if exists "players read by access" on public.players;

create policy "players read by access" on public.players
for select using (
  public.is_admin()
  or public.is_parent_for_player(id)
  or public.is_linked_player(id)
  or exists (
    select 1 from public.player_teams pt
    join public.team_coaches tc on tc.team_id = pt.team_id
    where pt.player_id = players.id and tc.coach_id = auth.uid()
  )
);

-- Profile updates (photos, bio, etc.) — not full admin write
drop policy if exists "parents update own children players" on public.players;
create policy "parents update own children players" on public.players
for update to authenticated
using (public.is_parent_for_player(id))
with check (public.is_parent_for_player(id));

drop policy if exists "linked players update own row" on public.players;
create policy "linked players update own row" on public.players
for update to authenticated
using (public.is_linked_player(id))
with check (public.is_linked_player(id));

-- ── RLS: teams (read for linked players on a team) ─────────

drop policy if exists "teams read by access" on public.teams;

create policy "teams read by access" on public.teams
for select using (
  public.is_admin()
  or public.is_coach_for_team(id)
  or exists (
    select 1 from public.player_teams pt
    join public.player_parents pp on pp.player_id = pt.player_id
    where pt.team_id = teams.id and pp.parent_id = auth.uid()
  )
  or exists (
    select 1 from public.player_teams pt
    join public.profiles pr on pr.linked_player_id = pt.player_id
    where pt.team_id = teams.id and pr.id = auth.uid()
  )
);

-- ── RLS: events ───────────────────────────────────────────

drop policy if exists "events read by access" on public.events;

create policy "events read by access" on public.events
for select using (
  public.is_admin()
  or public.is_coach_for_team(team_id)
  or exists (
    select 1 from public.player_teams pt
    join public.player_parents pp on pp.player_id = pt.player_id
    where pt.team_id = events.team_id and pp.parent_id = auth.uid()
  )
  or exists (
    select 1 from public.player_teams pt
    join public.profiles pr on pr.linked_player_id = pt.player_id
    where pt.team_id = events.team_id and pr.id = auth.uid()
  )
);

-- ── RLS: attendance ───────────────────────────────────────

drop policy if exists "attendance read by access" on public.attendance;

create policy "attendance read by access" on public.attendance
for select using (
  public.is_admin()
  or public.is_parent_for_player(player_id)
  or public.is_linked_player(player_id)
  or exists (
    select 1 from public.events e where e.id = attendance.event_id and public.is_coach_for_team(e.team_id)
  )
);

drop policy if exists "attendance parents update" on public.attendance;

create policy "attendance parents update" on public.attendance
for update using (
  public.is_parent_for_player(player_id)
  or public.is_linked_player(player_id)
  or public.is_admin()
)
with check (
  public.is_parent_for_player(player_id)
  or public.is_linked_player(player_id)
  or public.is_admin()
);

-- ── RLS: player_teams read (linked player) ─────────────────

drop policy if exists "player teams read by access" on public.player_teams;

create policy "player teams read by access" on public.player_teams
for select using (
  public.is_admin()
  or public.is_coach_for_team(team_id)
  or public.is_parent_for_player(player_id)
  or public.is_linked_player(player_id)
);

-- ── RLS: messages (linked player in team) ─────────────────

drop policy if exists "messages read by access" on public.messages;

create policy "messages read by access" on public.messages
for select using (
  public.is_admin()
  or public.is_coach_for_team(team_id)
  or exists (
    select 1 from public.player_teams pt
    join public.player_parents pp on pp.player_id = pt.player_id
    where pt.team_id = messages.team_id and pp.parent_id = auth.uid()
  )
  or exists (
    select 1 from public.player_teams pt
    join public.profiles pr on pr.linked_player_id = pt.player_id
    where pt.team_id = messages.team_id and pr.id = auth.uid()
  )
);

-- ── Secure signup RPCs ─────────────────────────────────────

create or replace function public.register_signup_children(children jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  elem jsonb;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.profiles where id = auth.uid() and 'parent' = any(roles)
  ) then
    raise exception 'only parent accounts can register children';
  end if;

  for elem in select * from jsonb_array_elements(coalesce(children, '[]'::jsonb))
  loop
    insert into public.players (name, dob, status)
    values (
      trim((elem->>'name')::text),
      nullif(trim(elem->>'dob'), '')::date,
      'pending'
    )
    returning id into new_id;

    insert into public.player_parents (player_id, parent_id)
    values (new_id, auth.uid());
  end loop;
end;
$$;

grant execute on function public.register_signup_children(jsonb) to authenticated;

create or replace function public.register_self_as_player(p_name text, p_dob date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.profiles where id = auth.uid() and 'player' = any(roles)
  ) then
    raise exception 'only player accounts can self-register';
  end if;
  if exists (
    select 1 from public.profiles where id = auth.uid() and linked_player_id is not null
  ) then
    raise exception 'player profile already linked';
  end if;

  insert into public.players (name, dob, status)
  values (trim(p_name), p_dob, 'pending')
  returning id into new_id;

  update public.profiles
  set linked_player_id = new_id
  where id = auth.uid();
end;
$$;

grant execute on function public.register_self_as_player(text, date) to authenticated;

-- ── Results: linked player can read ───────────────────────

drop policy if exists "results read by access" on public.results;

create policy "results read by access" on public.results
for select using (
  exists (
    select 1 from public.events e
    where e.id = results.event_id and (
      public.is_admin()
      or public.is_coach_for_team(e.team_id)
      or exists (
        select 1 from public.player_teams pt
        join public.player_parents pp on pp.player_id = pt.player_id
        where pt.team_id = e.team_id and pp.parent_id = auth.uid()
      )
      or exists (
        select 1 from public.player_teams pt
        join public.profiles pr on pr.linked_player_id = pt.player_id
        where pt.team_id = e.team_id and pr.id = auth.uid()
      )
    )
  )
);

-- ── Emergency contacts: linked player read own ───────────

drop policy if exists "linked player read own emergency contacts" on public.emergency_contacts;
create policy "linked player read own emergency contacts" on public.emergency_contacts
for select using (public.is_linked_player(player_id));

-- ── Player documents: linked player read/manage own ───────

drop policy if exists "linked player read own documents" on public.player_documents;
create policy "linked player read own documents" on public.player_documents
for select using (public.is_linked_player(player_id));

drop policy if exists "linked player manage own documents" on public.player_documents;
create policy "linked player manage own documents" on public.player_documents
for all using (public.is_linked_player(player_id))
with check (public.is_linked_player(player_id));
