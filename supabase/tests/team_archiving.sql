-- Run after 20260915073921_team_archiving. Synthetic data is rolled back.
begin;
insert into auth.users(id, aud, role, email) values
  ('ac202609-1510-4000-8000-000000000001','authenticated','authenticated','crm-archive-admin@example.invalid');
insert into public.profiles(id,name,email,roles) values
  ('ac202609-1510-4000-8000-000000000001','CRM ARCHIVE Admin','crm-archive-admin@example.invalid',array['admin']);
insert into public.teams(id,name,age_group) values
  ('ac202609-1510-4000-8000-000000000002','CRM ARCHIVE Team','U12');
insert into public.groups(id,name) values
  ('ac202609-1510-4000-8000-000000000003','CRM ARCHIVE Group');
insert into public.group_teams(group_id,team_id) values
  ('ac202609-1510-4000-8000-000000000003','ac202609-1510-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','ac202609-1510-4000-8000-000000000001',true);
do $$
begin
  assert exists(select 1 from public.teams_in_group('ac202609-1510-4000-8000-000000000003')), 'active team missing from group';
  update public.teams set archived_at=now() where id='ac202609-1510-4000-8000-000000000002';
  assert not exists(select 1 from public.teams_in_group('ac202609-1510-4000-8000-000000000003')), 'archived team remained in group targeting';
  update public.teams set archived_at=null where id='ac202609-1510-4000-8000-000000000002';
  assert exists(select 1 from public.teams_in_group('ac202609-1510-4000-8000-000000000003')), 'restored team did not return';
end;
$$;
reset role;
rollback;
