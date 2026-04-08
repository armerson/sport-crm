-- Recurring events support.
-- Adds a recurrence_group_id to events so sessions in the same series share an ID.
-- Null means a one-off event. Idempotent for re-runs.

alter table public.events
  add column if not exists recurrence_group_id uuid;

create index if not exists events_recurrence_group_idx on public.events (recurrence_group_id)
  where recurrence_group_id is not null;

drop policy if exists "events coaches or admin delete" on public.events;
create policy "events coaches or admin delete" on public.events
  for delete using (public.is_admin() or public.is_coach_for_team(team_id));

drop policy if exists "events coaches or admin update" on public.events;
create policy "events coaches or admin update" on public.events
  for update using (public.is_admin() or public.is_coach_for_team(team_id))
  with check (public.is_admin() or public.is_coach_for_team(team_id));
