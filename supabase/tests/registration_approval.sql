-- Run after the guardrails migration inside a transaction, then ROLLBACK.
-- All records are synthetic. Never COMMIT this test transaction.
insert into auth.users(id, aud, role, email) values
 ('cd202609-1318-4000-8000-000000000001', 'authenticated', 'authenticated', 'crm-rollback-admin@example.invalid'),
 ('cd202609-1318-4000-8000-000000000002', 'authenticated', 'authenticated', 'crm-rollback-parent@example.invalid');
insert into public.profiles(id, name, email, roles) values
 ('cd202609-1318-4000-8000-000000000001', 'CRM ROLLBACK TEST Admin', 'crm-rollback-admin@example.invalid', array['admin']),
 ('cd202609-1318-4000-8000-000000000002', 'CRM ROLLBACK TEST Parent', 'crm-rollback-parent@example.invalid', array['parent']);
insert into public.teams(id, name, age_group, is_senior) values
 ('cd202609-1318-4000-8000-000000000003', 'CRM ROLLBACK TEST Junior', 'U12', false),
 ('cd202609-1318-4000-8000-000000000004', 'CRM ROLLBACK TEST Senior', 'Adult', true);
insert into public.players(id, name, dob, status) values
 ('cd202609-1318-4000-8000-000000000005', 'CRM ROLLBACK TEST Child', '2014-01-01', 'pending'),
 ('cd202609-1318-4000-8000-000000000006', 'CRM ROLLBACK TEST Adult', '1990-01-01', 'pending');
insert into public.player_parents(player_id, parent_id) values
 ('cd202609-1318-4000-8000-000000000005', 'cd202609-1318-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cd202609-1318-4000-8000-000000000002', true);
do $$
begin
  begin
    perform public.admin_approve_pending_player('cd202609-1318-4000-8000-000000000005','cd202609-1318-4000-8000-000000000003');
    raise exception 'TEST FAILED: parent approved registration';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', 'cd202609-1318-4000-8000-000000000001', true);
do $$
begin
  begin
    perform public.admin_approve_pending_player('cd202609-1318-4000-8000-000000000005','cd202609-1318-4000-8000-000000000099');
    raise exception 'TEST FAILED: nonexistent team accepted';
  exception when raise_exception then
    if sqlerrm <> 'Team not found.' then raise; end if;
  end;
  assert (select status = 'pending' from public.players where id = 'cd202609-1318-4000-8000-000000000005'), 'failed approval changed status';
  assert not exists(select 1 from public.player_teams where player_id = 'cd202609-1318-4000-8000-000000000005'), 'failed approval added membership';

  perform public.admin_approve_pending_player('cd202609-1318-4000-8000-000000000005','cd202609-1318-4000-8000-000000000003');
  assert (select status = 'active' from public.players where id = 'cd202609-1318-4000-8000-000000000005'), 'approved child not active';
  assert (select count(*) = 1 from public.player_teams where player_id = 'cd202609-1318-4000-8000-000000000005'), 'missing or duplicate membership';
  begin
    perform public.admin_approve_pending_player('cd202609-1318-4000-8000-000000000005','cd202609-1318-4000-8000-000000000003');
    raise exception 'TEST FAILED: duplicate approval accepted';
  exception when raise_exception then
    if sqlerrm <> 'This registration is not pending approval.' then raise; end if;
  end;
  begin
    perform public.admin_approve_pending_player('cd202609-1318-4000-8000-000000000006','cd202609-1318-4000-8000-000000000003');
    raise exception 'TEST FAILED: adult joined junior team';
  exception when raise_exception then
    if sqlerrm <> 'Choose a senior team for a self-registered player.' then raise; end if;
  end;
  perform public.admin_approve_pending_player('cd202609-1318-4000-8000-000000000006','cd202609-1318-4000-8000-000000000004');
  assert (select status = 'active' from public.players where id = 'cd202609-1318-4000-8000-000000000006'), 'adult approval failed';
end;
$$;
reset role;
select jsonb_build_object('parent_approval_denied',true,'invalid_team_unchanged',true,'junior_approval_passed',true,'repeat_approval_denied',true,'adult_junior_assignment_denied',true,'adult_senior_approval_passed',true) as test_results;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cd202609-1318-4000-8000-000000000002', true);
do $$
begin
  begin
    perform public.create_team_invite('cd202609-1318-4000-8000-000000000003','coach');
    raise exception 'TEST FAILED: parent created coach invite';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', 'cd202609-1318-4000-8000-000000000001', true);
do $$
declare code text;
begin
  code := public.create_team_invite('cd202609-1318-4000-8000-000000000003','coach');
  perform set_config('request.jwt.claim.sub', 'cd202609-1318-4000-8000-000000000002', true);
  perform public.use_team_invite(code);
  assert (select 'coach' = any(roles) from public.profiles where id='cd202609-1318-4000-8000-000000000002'), 'valid invite failed to grant coach role';
  assert exists(select 1 from public.team_coaches where coach_id='cd202609-1318-4000-8000-000000000002' and team_id='cd202609-1318-4000-8000-000000000003'), 'valid invite did not assign team';
  assert not has_function_privilege('anon','public.create_team_invite(uuid,text)','EXECUTE'), 'anonymous invite creation allowed';
  assert not has_function_privilege('anon','public.use_team_invite(text)','EXECUTE'), 'anonymous invite redemption allowed';
end;
$$;
reset role;
select jsonb_build_object('approval_cases_passed',6,'unauthorised_invite_creation_denied',true,'valid_coach_invite_passed',true,'anonymous_invite_execution_denied',true) as final_test_results;
