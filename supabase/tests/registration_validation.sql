-- Run inside BEGIN / ROLLBACK, after all registration migrations.
insert into auth.users(id,email) values
 ('db202609-1400-4000-8000-000000000001','crm-validation-parent@example.invalid'),
 ('db202609-1400-4000-8000-000000000002','crm-validation-player@example.invalid');
insert into public.profiles(id,name,email,roles) values
 ('db202609-1400-4000-8000-000000000001','CRM VALIDATION Parent','crm-validation-parent@example.invalid',array['parent']),
 ('db202609-1400-4000-8000-000000000002','CRM VALIDATION Player','crm-validation-player@example.invalid',array['player']);
insert into public.club_player_fields(id,label,required,active) values('db202609-1400-4000-8000-000000000003','CRM VALIDATION Required answer',true,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','db202609-1400-4000-8000-000000000001',true);
do $$
declare child jsonb; ids uuid[]; answers jsonb;
begin
 for child in select * from jsonb_array_elements('[{"name":"","dob":"2015-01-01"},{"name":"CRM TEST","dob":"2999-01-01"},{"name":"CRM TEST","dob":"2015-02-31"}]'::jsonb) loop
  begin
   perform public.register_signup_children(jsonb_build_array(child));
   raise exception 'FAILED: invalid child accepted';
  exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 end loop;
 assert not exists(select 1 from public.players), 'invalid registration left children behind';
 begin
  perform public.register_signup_children('[{"name":"CRM TEST valid","dob":"2015-01-01"},{"name":"","dob":"2015-01-01"}]');
  raise exception 'FAILED: incomplete sibling accepted';
 exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 assert not exists(select 1 from public.players), 'partial siblings were saved';
 perform public.register_signup_children('[{"name":"CRM TEST initial","dob":"2015-01-01"}]');
 perform public.register_signup_children('[{"name":"CRM TEST initial","dob":"2015-01-01"}]');
 assert (select count(*)=1 from public.players), 'repeated initial signup duplicated children';
 begin
  perform public.register_signup_children_with_field_values('[{"name":"CRM TEST additional","dob":"2015-01-01","custom":{}}]');
  raise exception 'FAILED: missing required answer accepted';
 exception when raise_exception then if sqlerrm not like 'Please answer:%' then raise; end if; end;
 -- Include all live required fields using synthetic values; only these test answers
 -- exist transiently, and the transaction is rolled back.
 select coalesce(jsonb_object_agg(id::text,'CRM VALIDATION answer'),'{}'::jsonb) into answers from public.club_player_fields where active and required;
 begin
  perform public.register_signup_children_with_field_values(jsonb_build_array(jsonb_build_object('name','CRM TEST additional','dob','2015-01-01','custom',answers||'{"invalid-uuid":"test"}'::jsonb)));
  raise exception 'FAILED: unknown field silently ignored';
 exception when raise_exception then if sqlerrm not like 'Registration questions changed.%' then raise; end if; end;
 assert (select count(*)=1 from public.players), 'failed questions left partial registration';
 ids:=public.register_signup_children_with_field_values(jsonb_build_array(jsonb_build_object('name','CRM TEST additional','dob','2015-01-01','custom',answers)));
 assert array_length(ids,1)=1, 'valid custom registration failed';
 assert exists(select 1 from public.player_field_values where player_id=ids[1] and field_id='db202609-1400-4000-8000-000000000003'), 'required answer was lost';
end;
$$;
select set_config('request.jwt.claim.sub','db202609-1400-4000-8000-000000000002',true);
do $$
begin
 begin
  perform public.register_self_as_player('CRM TEST young',(current_date-interval '10 years')::date);
  raise exception 'FAILED: child self-registered';
 exception when raise_exception then if sqlerrm not like 'Players under 18%' then raise; end if; end;
 perform public.register_self_as_player('CRM TEST adult','1990-01-01');
 perform public.register_self_as_player('CRM TEST adult','1990-01-01');
 assert (select count(*)=1 from public.players), 'adult retry duplicated a player';
end;
$$;
reset role;
select 10 as registration_validation_checks_passed;
