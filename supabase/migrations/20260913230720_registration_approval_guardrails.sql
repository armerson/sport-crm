-- Registration/approval improvements. This does NOT repair the separately
-- discovered disabled RLS policies; see SECURITY_RELEASE_BLOCKERS.md.
-- Apply with the corresponding frontend release after access-policy repair.

create or replace function public.admin_approve_pending_player(p_player_id uuid, p_team_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_senior boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only club administrators can approve registrations.' using errcode = '42501';
  end if;
  select status into v_status from public.players where id = p_player_id for update;
  if not found then raise exception 'Player not found.'; end if;
  if v_status <> 'pending' then raise exception 'This registration is not pending approval.'; end if;

  select is_senior into v_senior from public.teams where id = p_team_id for share;
  if not found then raise exception 'Team not found.'; end if;
  if not v_senior and not exists (select 1 from public.player_parents where player_id = p_player_id) then
    raise exception 'Choose a senior team for a self-registered player.';
  end if;

  insert into public.player_teams (player_id, team_id) values (p_player_id, p_team_id)
    on conflict (player_id, team_id) do nothing;
  update public.players set status = 'active' where id = p_player_id;
end;
$$;
revoke all on function public.admin_approve_pending_player(uuid, uuid) from public, anon;
grant execute on function public.admin_approve_pending_player(uuid, uuid) to authenticated, service_role;

-- Existing invite redemption is privileged so it can attach a validated invite
-- to a member. Caller identity and the invite code are checked before promotion.
create or replace function public.use_team_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.team_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to accept this invitation.' using errcode = '42501'; end if;
  select * into v_invite from public.team_invites where code = p_code and active = true for update;
  if not found then raise exception 'Invalid or expired invite.'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'Your member profile is not ready yet.'; end if;
  if v_invite.role not in ('parent', 'coach') then raise exception 'Invalid invite role.'; end if;

  if v_invite.role = 'coach' then
    update public.profiles set roles = array_append(roles, 'coach')
      where id = auth.uid() and not ('coach' = any(roles));
    insert into public.team_coaches (team_id, coach_id) values (v_invite.team_id, auth.uid()) on conflict do nothing;
  end if;
  update public.team_invites set use_count = use_count + 1 where id = v_invite.id;
  return jsonb_build_object('ok', true, 'teamId', v_invite.team_id, 'role', v_invite.role);
end;
$$;
revoke all on function public.use_team_invite(text) from public, anon;
grant execute on function public.use_team_invite(text) to authenticated, service_role;

create or replace function public.use_club_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.club_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to accept this invitation.' using errcode = '42501'; end if;
  select * into v_invite from public.club_invites where code = p_code and active = true for update;
  if not found then raise exception 'Invalid or expired invite.'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'Your member profile is not ready yet.'; end if;
  if v_invite.role not in ('coach', 'admin') then raise exception 'Invalid invite role.'; end if;
  update public.profiles set roles = array_append(roles, v_invite.role)
    where id = auth.uid() and not (v_invite.role = any(roles));
  update public.club_invites set use_count = use_count + 1 where id = v_invite.id;
end;
$$;
revoke all on function public.use_club_invite(text) from public, anon;
grant execute on function public.use_club_invite(text) to authenticated, service_role;

-- A valid invite must originate from an authorised staff member. Otherwise a
-- member could create a coach invite and redeem it to promote themselves.
create or replace function public.create_team_invite(p_team_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null or not (
    public.is_admin() or (p_role = 'parent' and public.is_coach_for_team(p_team_id))
  ) then raise exception 'Not authorised to create this invitation.' using errcode = '42501'; end if;
  if p_role not in ('parent', 'coach') then raise exception 'Invalid invite role.'; end if;
  for attempt in 1..10 loop
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    begin
      insert into public.team_invites(code, team_id, role, created_by) values(v_code, p_team_id, p_role, auth.uid());
      return v_code;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception 'Could not generate an invitation. Please retry.';
end;
$$;
revoke all on function public.create_team_invite(uuid, text) from public, anon;
grant execute on function public.create_team_invite(uuid, text) to authenticated, service_role;
