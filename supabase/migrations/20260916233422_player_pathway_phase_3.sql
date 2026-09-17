-- ClubOS Player Pathway, Phase 3.
-- Pathway progression is deliberately independent from player_teams membership.

create table public.pathway_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 100),
  description text check (char_length(description) <= 1000),
  sort_order integer not null,
  linked_team_id uuid references public.teams(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (sort_order)
);

create table public.player_pathway_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  pathway_stage_id uuid not null references public.pathway_stages(id) on delete restrict,
  started_on date not null,
  ended_on date,
  is_current boolean not null default true,
  recommendation text check (char_length(recommendation) <= 2000),
  notes text check (char_length(notes) <= 2000),
  visibility text not null default 'parent' check (visibility in ('internal', 'player', 'parent')),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((is_current and ended_on is null) or (not is_current and ended_on is not null)),
  check (ended_on is null or ended_on >= started_on)
);

create unique index player_pathway_one_current_idx
  on public.player_pathway_history(player_id) where is_current;
create index player_pathway_history_player_date_idx
  on public.player_pathway_history(player_id, started_on desc);
create index player_pathway_history_stage_idx
  on public.player_pathway_history(pathway_stage_id, started_on desc);
create index pathway_stages_linked_team_idx
  on public.pathway_stages(linked_team_id) where linked_team_id is not null;
create index player_pathway_history_recorded_by_idx
  on public.player_pathway_history(recorded_by) where recorded_by is not null;

create table public.pathway_recommendations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  recommended_stage_id uuid not null references public.pathway_stages(id) on delete restrict,
  status text not null default 'monitoring' check (status in ('monitoring', 'ready', 'progressed', 'closed')),
  recommendation text not null check (char_length(trim(recommendation)) between 1 and 2000),
  recommended_by uuid references public.profiles(id) on delete set null,
  review_date date,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index pathway_recommendations_player_status_idx
  on public.pathway_recommendations(player_id, status, created_at desc);
create index pathway_recommendations_stage_idx
  on public.pathway_recommendations(recommended_stage_id, status);
create index pathway_recommendations_recommended_by_idx
  on public.pathway_recommendations(recommended_by) where recommended_by is not null;

create table public.pathway_opportunities (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  opportunity_team_id uuid not null references public.teams(id) on delete restrict,
  pathway_stage_id uuid references public.pathway_stages(id) on delete set null,
  opportunity_type text not null check (opportunity_type in ('training', 'appearance', 'trial', 'call_up')),
  occurred_on date not null,
  outcome text check (char_length(outcome) <= 1000),
  notes text check (char_length(notes) <= 2000),
  visibility text not null default 'internal' check (visibility in ('internal', 'player', 'parent')),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index pathway_opportunities_player_date_idx
  on public.pathway_opportunities(player_id, occurred_on desc);
create index pathway_opportunities_team_date_idx
  on public.pathway_opportunities(opportunity_team_id, occurred_on desc);
create index pathway_opportunities_stage_idx
  on public.pathway_opportunities(pathway_stage_id) where pathway_stage_id is not null;
create index pathway_opportunities_recorded_by_idx
  on public.pathway_opportunities(recorded_by) where recorded_by is not null;

alter table public.player_development_goals
  add column readiness_for_stage_id uuid references public.pathway_stages(id) on delete set null;
create index player_development_goals_readiness_stage_idx
  on public.player_development_goals(readiness_for_stage_id)
  where readiness_for_stage_id is not null;

-- Coaches need the club's team names to record cross-team pathway opportunities.
-- This broadens team-directory read only; player and membership access remains scoped.
alter policy teams_read on public.teams
  using (crm_private.can_access_team(id) or (select public.has_role('coach')));

alter table public.pathway_stages enable row level security;
alter table public.player_pathway_history enable row level security;
alter table public.pathway_recommendations enable row level security;
alter table public.pathway_opportunities enable row level security;

revoke all on public.pathway_stages, public.player_pathway_history,
  public.pathway_recommendations, public.pathway_opportunities
  from public, anon, authenticated;
grant select, insert, update, delete on public.pathway_stages,
  public.player_pathway_history, public.pathway_recommendations,
  public.pathway_opportunities to authenticated;

create policy pathway_stages_read on public.pathway_stages
  for select to authenticated using (true);
create policy pathway_stages_admin on public.pathway_stages
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy pathway_history_read on public.player_pathway_history
  for select to authenticated using (
    (crm_private.can_access_player(player_id) and ((select public.is_admin()) or (select public.has_role('coach'))))
    or (visibility='parent' and public.is_parent_for_player(player_id))
    or (visibility in ('player','parent') and public.is_linked_player(player_id))
  );
create policy pathway_history_insert on public.player_pathway_history
  for insert to authenticated with check (
    recorded_by=(select auth.uid()) and crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or (select public.has_role('coach')))
  );
create policy pathway_history_update on public.player_pathway_history
  for update to authenticated using (
    crm_private.can_access_player(player_id) and ((select public.is_admin()) or (select public.has_role('coach')))
  ) with check (
    crm_private.can_access_player(player_id) and ((select public.is_admin()) or (select public.has_role('coach')))
  );
create policy pathway_history_delete on public.player_pathway_history
  for delete to authenticated using ((select public.is_admin()));

