-- Add a unique registration code to every player.
-- Parents enter this code to self-link to their child without admin intervention.

alter table public.players
  add column if not exists registration_code text unique;

-- Back-fill existing players with a random 8-char uppercase code
update public.players
set registration_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where registration_code is null;

-- Make it non-nullable now that all rows are filled
alter table public.players
  alter column registration_code set not null;

-- Trigger: auto-generate code on insert if not supplied
create or replace function public.set_player_registration_code()
returns trigger language plpgsql as $$
begin
  if new.registration_code is null or new.registration_code = '' then
    new.registration_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_player_registration_code on public.players;
create trigger trg_player_registration_code
  before insert on public.players
  for each row execute procedure public.set_player_registration_code();

-- RPC: parent calls this to link themselves to a player by code.
-- Returns the player id on success, raises an exception on bad code or duplicate link.
create or replace function public.link_parent_by_code(p_code text)
returns uuid language plpgsql security definer as $$
declare
  v_player_id uuid;
begin
  -- Find the player
  select id into v_player_id
  from public.players
  where registration_code = upper(trim(p_code));

  if v_player_id is null then
    raise exception 'Invalid registration code.';
  end if;

  -- Prevent duplicate link
  if exists (
    select 1 from public.player_parents
    where player_id = v_player_id and parent_id = auth.uid()
  ) then
    raise exception 'You are already linked to this player.';
  end if;

  -- Insert the link
  insert into public.player_parents (player_id, parent_id)
  values (v_player_id, auth.uid());

  return v_player_id;
end;
$$;

-- Admins can read registration codes (coaches and parents cannot)
create policy "admin can view registration codes" on public.players
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and 'admin' = any(roles)
    )
  );
