-- Run after 20260915110000_automatic_comet_sync. Synthetic data is rolled back.
begin;
insert into public.teams(id,name,age_group,comet_team_id,comet_competition_id) values
  ('ac202609-1511-4000-8000-000000000001','CRM COMET Test Team','U17',101,202);

update public.teams set
  comet_last_synced_at=now(),
  comet_last_sync_status='success',
  comet_last_sync_count=4,
  comet_last_sync_error=null
where id='ac202609-1511-4000-8000-000000000001';

do $$
begin
  assert exists(
    select 1 from public.teams
    where id='ac202609-1511-4000-8000-000000000001'
      and comet_last_sync_status='success'
      and comet_last_sync_count=4
      and comet_last_sync_error is null
  ), 'COMET sync health was not stored';
  assert exists(
    select 1 from cron.job
    where jobname='daily-comet-fixture-sync'
      and schedule='15 5 * * *'
      and active
  ), 'daily COMET schedule is missing';
end;
$$;
rollback;
