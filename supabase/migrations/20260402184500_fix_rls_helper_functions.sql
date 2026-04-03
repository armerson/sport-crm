create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- is_admin queries profiles directly instead of calling current_user_role().
-- Chaining through current_user_role() caused infinite recursion because the
-- profiles RLS policy called is_admin(), which called current_user_role(),
-- which queried profiles again, triggering the same RLS check.
-- Both functions are SECURITY DEFINER so they bypass RLS when reading profiles.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.is_coach_for_team(team uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_coaches where team_id = team and coach_id = auth.uid()
  )
$$;

create or replace function public.is_parent_for_player(player uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.player_parents where player_id = player and parent_id = auth.uid()
  )
$$;