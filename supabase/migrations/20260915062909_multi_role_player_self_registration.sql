-- Let an existing club member add a player workspace without creating a
-- second login. The player record remains pending until an admin assigns it.
create or replace function public.register_current_member_as_player(p_dob date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member_name text;
  linked uuid;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in before registering as a player.' using errcode = '42501';
  end if;

  select name, linked_player_id
    into member_name, linked
    from public.profiles
   where id = auth.uid()
   for update;

  if member_name is null then
    raise exception 'Your club profile could not be found.';
  end if;

  if linked is not null then
    update public.profiles
       set roles = case when 'player' = any(roles) then roles else array_append(roles, 'player') end
     where id = auth.uid();
    return linked;
  end if;

  perform crm_private.validate_registration_child(jsonb_build_object('name', member_name, 'dob', p_dob));
  if p_dob > (current_date - interval '18 years')::date then
    raise exception 'Players under 18 must be registered by a parent or guardian.';
  end if;

  insert into public.players(name, dob, status)
  values(trim(member_name), p_dob, 'pending')
  returning id into new_id;

  update public.profiles
     set linked_player_id = new_id,
         roles = case when 'player' = any(roles) then roles else array_append(roles, 'player') end
   where id = auth.uid();

  insert into public.audit_logs(actor_id, actor_name, action, target_type, target_id, summary)
  values(auth.uid(), member_name, 'self_register_player', 'player', new_id::text,
         'Added a player workspace; registration is pending team assignment.');

  return new_id;
end;
$$;

revoke all on function public.register_current_member_as_player(date) from public, anon;
grant execute on function public.register_current_member_as_player(date) to authenticated;
