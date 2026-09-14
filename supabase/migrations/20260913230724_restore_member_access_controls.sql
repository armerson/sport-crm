-- Restore access boundaries. Apply after registration_approval_guardrails.
-- Private lookup helpers deliberately avoid recursive membership policies.
create schema if not exists crm_private;
revoke all on schema crm_private from public, anon;
grant usage on schema crm_private to authenticated, service_role;
revoke create on schema public from public, anon, authenticated;

create function crm_private.can_access_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
 select auth.uid() is not null and (
  public.is_admin() or public.is_coach_for_team(p_team) or exists (
   select 1 from public.player_teams pt where pt.team_id=p_team
   and (public.is_parent_for_player(pt.player_id) or public.is_linked_player(pt.player_id))
  )
 );
$$;
create function crm_private.can_access_player(p_player uuid)
returns boolean language sql stable security definer set search_path = public
as $$
 select auth.uid() is not null and (
  public.is_admin() or public.is_parent_for_player(p_player) or public.is_linked_player(p_player)
  or exists(select 1 from public.player_teams pt where pt.player_id=p_player and public.is_coach_for_team(pt.team_id))
 );
$$;
create function crm_private.can_access_group(p_group uuid)
returns boolean language sql stable security definer set search_path = public
as $$
 select auth.uid() is not null and (public.is_admin() or exists(
  select 1 from public.teams_in_group(p_group) t where crm_private.can_access_team(t.team_id)
 ));
$$;
create function crm_private.can_read_message(p_team uuid,p_group uuid)
returns boolean language sql stable security definer set search_path = public
as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid()) and (
  public.is_admin() or (p_team is null and p_group is null)
  or (p_team is not null and p_group is null and crm_private.can_access_team(p_team))
  or (p_team is null and p_group is not null and crm_private.can_access_group(p_group))
 );
$$;
create function crm_private.can_read_profile(p_profile uuid)
returns boolean language sql stable security definer set search_path = public
as $$
 select auth.uid() is not null and (
  p_profile=auth.uid() or public.is_admin()
  -- Coaches need contact details for families in their own squads.
  or exists(select 1 from public.player_parents pp join public.player_teams pt using(player_id)
    where pp.parent_id=p_profile and public.is_coach_for_team(pt.team_id))
  or exists(select 1 from public.profiles p join public.player_teams pt on pt.player_id=p.linked_player_id
    where p.id=p_profile and public.is_coach_for_team(pt.team_id))
  or exists(select 1 from public.team_coaches tc where tc.coach_id=p_profile and crm_private.can_access_team(tc.team_id))
  or exists(select 1 from public.messages m where m.sender_id=p_profile and crm_private.can_read_message(m.team_id,m.group_id))
 );
$$;

-- Invoker triggers distinguish direct API writes from audited definer functions.
-- No caller-controlled session variable is used to bypass these checks.
create function crm_private.protect_member_columns()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
 if current_user in ('anon','authenticated') and not public.is_admin() then
  if tg_table_name='profiles' then
   if tg_op='INSERT' then
    if new.id is distinct from auth.uid() or new.linked_player_id is not null
      or new.roles is null or not (new.roles = array['parent']::text[] or new.roles = array['player']::text[]) then
     raise exception 'Only parent or player accounts may be created directly.' using errcode='42501';
    end if;
   elsif new.id is distinct from old.id or new.roles is distinct from old.roles
      or new.linked_player_id is distinct from old.linked_player_id or new.created_at is distinct from old.created_at then
    raise exception 'Account permissions require an authorised staff action.' using errcode='42501';
   end if;
  elsif tg_table_name='players' then
   if new.id is distinct from old.id or new.status is distinct from old.status
     or new.registration_code is distinct from old.registration_code or new.created_at is distinct from old.created_at then
    raise exception 'Player approval and identity require an administrator.' using errcode='42501';
   end if;
  elsif tg_table_name='attendance' then
   if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
    raise exception 'Only the attendance response may be changed.' using errcode='42501';
   end if;
  end if;
 end if;
 return new;
end;
$$;
create trigger protect_profile_permissions before insert or update on public.profiles
 for each row execute function crm_private.protect_member_columns();
create trigger protect_player_approval before update on public.players
 for each row execute function crm_private.protect_member_columns();
create trigger protect_attendance_identity before update on public.attendance
 for each row execute function crm_private.protect_member_columns();
revoke all on all functions in schema crm_private from public, anon;
grant execute on all functions in schema crm_private to authenticated, service_role;

