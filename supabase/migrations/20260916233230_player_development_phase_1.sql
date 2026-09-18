-- ClubOS Player Development, Phase 1.
-- Additive migration: the existing players, teams, profiles and player_reviews
-- remain the source records. Legacy review columns are retained for rollback.

create table public.development_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.development_categories(name, sort_order) values
  ('Technical', 10), ('Physical', 20), ('Tactical', 30),
  ('Psychological', 40), ('Social / Team', 50)
on conflict (name) do nothing;

create table public.assessment_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  score_min smallint not null default 1,
  score_max smallint not null default 5,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (score_min >= 0 and score_max > score_min and score_max <= 10)
);

insert into public.assessment_areas(name, description, sort_order) values
  ('Technical', 'Ball control, passing, shooting and dribbling', 10),
  ('Tactical', 'Positioning, decision-making and game awareness', 20),
  ('Physical', 'Pace, stamina, strength and agility', 30),
  ('Psychological', 'Confidence, resilience, focus and response to setbacks', 40),
  ('Social / Team', 'Teamwork, communication, respect and coachability', 50)
on conflict (name) do nothing;

alter table public.player_reviews
  add column assessment_date date not null default current_date;

create table public.player_assessment_scores (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.player_reviews(id) on delete cascade,
  assessment_area_id uuid not null references public.assessment_areas(id) on delete restrict,
  score smallint not null check (score between 0 and 10),
  observation text check (char_length(observation) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (review_id, assessment_area_id)
);

create table public.player_assessment_feedback (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.player_reviews(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('strength', 'development_priority', 'comment')),
  audience text not null check (audience in ('internal', 'player', 'parent')),
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Internal notes live on a staff-only row. Keeping them on a parent-readable
-- review row would make omission by the frontend the only privacy control.
create table public.player_review_private_notes (
  review_id uuid primary key references public.player_reviews(id) on delete cascade,
  notes text not null check (char_length(notes) <= 4000),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.player_review_private_notes(review_id, notes, updated_by, created_at, updated_at)
select id, coach_notes, coach_id, created_at, updated_at
from public.player_reviews
where nullif(trim(coach_notes), '') is not null
on conflict (review_id) do nothing;

insert into public.player_assessment_feedback(review_id, feedback_type, audience, content, created_by, created_at, updated_at)
select id, 'strength', 'parent', strengths, coach_id, created_at, updated_at
from public.player_reviews where nullif(trim(strengths), '') is not null;

insert into public.player_assessment_feedback(review_id, feedback_type, audience, content, created_by, created_at, updated_at)
select id, 'development_priority', 'parent', areas_to_improve, coach_id, created_at, updated_at
from public.player_reviews where nullif(trim(areas_to_improve), '') is not null;

insert into public.player_assessment_scores(review_id, assessment_area_id, score, created_at, updated_at)
select r.id, a.id, v.score, r.created_at, r.updated_at
from public.player_reviews r
cross join lateral (values
  ('Technical', r.rating_technical), ('Tactical', r.rating_tactical),
  ('Physical', r.rating_physical), ('Psychological', r.rating_attitude)
) v(area_name, score)
join public.assessment_areas a on a.name = v.area_name
where v.score is not null
on conflict (review_id, assessment_area_id) do nothing;

-- Remove sensitive content from the broadly readable legacy row after backfill.
update public.player_reviews set coach_notes = null where coach_notes is not null;

create table public.player_development_goals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  category_id uuid references public.development_categories(id) on delete restrict,
  originating_team_id uuid references public.teams(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text check (char_length(description) <= 2000),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'achieved', 'paused')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  visibility text not null default 'internal' check (visibility in ('internal', 'player', 'parent')),
  progress smallint not null default 0 check (progress between 0 and 100),
  created_by uuid references public.profiles(id) on delete set null,
  assigned_coach_id uuid references public.profiles(id) on delete set null,
  target_date date,
  achieved_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.development_goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.player_development_goals(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  status text check (status in ('not_started', 'in_progress', 'achieved', 'paused')),
  progress smallint check (progress between 0 and 100),
  comment text check (char_length(comment) <= 2000),
  audience text not null default 'internal' check (audience in ('internal', 'player', 'parent')),
  created_at timestamptz not null default timezone('utc', now()),
  check (status is not null or progress is not null or nullif(trim(comment), '') is not null)
);

create index player_development_goals_player_idx on public.player_development_goals(player_id, archived_at, status);
create index player_development_goals_coach_idx on public.player_development_goals(assigned_coach_id, status);
create index development_goal_updates_goal_idx on public.development_goal_updates(goal_id, created_at desc);
create index assessment_scores_review_idx on public.player_assessment_scores(review_id);
create index assessment_feedback_review_idx on public.player_assessment_feedback(review_id, audience);
create index player_reviews_assessment_date_idx on public.player_reviews(player_id, assessment_date desc);

alter table public.development_categories enable row level security;
alter table public.assessment_areas enable row level security;
alter table public.player_assessment_scores enable row level security;
alter table public.player_assessment_feedback enable row level security;
alter table public.player_review_private_notes enable row level security;
alter table public.player_development_goals enable row level security;
alter table public.development_goal_updates enable row level security;

revoke all on public.development_categories, public.assessment_areas,
  public.player_assessment_scores, public.player_assessment_feedback,
  public.player_review_private_notes, public.player_development_goals,
  public.development_goal_updates from public, anon, authenticated;
grant select, insert, update, delete on public.development_categories, public.assessment_areas,
  public.player_assessment_scores, public.player_assessment_feedback,
  public.player_review_private_notes, public.player_development_goals,
  public.development_goal_updates to authenticated;

create policy development_categories_read on public.development_categories
  for select to authenticated using (true);
create policy development_categories_admin on public.development_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy assessment_areas_read on public.assessment_areas
  for select to authenticated using (true);
create policy assessment_areas_admin on public.assessment_areas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy assessment_scores_read on public.player_assessment_scores
  for select to authenticated using (exists (
    select 1 from public.player_reviews r where r.id = review_id and (
      (r.status = 'published' and (public.is_parent_for_player(r.player_id) or public.is_linked_player(r.player_id)))
      or (crm_private.can_access_player(r.player_id) and (public.is_admin() or public.has_role('coach')))
    )
  ));
create policy assessment_scores_manage on public.player_assessment_scores
  for all to authenticated using (exists (
    select 1 from public.player_reviews r where r.id = review_id
    and (public.is_admin() or public.is_coach_for_team(r.team_id))
  )) with check (exists (
    select 1 from public.player_reviews r where r.id = review_id
    and (public.is_admin() or public.is_coach_for_team(r.team_id))
  ));

create policy assessment_feedback_read on public.player_assessment_feedback
  for select to authenticated using (exists (
    select 1 from public.player_reviews r where r.id = review_id and (
      (crm_private.can_access_player(r.player_id) and (public.is_admin() or public.has_role('coach')))
      or (r.status = 'published' and audience = 'parent' and public.is_parent_for_player(r.player_id))
      or (r.status = 'published' and audience in ('player', 'parent') and public.is_linked_player(r.player_id))
    )
  ));
create policy assessment_feedback_manage on public.player_assessment_feedback
  for all to authenticated using (exists (
    select 1 from public.player_reviews r where r.id = review_id
    and (public.is_admin() or public.is_coach_for_team(r.team_id))
  )) with check (exists (
    select 1 from public.player_reviews r where r.id = review_id
    and (public.is_admin() or public.is_coach_for_team(r.team_id))
  ));

create policy private_review_notes_staff on public.player_review_private_notes
  for all to authenticated using (exists (
    select 1 from public.player_reviews r where r.id = review_id
    and (public.is_admin() or public.is_coach_for_team(r.team_id))
  )) with check (exists (
    select 1 from public.player_reviews r where r.id = review_id
    and (public.is_admin() or public.is_coach_for_team(r.team_id))
  ));

create policy development_goals_read on public.player_development_goals
  for select to authenticated using (
    (crm_private.can_access_player(player_id) and (public.is_admin() or public.has_role('coach')))
    or (visibility = 'parent' and public.is_parent_for_player(player_id))
    or (visibility in ('player', 'parent') and public.is_linked_player(player_id))
  );
create policy development_goals_insert on public.player_development_goals
  for insert to authenticated with check (
    crm_private.can_access_player(player_id)
    and (public.is_admin() or public.has_role('coach'))
    and created_by = auth.uid()
    and (assigned_coach_id is null or assigned_coach_id = auth.uid() or public.is_admin())
  );
create policy development_goals_update on public.player_development_goals
  for update to authenticated using (
    crm_private.can_access_player(player_id) and (public.is_admin() or public.has_role('coach'))
  ) with check (
    crm_private.can_access_player(player_id) and (public.is_admin() or public.has_role('coach'))
    and (assigned_coach_id is null or assigned_coach_id = auth.uid() or public.is_admin())
  );
create policy development_goals_delete on public.player_development_goals
  for delete to authenticated using (public.is_admin());

create policy goal_updates_read on public.development_goal_updates
  for select to authenticated using (exists (
    select 1 from public.player_development_goals g where g.id = goal_id and (
      (crm_private.can_access_player(g.player_id) and (public.is_admin() or public.has_role('coach')))
      or (g.visibility = 'parent' and audience = 'parent' and public.is_parent_for_player(g.player_id))
      or (g.visibility in ('player', 'parent') and audience in ('player', 'parent') and public.is_linked_player(g.player_id))
    )
  ));
create policy goal_updates_insert on public.development_goal_updates
  for insert to authenticated with check (
    created_by = auth.uid() and exists (
      select 1 from public.player_development_goals g where g.id = goal_id
      and crm_private.can_access_player(g.player_id) and (public.is_admin() or public.has_role('coach'))
    )
  );

-- Preserve goal history: updates are append-only and goals are archived rather
-- than deleted by coaches. Admin deletion remains available for data correction.

create or replace function public.touch_development_record()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger touch_development_categories before update on public.development_categories
  for each row execute function public.touch_development_record();
create trigger touch_assessment_areas before update on public.assessment_areas
  for each row execute function public.touch_development_record();
create trigger touch_assessment_scores before update on public.player_assessment_scores
  for each row execute function public.touch_development_record();
create trigger touch_assessment_feedback before update on public.player_assessment_feedback
  for each row execute function public.touch_development_record();
create trigger touch_private_review_notes before update on public.player_review_private_notes
  for each row execute function public.touch_development_record();

create or replace function public.sync_development_goal_update()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at := timezone('utc', now());
  if new.status = 'achieved' and old.status is distinct from 'achieved' then
    new.achieved_at := timezone('utc', now());
    new.progress := 100;
  elsif new.status <> 'achieved' then
    new.achieved_at := null;
  end if;
  if new.status = 'paused' and old.status is distinct from 'paused' then
    new.paused_at := timezone('utc', now());
  elsif new.status <> 'paused' then
    new.paused_at := null;
  end if;
  return new;
end;
$$;

create trigger sync_development_goal before update on public.player_development_goals
  for each row execute function public.sync_development_goal_update();

revoke all on function public.touch_development_record() from public, anon;
revoke all on function public.sync_development_goal_update() from public, anon;
grant execute on function public.touch_development_record() to authenticated, service_role;
grant execute on function public.sync_development_goal_update() to authenticated, service_role;
