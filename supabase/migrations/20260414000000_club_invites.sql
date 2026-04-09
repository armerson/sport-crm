-- Club-level invite links (not tied to a specific team)
-- Used to onboard new coaches and admins directly
create table if not exists public.club_invites (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null default substring(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  role        text not null check (role in ('coach', 'admin')),
  created_by  uuid references auth.users(id),
  active      boolean not null default true,
  use_count   int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.club_invites enable row level security;

-- Only admins can create/manage club invites
create policy "admins_manage_club_invites" on public.club_invites
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and 'admin' = any(roles)
    )
  );

-- Anyone can read (needed for the public join page)
create policy "public_read_club_invites" on public.club_invites
  for select using (true);

-- RPC: create a club-level invite (admin only)
create or replace function public.create_club_invite(p_role text)
returns text
language plpgsql security definer
as $$
declare
  v_code text;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and 'admin' = any(roles)
  ) then
    raise exception 'Not authorised';
  end if;

  insert into public.club_invites (role, created_by)
  values (p_role, auth.uid())
  returning code into v_code;

  return v_code;
end;
$$;

-- RPC: get info about a club invite (public, used by join page)
create or replace function public.get_club_invite_info(p_code text)
returns jsonb
language plpgsql security definer
as $$
declare
  v_row public.club_invites;
begin
  select * into v_row from public.club_invites where code = p_code and active = true;
  if not found then
    return jsonb_build_object('error', 'Invite link is invalid or has been deactivated.');
  end if;
  return jsonb_build_object('role', v_row.role, 'code', p_code);
end;
$$;

-- RPC: use a club invite after authentication
create or replace function public.use_club_invite(p_code text)
returns void
language plpgsql security definer
as $$
declare
  v_row public.club_invites;
  v_roles text[];
begin
  select * into v_row from public.club_invites where code = p_code and active = true;
  if not found then return; end if;

  -- Add the role to the user's profile if not already present
  select roles into v_roles from public.profiles where id = auth.uid();
  if not (v_row.role = any(v_roles)) then
    update public.profiles
    set roles = array_append(roles, v_row.role)
    where id = auth.uid();
  end if;

  -- Track usage
  update public.club_invites set use_count = use_count + 1 where id = v_row.id;
end;
$$;
