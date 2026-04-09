-- Coach↔team admin RPCs: authorise with roles[] on the caller's profile.
-- Matches admin_fetch_profiles_by_ids / admin_set_profile_roles_and_coach_teams pattern
-- so writes work even if public.is_admin() is stale or inconsistent.

create or replace function public.sync_coach_teams(p_coach_id uuid, p_team_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1 from public.profiles
    where auth.uid() = id and 'admin' = any(roles)
  ) then
    raise exception 'Not authorised';
  end if;

  delete from public.team_coaches
  where coach_id = p_coach_id
    and not (team_id = any(coalesce(p_team_ids, '{}'::uuid[])));

  insert into public.team_coaches (team_id, coach_id)
  select unnest(coalesce(p_team_ids, '{}'::uuid[])), p_coach_id
  on conflict do nothing;
end;
$fn$;

create or replace function public.admin_assign_coach_to_team(p_team_id uuid, p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1 from public.profiles
    where auth.uid() = id and 'admin' = any(roles)
  ) then
    raise exception 'Not authorised';
  end if;

  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Team not found';
  end if;

  if not exists (select 1 from public.profiles where id = p_coach_id) then
    raise exception 'Profile not found';
  end if;

  update public.profiles
  set roles = case
    when 'coach' = any(roles) then roles
    else array_append(roles, 'coach')
  end
  where id = p_coach_id;

  insert into public.team_coaches (team_id, coach_id)
  values (p_team_id, p_coach_id)
  on conflict do nothing;
end;
$fn$;
