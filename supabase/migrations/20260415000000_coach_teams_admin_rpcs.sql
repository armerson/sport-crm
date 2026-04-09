-- Reliable coach↔team writes for admins (bypasses RLS edge cases on direct table access).

-- Full replace of a coach's team list (empty array = remove from all teams).
create or replace function public.sync_coach_teams(p_coach_id uuid, p_team_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  delete from public.team_coaches
  where coach_id = p_coach_id
    and not (team_id = any(coalesce(p_team_ids, '{}'::uuid[])));

  insert into public.team_coaches (team_id, coach_id)
  select unnest(coalesce(p_team_ids, '{}'::uuid[])), p_coach_id
  on conflict do nothing;
end;
$$;

grant execute on function public.sync_coach_teams(uuid, uuid[]) to authenticated;

-- Single team assignment from Manage tab (adds coach role if missing).
create or replace function public.admin_assign_coach_to_team(p_team_id uuid, p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Team not found';
  end if;

  if not exists (select 1 from public.profiles where id = p_coach_id) then
    raise exception 'Profile not found';
  end if;

  update public.profiles
  set roles = array_append(roles, 'coach')
  where id = p_coach_id
    and not ('coach' = any(roles));

  insert into public.team_coaches (team_id, coach_id)
  values (p_team_id, p_coach_id)
  on conflict do nothing;
end;
$$;

grant execute on function public.admin_assign_coach_to_team(uuid, uuid) to authenticated;
