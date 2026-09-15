-- Run after 20260915090000_multi_role_player_self_registration inside a transaction.
-- All records are synthetic and this script must end with ROLLBACK.
begin;

insert into auth.users(id, aud, role, email) values
  ('ef202609-1509-4000-8000-000000000001', 'authenticated', 'authenticated', 'crm-multi-role@example.invalid'),
  ('ef202609-1509-4000-8000-000000000002', 'authenticated', 'authenticated', 'crm-underage-role@example.invalid');

insert into public.profiles(id, name, email, roles) values
  ('ef202609-1509-4000-8000-000000000001', 'CRM MULTI ROLE Adult', 'crm-multi-role@example.invalid', array['admin','coach','parent']),
  ('ef202609-1509-4000-8000-000000000002', 'CRM MULTI ROLE Child', 'crm-underage-role@example.invalid', array['parent']);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ef202609-1509-4000-8000-000000000001', true);

do $$
declare first_id uuid; second_id uuid;
begin
  first_id := public.register_current_member_as_player('1990-01-01');
  second_id := public.register_current_member_as_player('1990-01-01');
  assert first_id = second_id, 'retry created a different player';
  assert (select roles @> array['admin','coach','parent','player'] from public.profiles where id=auth.uid()), 'existing roles were not preserved';
  assert (select linked_player_id = first_id from public.profiles where id=auth.uid()), 'player was not linked to the account';
  assert (select status = 'pending' from public.players where id=first_id), 'new player was not pending approval';
  assert (select count(*) = 1 from public.players where name='CRM MULTI ROLE Adult'), 'retry duplicated the player';
  assert exists(select 1 from public.audit_logs where actor_id=auth.uid() and action='self_register_player'), 'registration was not audited';
end;
$$;

select set_config('request.jwt.claim.sub', 'ef202609-1509-4000-8000-000000000002', true);
do $$
begin
  begin
    perform public.register_current_member_as_player((current_date - interval '10 years')::date);
    raise exception 'FAILED: under-18 member added a player workspace';
  exception when raise_exception then
    if sqlerrm like 'FAILED:%' then raise; end if;
  end;
  assert (select roles = array['parent'] from public.profiles where id=auth.uid()), 'failed registration changed member roles';
  assert (select linked_player_id is null from public.profiles where id=auth.uid()), 'failed registration linked a player';
end;
$$;

reset role;
rollback;
