alter table public.attendance_reminders
  add column if not exists sent_by uuid references public.profiles(id) on delete set null,
  add column if not exists source text not null default 'automatic';

alter table public.attendance_reminders
  drop constraint if exists attendance_reminders_source_check;
alter table public.attendance_reminders
  add constraint attendance_reminders_source_check check (source in ('automatic', 'manual'));

revoke all on table public.attendance_reminders from public, anon, authenticated;
grant select, insert, update on table public.attendance_reminders to authenticated;

drop policy if exists "Staff create manual attendance reminders" on public.attendance_reminders;
create policy "Staff create manual attendance reminders"
  on public.attendance_reminders for insert to authenticated
  with check (
    source = 'manual'
    and sent_by = (select auth.uid())
    and exists (
      select 1
      from public.events
      join public.player_teams on player_teams.team_id = events.team_id
      join public.attendance on attendance.event_id = events.id
        and attendance.player_id = attendance_reminders.player_id
        and attendance.status = 'pending'
      where events.id = attendance_reminders.event_id
        and player_teams.player_id = attendance_reminders.player_id
        and (public.is_admin() or public.is_coach_for_team(events.team_id))
    )
  );

drop policy if exists "Staff update manual attendance reminders" on public.attendance_reminders;
create policy "Staff update manual attendance reminders"
  on public.attendance_reminders for update to authenticated
  using (
    exists (
      select 1 from public.events
      where events.id = attendance_reminders.event_id
        and (public.is_admin() or public.is_coach_for_team(events.team_id))
    )
  )
  with check (
    source = 'manual'
    and sent_by = (select auth.uid())
    and exists (
      select 1
      from public.events
      join public.player_teams on player_teams.team_id = events.team_id
      join public.attendance on attendance.event_id = events.id
        and attendance.player_id = attendance_reminders.player_id
        and attendance.status = 'pending'
      where events.id = attendance_reminders.event_id
        and player_teams.player_id = attendance_reminders.player_id
        and (public.is_admin() or public.is_coach_for_team(events.team_id))
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance_reminders'
  ) then
    alter publication supabase_realtime add table public.attendance_reminders;
  end if;
end
$$;

comment on column public.attendance_reminders.sent_by is
  'Coach or administrator who most recently sent a manual reminder; null for automatic reminders.';
comment on column public.attendance_reminders.source is
  'Whether the latest recorded reminder was sent automatically or manually.';