-- Replace the incomplete core policies as a single migration.
do $$
declare p record; t text;
begin
 for p in select tablename,policyname from pg_policies where schemaname='public'
  and tablename=any(array['profiles','players','player_parents','player_teams','team_coaches','teams','events','attendance','messages','audit_logs'])
 loop execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
 foreach t in array array['profiles','players','player_parents','player_teams','team_coaches','teams','events','attendance','messages','audit_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end;
$$;
create policy profiles_read on public.profiles for select to authenticated using(crm_private.can_read_profile(id));
create policy profiles_insert on public.profiles for insert to authenticated
 with check(public.is_admin() or (id=auth.uid() and linked_player_id is null and roles in (array['parent']::text[],array['player']::text[])));
create policy profiles_update on public.profiles for update to authenticated
 using(public.is_admin() or id=auth.uid()) with check(public.is_admin() or id=auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated using(public.is_admin());

create policy players_read on public.players for select to authenticated using(crm_private.can_access_player(id));
create policy players_admin on public.players for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy players_family_update on public.players for update to authenticated
 using(public.is_parent_for_player(id) or public.is_linked_player(id))
 with check(public.is_parent_for_player(id) or public.is_linked_player(id));

create policy parents_read on public.player_parents for select to authenticated
 using(parent_id=auth.uid() or crm_private.can_access_player(player_id));
create policy parents_admin on public.player_parents for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy memberships_read on public.player_teams for select to authenticated
 using(public.is_admin() or public.is_coach_for_team(team_id) or public.is_parent_for_player(player_id) or public.is_linked_player(player_id));
create policy memberships_admin on public.player_teams for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy coaches_read on public.team_coaches for select to authenticated using(coach_id=auth.uid() or crm_private.can_access_team(team_id));
create policy coaches_admin on public.team_coaches for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy teams_read on public.teams for select to authenticated using(crm_private.can_access_team(id));
create policy teams_admin on public.teams for all to authenticated using(public.is_admin()) with check(public.is_admin());

create policy events_read on public.events for select to authenticated using(crm_private.can_access_team(team_id));
create policy events_manage on public.events for all to authenticated
 using(public.is_admin() or public.is_coach_for_team(team_id)) with check(public.is_admin() or public.is_coach_for_team(team_id));
create policy attendance_read on public.attendance for select to authenticated
 using(public.is_admin() or public.is_parent_for_player(player_id) or public.is_linked_player(player_id)
  or exists(select 1 from public.events e where e.id=event_id and public.is_coach_for_team(e.team_id)));
create policy attendance_insert on public.attendance for insert to authenticated
 with check(public.is_admin() or exists(select 1 from public.events e join public.player_teams pt on pt.team_id=e.team_id
   where e.id=event_id and pt.player_id=attendance.player_id and public.is_coach_for_team(e.team_id)));
create policy attendance_update on public.attendance for update to authenticated
 using(public.is_admin() or public.is_parent_for_player(player_id) or public.is_linked_player(player_id)
  or exists(select 1 from public.events e where e.id=event_id and public.is_coach_for_team(e.team_id)))
 with check(public.is_admin() or public.is_parent_for_player(player_id) or public.is_linked_player(player_id)
  or exists(select 1 from public.events e where e.id=event_id and public.is_coach_for_team(e.team_id)));
create policy attendance_delete on public.attendance for delete to authenticated
 using(public.is_admin() or exists(select 1 from public.events e where e.id=event_id and public.is_coach_for_team(e.team_id)));

create policy messages_read on public.messages for select to authenticated using(crm_private.can_read_message(team_id,group_id));
create policy messages_insert on public.messages for insert to authenticated
 with check(sender_id=auth.uid() and ((public.is_admin() and (team_id is null or group_id is null))
  or (team_id is not null and group_id is null and crm_private.can_access_team(team_id))));
create policy messages_admin_delete on public.messages for delete to authenticated using(public.is_admin());
create policy audit_read on public.audit_logs for select to authenticated using(public.is_admin());
create policy audit_insert on public.audit_logs for insert to authenticated
 with check(public.is_admin() and actor_id=auth.uid());

-- Invite codes confer privileges: list access is never public.
drop policy if exists public_read_club_invites on public.club_invites;
drop policy if exists "coaches create own team invites" on public.team_invites;
drop policy if exists "coaches read own team invites" on public.team_invites;
create policy coaches_read_parent_invites on public.team_invites for select to authenticated
 using(role='parent' and public.is_coach_for_team(team_id));
revoke all on public.club_invites, public.team_invites from anon;

-- All existing privileged APIs are now restricted to signed-in callers, except
-- the two intentional lookups which disclose limited information for a known code.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
 loop
  execute format('alter function %s set search_path = public',f.signature);
  execute format('revoke all on function %s from public, anon',f.signature);
  execute format('grant execute on function %s to authenticated, service_role',f.signature);
  if f.proname in ('get_invite_info','get_club_invite_info') then
   execute format('grant execute on function %s to anon',f.signature);
  end if;
 end loop;
end;
$$;
-- Aggregate statistics should obey the same attendance policies as ordinary reads.
alter function public.club_attendance_rate(integer) security invoker;

create or replace function public.link_parent_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_player_id uuid;
begin
 if auth.uid() is null or not (public.has_role('parent') or public.is_admin()) then
  raise exception 'Only parent accounts may link a player.' using errcode='42501';
 end if;
 select id into v_player_id from public.players where registration_code=upper(trim(p_code));
 if v_player_id is null then raise exception 'Invalid registration code.'; end if;
 insert into public.player_parents(player_id,parent_id) values(v_player_id,auth.uid()) on conflict do nothing;
 return v_player_id;
end;
$$;

-- Public form rendering must not evaluate member-only profile lookups.
alter policy "admins manage club settings" on public.club_settings to authenticated;
alter policy "admins manage forms" on public.registration_forms to authenticated;
alter policy "admins manage form fields" on public.form_fields to authenticated;
alter policy "admins manage club player fields" on public.club_player_fields to authenticated;
alter policy "public read active forms" on public.registration_forms using(active=true);
alter policy "public read fields for active form" on public.form_fields
 using(exists(select 1 from public.registration_forms f where f.id=form_id and f.active=true));
alter policy "public read active club player fields" on public.club_player_fields using(active=true);
alter function public.touch_player_review() set search_path = public;
alter function public.set_player_registration_code() set search_path = public;

-- Previously public club invite tokens cannot safely retain staff-granting power.
-- Administrators can generate replacements after release; existing members remain.
update public.club_invites set active=false where active=true;
