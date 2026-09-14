-- Link ClubOS teams and events to an existing, server-side COMET fixture feed.
-- The COMET API key remains on the club website; ClubOS stores only public IDs.

alter table public.teams
  add column if not exists comet_team_id bigint,
  add column if not exists comet_competition_id bigint;

alter table public.teams
  add constraint teams_comet_ids_together check (
    (comet_team_id is null and comet_competition_id is null)
    or (comet_team_id > 0 and comet_competition_id > 0)
  );

alter table public.events
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists competition text,
  add column if not exists home_away text;

alter table public.events
  add constraint events_external_identity_together check (
    (external_source is null and external_id is null)
    or (external_source is not null and external_id is not null)
  ),
  add constraint events_home_away_check check (home_away is null or home_away in ('home', 'away'));

create unique index if not exists events_team_external_identity_idx
  on public.events (team_id, external_source, external_id);

comment on column public.teams.comet_team_id is 'Public team ID used by the club website COMET feed.';
comment on column public.teams.comet_competition_id is 'Public competition ID used by the club website COMET feed.';
comment on column public.events.external_id is 'Stable provider match ID used to make fixture sync idempotent.';
