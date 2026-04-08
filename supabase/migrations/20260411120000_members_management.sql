-- ── Members management RPCs ─────────────────────────────────────

-- sync_coach_teams: replaces a coach's team assignments atomically.
create or replace function public.sync_coach_teams(p_coach_id uuid, p_team_ids uuid[])
returns void language plpgsql security definer as $$
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;

  -- Remove entries not in the new list
  delete from public.team_coaches
  where coach_id = p_coach_id
    and not (team_id = any(p_team_ids));

  -- Add entries that don't exist yet
  insert into public.team_coaches (team_id, coach_id)
  select unnest(p_team_ids), p_coach_id
  on conflict do nothing;
end;
$$;
grant execute on function public.sync_coach_teams(uuid, uuid[]) to authenticated;

-- merge_players: moves all references from secondary → primary then deletes secondary.
-- Handles unique-constraint conflicts by preferring the primary record.
create or replace function public.merge_players(p_primary_id uuid, p_secondary_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  if p_primary_id = p_secondary_id then raise exception 'Cannot merge a player with themselves'; end if;

  -- Team memberships: reassign where primary doesn't already belong, then drop rest
  update public.player_teams
  set player_id = p_primary_id
  where player_id = p_secondary_id
    and not exists (
      select 1 from public.player_teams pt2
      where pt2.player_id = p_primary_id and pt2.team_id = player_teams.team_id
    );
  delete from public.player_teams where player_id = p_secondary_id;

  -- Parent links
  update public.player_parents
  set player_id = p_primary_id
  where player_id = p_secondary_id
    and not exists (
      select 1 from public.player_parents pp2
      where pp2.player_id = p_primary_id and pp2.parent_id = player_parents.parent_id
    );
  delete from public.player_parents where player_id = p_secondary_id;

  -- Attendance (no uniqueness issue)
  update public.attendance set player_id = p_primary_id where player_id = p_secondary_id;

  -- Reviews: unique on (player_id, team_id, period_label) — prefer primary
  update public.player_reviews
  set player_id = p_primary_id
  where player_id = p_secondary_id
    and not exists (
      select 1 from public.player_reviews pr2
      where pr2.player_id = p_primary_id
        and pr2.team_id = player_reviews.team_id
        and pr2.period_label = player_reviews.period_label
    );
  delete from public.player_reviews where player_id = p_secondary_id;

  -- Profile linked_player_id
  update public.profiles set linked_player_id = p_primary_id where linked_player_id = p_secondary_id;

  -- Delete secondary
  delete from public.players where id = p_secondary_id;
end;
$$;
grant execute on function public.merge_players(uuid, uuid) to authenticated;
