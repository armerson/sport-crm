-- Fix is_admin() on databases that never migrated off the dropped `role` column.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and 'admin' = any(roles)
  );
$$;

-- Single transaction: update roles + sync team_coaches (avoids partial writes / RLS races).
create or replace function public.admin_set_profile_roles_and_coach_teams(
  p_profile_id uuid,
  p_roles text[],
  p_coach_team_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and 'admin' = any(roles)
  ) then
    raise exception 'Not authorised';
  end if;

  if p_roles is null or array_length(p_roles, 1) is null then
    raise exception 'roles must be non-empty';
  end if;

  update public.profiles
  set roles = p_roles
  where id = p_profile_id;

  if not ('coach' = any(p_roles)) then
    delete from public.team_coaches where coach_id = p_profile_id;
    return;
  end if;

  delete from public.team_coaches
  where coach_id = p_profile_id
    and not (team_id = any(coalesce(p_coach_team_ids, '{}'::uuid[])));

  insert into public.team_coaches (team_id, coach_id)
  select unnest(coalesce(p_coach_team_ids, '{}'::uuid[])), p_profile_id
  on conflict do nothing;
end;
$$;

grant execute on function public.admin_set_profile_roles_and_coach_teams(uuid, text[], uuid[]) to authenticated;
