-- Run after 20260915120000_registration_status_centre. Synthetic data is rolled back.
begin;
insert into auth.users(id,aud,role,email) values
  ('ac202609-1512-4000-8000-000000000001','authenticated','authenticated','crm-status-admin@example.invalid'),
  ('ac202609-1512-4000-8000-000000000002','authenticated','authenticated','crm-status-parent@example.invalid');
insert into public.profiles(id,name,email,roles) values
  ('ac202609-1512-4000-8000-000000000001','CRM Status Admin','crm-status-admin@example.invalid',array['admin']),
  ('ac202609-1512-4000-8000-000000000002','CRM Status Parent','crm-status-parent@example.invalid',array['parent']);
insert into public.players(id,name,dob,status) values
  ('ac202609-1512-4000-8000-000000000003','CRM Status Player','2012-01-01','pending');
insert into public.player_parents(player_id,parent_id) values
  ('ac202609-1512-4000-8000-000000000003','ac202609-1512-4000-8000-000000000002');
insert into public.teams(id,name,age_group) values
  ('ac202609-1512-4000-8000-000000000004','CRM Status Team','U15');

set local role authenticated;
select set_config('request.jwt.claim.sub','ac202609-1512-4000-8000-000000000002',true);
do $$
begin
  begin
    update public.players set status='active' where id='ac202609-1512-4000-8000-000000000003';
    raise exception 'parent changed registration state';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','ac202609-1512-4000-8000-000000000001',true);
select public.admin_set_registration_status(
  'ac202609-1512-4000-8000-000000000003',
  'needs_info',
  'Please add the missing registration detail.'
);
do $$
begin
  assert exists(select 1 from public.players where id='ac202609-1512-4000-8000-000000000003' and status='needs_info' and registration_message like 'Please add%'), 'information request was not saved';
end;
$$;
select public.admin_approve_pending_player('ac202609-1512-4000-8000-000000000003','ac202609-1512-4000-8000-000000000004');
do $$
begin
  assert exists(select 1 from public.players where id='ac202609-1512-4000-8000-000000000003' and status='active' and registration_message like 'Welcome%'), 'registration was not approved';
  assert exists(select 1 from public.player_teams where player_id='ac202609-1512-4000-8000-000000000003' and team_id='ac202609-1512-4000-8000-000000000004'), 'approved player was not assigned';
end;
$$;
reset role;
rollback;
