-- Allow club admins (multi-hat accounts) to register their own children from the app,
-- not only profiles that already include the parent role.
create or replace function public.register_signup_children(children jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  elem jsonb;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and ('parent' = any(roles) or 'admin' = any(roles))
  ) then
    raise exception 'only parent or admin accounts can register children here';
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
$body$;
