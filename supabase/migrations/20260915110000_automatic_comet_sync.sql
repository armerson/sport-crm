create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

alter table public.teams
  add column if not exists comet_last_synced_at timestamptz,
  add column if not exists comet_last_sync_status text,
  add column if not exists comet_last_sync_error text,
  add column if not exists comet_last_sync_count integer;

alter table public.teams
  drop constraint if exists teams_comet_last_sync_status_check;

alter table public.teams
  add constraint teams_comet_last_sync_status_check
  check (comet_last_sync_status is null or comet_last_sync_status in ('success', 'error'));

comment on column public.teams.comet_last_synced_at is 'Time the most recent manual or scheduled COMET fixture sync completed.';
comment on column public.teams.comet_last_sync_status is 'Outcome of the most recent COMET fixture sync.';
comment on column public.teams.comet_last_sync_error is 'Safe user-facing error from the most recent failed COMET sync.';
comment on column public.teams.comet_last_sync_count is 'Number of valid fixtures returned by the most recent successful COMET sync.';

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'daily-comet-fixture-sync' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'daily-comet-fixture-sync',
    '15 5 * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scheduled-comet-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'comet_sync_secret')
        ),
        body := jsonb_build_object('source', 'daily-cron'),
        timeout_milliseconds := 55000
      );
    $cron$
  );
end;
$$;
