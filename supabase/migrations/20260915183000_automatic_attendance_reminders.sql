create table if not exists public.attendance_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  sent_at timestamptz not null default timezone('utc', now()),
  unique (event_id, player_id)
);

create index if not exists attendance_reminders_player_idx
  on public.attendance_reminders (player_id);

alter table public.attendance_reminders enable row level security;

create policy "Staff read attendance reminder history"
  on public.attendance_reminders for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.events
      where events.id = attendance_reminders.event_id
        and public.is_coach_for_team(events.team_id)
    )
  );

comment on table public.attendance_reminders is
  'One automatic availability reminder per player and event, used to prevent duplicate alerts.';

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'hourly-attendance-reminders' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'hourly-attendance-reminders',
    '20 * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scheduled-attendance-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'comet_sync_secret')
        ),
        body := jsonb_build_object('source', 'hourly-cron'),
        timeout_milliseconds := 55000
      );
    $cron$
  );
end;
$$;
