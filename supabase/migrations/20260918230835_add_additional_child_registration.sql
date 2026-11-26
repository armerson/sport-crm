-- The initial-signup RPC intentionally returns when an account already has
-- children so a repeated signup completion cannot duplicate the whole family.
-- Adding a child later is a different operation and must not use that guard.
create or replace function public.register_additional_child(p_child jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  field_key text;
  field_value text;
  field_id uuid;
  required_field record;
begin
  if auth.uid() is null or not (public.has_role('parent') or public.is_admin()) then
    raise exception 'Only parent accounts may register children.' using errcode = '42501';
  end if;

  perform crm_private.validate_registration_child(p_child);

  if p_child ? 'custom' and jsonb_typeof(p_child -> 'custom') is distinct from 'object' then
    raise exception 'Registration answers must be an object.';
  end if;

  for required_field in
    select id, label from public.club_player_fields where active and required
  loop
    if nullif(trim(p_child -> 'custom' ->> required_field.id::text), '') is null then
      raise exception 'Please answer: %', required_field.label;
    end if;
  end loop;

  insert into public.players (name, dob, status)
  values (trim(p_child ->> 'name'), (p_child ->> 'dob')::date, 'pending')
  returning id into new_id;

  insert into public.player_parents (player_id, parent_id)
  values (new_id, auth.uid());

  for field_key, field_value in
    select * from jsonb_each_text(coalesce(p_child -> 'custom', '{}'::jsonb))
  loop
    begin
      field_id := field_key::uuid;
    exception when invalid_text_representation then
      raise exception 'Registration questions changed. Refresh and try again.';
    end;

    if not exists (
      select 1 from public.club_player_fields where id = field_id and active
    ) then
      raise exception 'Registration questions changed. Refresh and try again.';
    end if;

    insert into public.player_field_values (player_id, field_id, value)
    values (new_id, field_id, field_value);
  end loop;

  return new_id;
end;
$$;

revoke all on function public.register_additional_child(jsonb) from public, anon;
grant execute on function public.register_additional_child(jsonb) to authenticated;
