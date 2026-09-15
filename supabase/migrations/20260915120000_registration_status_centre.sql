alter table public.players drop constraint if exists players_status_check;
alter table public.players add constraint players_status_check
  check (status in ('pending', 'needs_info', 'active', 'rejected'));

alter table public.players
  add column if not exists registration_message text,
  add column if not exists registration_updated_at timestamptz,
  add column if not exists registration_updated_by uuid references public.profiles(id) on delete set null;

create index if not exists players_registration_updated_by_idx on public.players(registration_updated_by)
  where registration_updated_by is not null;

create or replace function public.protect_player_registration_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and not public.is_admin() and (
    new.status is distinct from old.status
    or new.registration_message is distinct from old.registration_message
    or new.registration_updated_at is distinct from old.registration_updated_at
    or new.registration_updated_by is distinct from old.registration_updated_by
  ) then
    raise exception 'Only club administrators can update registration status.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_player_registration_state on public.players;
create trigger protect_player_registration_state
before update on public.players
for each row execute function public.protect_player_registration_state();

create or replace function public.admin_set_registration_status(
  p_player_id uuid,
  p_status text,
  p_message text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only club administrators can update registrations.' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'needs_info', 'rejected') then
    raise exception 'Invalid registration status.';
  end if;
  if p_status in ('needs_info', 'rejected') and length(trim(coalesce(p_message, ''))) < 3 then
    raise exception 'Add a short message for the applicant.';
  end if;

  update public.players
  set status = p_status,
      registration_message = nullif(left(trim(coalesce(p_message, '')), 1000), ''),
      registration_updated_at = now(),
      registration_updated_by = auth.uid()
  where id = p_player_id and status in ('pending', 'needs_info');
  if not found then raise exception 'This registration is no longer awaiting review.'; end if;
end;
$$;
revoke all on function public.admin_set_registration_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_registration_status(uuid, text, text) to authenticated, service_role;

create or replace function public.admin_approve_pending_player(p_player_id uuid, p_team_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_senior boolean;
  v_team_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only club administrators can approve registrations.' using errcode = '42501';
  end if;
  select status into v_status from public.players where id = p_player_id for update;
  if not found then raise exception 'Player not found.'; end if;
  if v_status not in ('pending', 'needs_info') then raise exception 'This registration is not awaiting approval.'; end if;

  select is_senior, name into v_senior, v_team_name from public.teams where id = p_team_id and archived_at is null for share;
  if not found then raise exception 'Team not found.'; end if;
  if not v_senior and not exists (select 1 from public.player_parents where player_id = p_player_id) then
    raise exception 'Choose a senior team for a self-registered player.';
  end if;

  insert into public.player_teams (player_id, team_id) values (p_player_id, p_team_id)
    on conflict (player_id, team_id) do nothing;
  update public.players
  set status = 'active',
      registration_message = 'Welcome to the club. Your registration has been approved and you have been added to ' || v_team_name || '.',
      registration_updated_at = now(),
      registration_updated_by = auth.uid()
  where id = p_player_id;
end;
$$;
revoke all on function public.admin_approve_pending_player(uuid, uuid) from public, anon;
grant execute on function public.admin_approve_pending_player(uuid, uuid) to authenticated, service_role;
