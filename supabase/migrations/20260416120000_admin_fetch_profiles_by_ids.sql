create or replace function public.admin_fetch_profiles_by_ids(p_ids uuid[])
returns table (
  id uuid,
  name text,
  email text,
  roles text[],
  linked_player_id uuid
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1 from public.profiles
    where auth.uid() = profiles.id and 'admin' = any(roles)
  ) then
    raise exception 'Not authorised';
  end if;

  return query
  select p.id, p.name, p.email, p.roles, p.linked_player_id
  from public.profiles p
  where p.id = any(coalesce(p_ids, '{}'::uuid[]));
end;
$fn$;

grant execute on function public.admin_fetch_profiles_by_ids(uuid[]) to authenticated;
