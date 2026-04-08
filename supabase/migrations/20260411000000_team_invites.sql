-- Team invite links — coaches/admins generate a shareable code.
-- Parents or coaches click the link to self-onboard to a team.
create table if not exists public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  team_id     uuid not null references public.teams(id) on delete cascade,
  -- Role the invitee will receive when they sign up
  role        text not null check (role in ('parent', 'coach')),
  created_by  uuid references public.profiles(id) on delete set null,
  active      boolean not null default true,
  use_count   int not null default 0,
  created_at  timestamptz not null default timezone('utc', now())
);

alter table public.team_invites enable row level security;

-- Admins can do everything; coaches can read/create invites for their own teams
create policy "admins manage invites"
  on public.team_invites for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "coaches read own team invites"
  on public.team_invites for select
  to authenticated
  using (
    exists (
      select 1 from public.team_coaches
      where team_coaches.team_id = team_invites.team_id
        and team_coaches.coach_id = auth.uid()
    )
  );

create policy "coaches create own team invites"
  on public.team_invites for insert
  to authenticated
  with check (
    exists (
      select 1 from public.team_coaches
      where team_coaches.team_id = team_invites.team_id
        and team_coaches.coach_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- create_team_invite(team_id, role) → invite code
-- ----------------------------------------------------------------
create or replace function public.create_team_invite(
  p_team_id uuid,
  p_role    text
)
returns text language plpgsql security definer as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  -- Generate a unique 8-char alphanumeric code
  loop
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    exit when not exists (select 1 from public.team_invites where code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then raise exception 'Could not generate unique code'; end if;
  end loop;

  insert into public.team_invites (code, team_id, role, created_by)
  values (v_code, p_team_id, p_role, auth.uid());

  return v_code;
end;
$$;

-- ----------------------------------------------------------------
-- get_invite_info(code) → team name, age group, photo, role
-- Public — called before the user is authenticated to show the landing page.
-- ----------------------------------------------------------------
create or replace function public.get_invite_info(p_code text)
returns jsonb language plpgsql security definer as $$
declare
  v_invite record;
  v_team   record;
begin
  select * into v_invite
  from public.team_invites
  where code = p_code and active = true;

  if not found then
    return jsonb_build_object('error', 'This invite link is invalid or has been deactivated.');
  end if;

  select name, age_group, photo_url into v_team
  from public.teams where id = v_invite.team_id;

  return jsonb_build_object(
    'teamId',    v_invite.team_id,
    'teamName',  v_team.name,
    'ageGroup',  v_team.age_group,
    'photoUrl',  v_team.photo_url,
    'role',      v_invite.role,
    'code',      p_code
  );
end;
$$;

-- ----------------------------------------------------------------
-- use_team_invite(code) → called after the user is authenticated.
-- Adds coaches to team_coaches; parents just get the use_count bump.
-- ----------------------------------------------------------------
create or replace function public.use_team_invite(p_code text)
returns jsonb language plpgsql security definer as $$
declare
  v_invite record;
begin
  select * into v_invite
  from public.team_invites
  where code = p_code and active = true
  for update;

  if not found then
    return jsonb_build_object('error', 'Invalid or expired invite');
  end if;

  -- Increment usage
  update public.team_invites set use_count = use_count + 1 where id = v_invite.id;

  -- For coaches: add to team
  if v_invite.role = 'coach' then
    insert into public.team_coaches (team_id, coach_id)
    values (v_invite.team_id, auth.uid())
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'teamId', v_invite.team_id, 'role', v_invite.role);
end;
$$;

-- Allow anyone (even anon) to call get_invite_info so the landing page works
grant execute on function public.get_invite_info(text) to anon, authenticated;
grant execute on function public.create_team_invite(uuid, text) to authenticated;
grant execute on function public.use_team_invite(text) to authenticated;
