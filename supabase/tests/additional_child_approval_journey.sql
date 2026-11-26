-- End-to-end registration regression test.
-- Creates only synthetic records and always rolls the transaction back.

begin;

insert into auth.users (id, aud, role, email)
values
  ('ad202609-1900-4000-8000-000000000001', 'authenticated', 'authenticated', 'additional-child-admin@example.invalid'),
  ('ad202609-1900-4000-8000-000000000002', 'authenticated', 'authenticated', 'additional-child-parent@example.invalid');

insert into public.profiles (id, name, email, roles)
values
  ('ad202609-1900-4000-8000-000000000001', 'ROLLBACK TEST Admin', 'additional-child-admin@example.invalid', array['admin']),
  ('ad202609-1900-4000-8000-000000000002', 'ROLLBACK TEST Parent', 'additional-child-parent@example.invalid', array['parent'])
on conflict (id) do update
set roles = excluded.roles;

insert into public.teams (id, name, age_group, is_senior)
values ('ad202609-1900-4000-8000-000000000003', 'ROLLBACK TEST U12', 'U12', false);

-- Existing child proves this is an additional-child journey, not first signup.
insert into public.players (id, name, dob, status)
values ('ad202609-1900-4000-8000-000000000004', 'ROLLBACK TEST Existing Child', '2015-01-01', 'active');

insert into public.player_parents (player_id, parent_id)
values ('ad202609-1900-4000-8000-000000000004', 'ad202609-1900-4000-8000-000000000002');

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ad202609-1900-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select set_config(
  'qa.additional_child_id',
  public.register_additional_child(
    jsonb_build_object(
      'name', 'ROLLBACK TEST Additional Child',
      'dob', '2016-01-01',
      'custom', (
        select coalesce(jsonb_object_agg(id::text, 'Regression test answer'), '{}'::jsonb)
        from public.club_player_fields
        where active and required
      )
    )
  )::text,
  true
);

do $$
declare
  child_id uuid := current_setting('qa.additional_child_id')::uuid;
begin
  assert (select status = 'pending' from public.players where id = child_id),
    'additional child was not created as pending';
  assert exists (
    select 1 from public.player_parents
    where player_id = child_id
      and parent_id = auth.uid()
  ), 'additional child was not linked to the signed-in parent';
  assert (select count(*) = 2 from public.player_parents where parent_id = auth.uid()),
    'existing family link was lost or additional link was duplicated';
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ad202609-1900-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  child_id uuid := current_setting('qa.additional_child_id')::uuid;
begin
  assert exists (
    select 1 from public.players
    where id = child_id and status = 'pending'
  ), 'admin could not see the pending additional child';

  perform public.admin_approve_pending_player(
    child_id,
    'ad202609-1900-4000-8000-000000000003'
  );

  assert (select status = 'active' from public.players where id = child_id),
    'approval did not activate the additional child';
  assert exists (
    select 1 from public.player_teams
    where player_id = child_id
      and team_id = 'ad202609-1900-4000-8000-000000000003'
  ), 'approval did not assign the selected team';
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ad202609-1900-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  child_id uuid := current_setting('qa.additional_child_id')::uuid;
begin
  assert (select status = 'active' from public.players where id = child_id),
    'parent could not see the approved child';
  assert exists (
    select 1 from public.player_teams
    where player_id = child_id
      and team_id = 'ad202609-1900-4000-8000-000000000003'
  ), 'parent could not see the approved team assignment';
end;
$$;

reset role;
select jsonb_build_object(
  'additional_child_created', true,
  'parent_link_preserved', true,
  'admin_pending_visibility', true,
  'approval_activated_player', true,
  'team_assignment_created', true,
  'parent_sees_approved_child', true,
  'rolled_back', true
) as test_results;

rollback;
