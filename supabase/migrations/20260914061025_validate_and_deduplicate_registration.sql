-- Validate registration at the data boundary, including direct API callers.
create function crm_private.validate_registration_child(child jsonb)
returns void language plpgsql security invoker set search_path=public
as $$
declare birthday date;
begin
 if jsonb_typeof(child) is distinct from 'object' or length(trim(coalesce(child->>'name',''))) not between 1 and 120 then
  raise exception 'Enter a player name (up to 120 characters).';
 end if;
 begin birthday := nullif(child->>'dob','')::date;
 exception when others then raise exception 'Enter a valid date of birth.'; end;
 if birthday is null or birthday > current_date or birthday < current_date - interval '120 years' then
  raise exception 'Enter a valid date of birth.';
 end if;
end;
$$;
revoke all on function crm_private.validate_registration_child(jsonb) from public,anon;
grant execute on function crm_private.validate_registration_child(jsonb) to authenticated,service_role;

create or replace function public.register_signup_children(children jsonb)
returns void language plpgsql security definer set search_path=public
as $$
declare child jsonb; new_id uuid;
begin
 if auth.uid() is null or not (public.has_role('parent') or public.is_admin()) then
  raise exception 'Only parent accounts may register children.' using errcode='42501';
 end if;
 -- A single initial signup can be resumed by multiple tabs. Serialize on the
 -- account and return the already-completed result instead of duplicating it.
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.player_parents where parent_id=auth.uid()) then return; end if;
 if jsonb_typeof(children) is distinct from 'array' then raise exception 'Add at least one child.'; end if;
 if jsonb_array_length(children) not between 1 and 20 then raise exception 'Register between 1 and 20 children at a time.'; end if;
 for child in select * from jsonb_array_elements(children) loop
  perform crm_private.validate_registration_child(child);
  insert into public.players(name,dob,status) values(trim(child->>'name'),(child->>'dob')::date,'pending') returning id into new_id;
  insert into public.player_parents(player_id,parent_id) values(new_id,auth.uid());
 end loop;
end;
$$;

create or replace function public.register_self_as_player(p_name text,p_dob date)
returns void language plpgsql security definer set search_path=public
as $$
declare linked uuid; new_id uuid;
begin
 if auth.uid() is null or not public.has_role('player') then
  raise exception 'Only player accounts may register themselves.' using errcode='42501';
 end if;
 select linked_player_id into linked from public.profiles where id=auth.uid() for update;
 if linked is not null then return; end if;
 perform crm_private.validate_registration_child(jsonb_build_object('name',p_name,'dob',p_dob));
 if p_dob > (current_date - interval '18 years')::date then
  raise exception 'Players under 18 must be registered by a parent or guardian.';
 end if;
 insert into public.players(name,dob,status) values(trim(p_name),p_dob,'pending') returning id into new_id;
 update public.profiles set linked_player_id=new_id where id=auth.uid();
end;
$$;

create or replace function public.register_signup_children_with_field_values(p_children jsonb)
returns uuid[] language plpgsql security definer set search_path=public
as $$
declare child jsonb; new_id uuid; ids uuid[] := '{}'; field_key text; field_value text; field_id uuid; required_field record;
begin
 if auth.uid() is null or not (public.has_role('parent') or public.is_admin()) then
  raise exception 'Only parent accounts may register children.' using errcode='42501';
 end if;
 if jsonb_typeof(p_children) is distinct from 'array' then raise exception 'Add at least one child.'; end if;
 if jsonb_array_length(p_children) not between 1 and 20 then raise exception 'Register between 1 and 20 children at a time.'; end if;
 for child in select * from jsonb_array_elements(p_children) loop
  perform crm_private.validate_registration_child(child);
  if child ? 'custom' and jsonb_typeof(child->'custom') is distinct from 'object' then
   raise exception 'Registration answers must be an object.';
  end if;
  for required_field in select id,label from public.club_player_fields where active and required loop
   if nullif(trim(child->'custom'->>required_field.id::text),'') is null then
    raise exception 'Please answer: %',required_field.label;
   end if;
  end loop;
  insert into public.players(name,dob,status) values(trim(child->>'name'),(child->>'dob')::date,'pending') returning id into new_id;
  insert into public.player_parents(player_id,parent_id) values(new_id,auth.uid());
  ids:=array_append(ids,new_id);
  for field_key,field_value in select * from jsonb_each_text(coalesce(child->'custom','{}'::jsonb)) loop
   begin field_id:=field_key::uuid;
   exception when invalid_text_representation then raise exception 'Registration questions changed. Refresh and try again.'; end;
   if not exists(select 1 from public.club_player_fields where id=field_id and active) then
    raise exception 'Registration questions changed. Refresh and try again.';
   end if;
   insert into public.player_field_values(player_id,field_id,value) values(new_id,field_id,field_value);
  end loop;
 end loop;
 return ids;
end;
$$;