create policy pathway_recommendations_staff on public.pathway_recommendations
  for select to authenticated using (
    crm_private.can_access_player(player_id) and ((select public.is_admin()) or (select public.has_role('coach')))
  );
create policy pathway_recommendations_insert on public.pathway_recommendations
  for insert to authenticated with check (
    recommended_by=(select auth.uid()) and crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or (select public.has_role('coach')))
  );
create policy pathway_recommendations_update on public.pathway_recommendations
  for update to authenticated using (
    crm_private.can_access_player(player_id) and ((select public.is_admin()) or recommended_by=(select auth.uid()))
  ) with check (
    crm_private.can_access_player(player_id) and ((select public.is_admin()) or recommended_by=(select auth.uid()))
  );
create policy pathway_recommendations_delete on public.pathway_recommendations
  for delete to authenticated using ((select public.is_admin()));

create policy pathway_opportunities_read on public.pathway_opportunities
  for select to authenticated using (
    (crm_private.can_access_player(player_id) and ((select public.is_admin()) or (select public.has_role('coach'))))
    or (visibility='parent' and public.is_parent_for_player(player_id))
    or (visibility in ('player','parent') and public.is_linked_player(player_id))
  );
create policy pathway_opportunities_insert on public.pathway_opportunities
  for insert to authenticated with check (
    recorded_by=(select auth.uid()) and crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or (select public.has_role('coach')))
  );
create policy pathway_opportunities_update on public.pathway_opportunities
  for update to authenticated using (
    crm_private.can_access_player(player_id) and ((select public.is_admin()) or recorded_by=(select auth.uid()))
  ) with check (
    crm_private.can_access_player(player_id) and ((select public.is_admin()) or recorded_by=(select auth.uid()))
  );
create policy pathway_opportunities_delete on public.pathway_opportunities
  for delete to authenticated using ((select public.is_admin()));

create or replace function crm_private.protect_pathway_identity()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user='authenticated' and not (select public.is_admin()) then
    if tg_table_name='player_pathway_history' and (
      new.id is distinct from old.id or new.player_id is distinct from old.player_id
      or new.recorded_by is distinct from old.recorded_by or new.created_at is distinct from old.created_at
    ) then raise exception 'Pathway history identity cannot be changed.' using errcode='42501';
    elsif tg_table_name='pathway_recommendations' and (
      new.id is distinct from old.id or new.player_id is distinct from old.player_id
      or new.recommended_by is distinct from old.recommended_by or new.created_at is distinct from old.created_at
    ) then raise exception 'Pathway recommendation identity cannot be changed.' using errcode='42501';
    elsif tg_table_name='pathway_opportunities' and (
      new.id is distinct from old.id or new.player_id is distinct from old.player_id
      or new.recorded_by is distinct from old.recorded_by or new.created_at is distinct from old.created_at
    ) then raise exception 'Pathway opportunity identity cannot be changed.' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function crm_private.protect_pathway_identity() from public, anon;
grant execute on function crm_private.protect_pathway_identity() to authenticated, service_role;
create trigger protect_player_pathway_identity before update on public.player_pathway_history
  for each row execute function crm_private.protect_pathway_identity();
create trigger protect_pathway_recommendation_identity before update on public.pathway_recommendations
  for each row execute function crm_private.protect_pathway_identity();
create trigger protect_pathway_opportunity_identity before update on public.pathway_opportunities
  for each row execute function crm_private.protect_pathway_identity();

create trigger touch_pathway_stages before update on public.pathway_stages
  for each row execute function public.touch_development_record();
create trigger touch_player_pathway_history before update on public.player_pathway_history
  for each row execute function public.touch_development_record();
create trigger touch_pathway_recommendations before update on public.pathway_recommendations
  for each row execute function public.touch_development_record();
create trigger touch_pathway_opportunities before update on public.pathway_opportunities
  for each row execute function public.touch_development_record();

create or replace function public.advance_player_pathway(
  p_player_id uuid,
  p_stage_id uuid,
  p_started_on date,
  p_recommendation text default null,
  p_notes text default null,
  p_visibility text default 'parent'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare new_history_id uuid;
begin
  if (select auth.uid()) is null
    or not ((select public.is_admin()) or (select public.has_role('coach')))
    or not crm_private.can_access_player(p_player_id) then
    raise exception 'Not authorised' using errcode='42501';
  end if;
  if p_visibility not in ('internal','player','parent') then
    raise exception 'Invalid visibility';
  end if;
  if not exists(select 1 from public.pathway_stages where id=p_stage_id and active) then
    raise exception 'Pathway stage not found';
  end if;

  update public.player_pathway_history
    set is_current=false, ended_on=p_started_on
    where player_id=p_player_id and is_current;

  insert into public.player_pathway_history(
    player_id, pathway_stage_id, started_on, recommendation, notes, visibility, recorded_by
  ) values (
    p_player_id, p_stage_id, p_started_on, nullif(trim(p_recommendation),''),
    nullif(trim(p_notes),''), p_visibility, (select auth.uid())
  ) returning id into new_history_id;

  return new_history_id;
end;
$$;

revoke all on function public.advance_player_pathway(uuid,uuid,date,text,text,text) from public, anon;
grant execute on function public.advance_player_pathway(uuid,uuid,date,text,text,text) to authenticated, service_role;
