-- Recurring events support.
-- Adds a recurrence_group_id to events so sessions in the same series share an ID.
-- Null means a one-off event.

ALTER TABLE public.events
  ADD COLUMN recurrence_group_id uuid;

-- Index so coaches can quickly query or cancel all sessions in a series.
CREATE INDEX events_recurrence_group_idx ON public.events (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

-- Coaches (and admins) can now delete events they manage.
-- Attendance rows cascade-delete automatically via the existing FK.
CREATE POLICY "events coaches or admin delete" ON public.events
  FOR DELETE USING (public.is_admin() OR public.is_coach_for_team(team_id));

-- Coaches can also update events (e.g. reschedule).
CREATE POLICY "events coaches or admin update" ON public.events
  FOR UPDATE USING (public.is_admin() OR public.is_coach_for_team(team_id))
  WITH CHECK (public.is_admin() OR public.is_coach_for_team(team_id));
