-- ClubOS Performance Testing, Phase 2.
-- Structured, configurable tests and repeatable squad testing events.

create table public.test_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.test_categories(name, sort_order) values
  ('Speed', 10), ('Acceleration', 20), ('Power', 30),
  ('Accuracy', 40), ('Ball Control', 50), ('Agility', 60)
on conflict (name) do nothing;

create table public.test_definitions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.test_categories(id) on delete restrict,
  name text not null unique check (char_length(trim(name)) between 1 and 120),
  unit text not null check (char_length(trim(unit)) between 1 and 24),
  description text check (char_length(description) <= 1000),
  higher_is_better boolean not null,
  minimum_age smallint check (minimum_age between 3 and 100),
  maximum_age smallint check (maximum_age between 3 and 100),
  decimal_places smallint not null default 2 check (decimal_places between 0 and 4),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (minimum_age is null or maximum_age is null or minimum_age <= maximum_age)
);

insert into public.test_definitions(category_id, name, unit, description, higher_is_better, decimal_places)
select id, '20m Sprint', 'seconds', 'Time to complete a 20 metre sprint.', false, 2 from public.test_categories where name='Speed'
union all select id, '10m Sprint', 'seconds', 'Time to complete a 10 metre acceleration sprint.', false, 2 from public.test_categories where name='Acceleration'
union all select id, 'Standing Long Jump', 'cm', 'Standing two-footed horizontal jump distance.', true, 0 from public.test_categories where name='Power'
union all select id, 'Shooting Accuracy', '%', 'Percentage of the agreed target attempts completed successfully.', true, 1 from public.test_categories where name='Accuracy'
union all select id, 'Ball Control Circuit', 'seconds', 'Time to complete the configured ball-control circuit.', false, 2 from public.test_categories where name='Ball Control'
union all select id, 'Illinois Agility', 'seconds', 'Time to complete the Illinois agility course.', false, 2 from public.test_categories where name='Agility'
on conflict (name) do nothing;

create table public.testing_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  event_date date not null,
  location text check (char_length(location) <= 500),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'open', 'completed', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.testing_event_teams (
  testing_event_id uuid not null references public.testing_events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (testing_event_id, team_id)
);

create table public.testing_event_players (
  testing_event_id uuid not null references public.testing_events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (testing_event_id, player_id)
);

create table public.testing_event_tests (
  testing_event_id uuid not null references public.testing_events(id) on delete cascade,
  test_definition_id uuid not null references public.test_definitions(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (testing_event_id, test_definition_id)
);

create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  test_definition_id uuid not null references public.test_definitions(id) on delete restrict,
  testing_event_id uuid references public.testing_events(id) on delete set null,
  result_value numeric(12,4) not null,
  tested_at date not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text check (char_length(notes) <= 1000),
  visibility text not null default 'staff' check (visibility in ('staff', 'player', 'parent')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index testing_events_date_idx on public.testing_events(event_date desc);
create index testing_event_teams_team_idx on public.testing_event_teams(team_id, testing_event_id);
create index testing_event_players_player_idx on public.testing_event_players(player_id, testing_event_id);
create index test_results_player_test_idx on public.test_results(player_id, test_definition_id, tested_at desc);
create index test_results_event_idx on public.test_results(testing_event_id, player_id);
create unique index test_results_event_player_test_unique
  on public.test_results(testing_event_id, player_id, test_definition_id)
  where testing_event_id is not null;

alter table public.test_categories enable row level security;
alter table public.test_definitions enable row level security;
alter table public.testing_events enable row level security;
alter table public.testing_event_teams enable row level security;
alter table public.testing_event_players enable row level security;
alter table public.testing_event_tests enable row level security;
alter table public.test_results enable row level security;

revoke all on public.test_categories, public.test_definitions, public.testing_events,
  public.testing_event_teams, public.testing_event_players, public.testing_event_tests,
  public.test_results from public, anon, authenticated;
grant select, insert, update, delete on public.test_categories, public.test_definitions,
  public.testing_events, public.testing_event_teams, public.testing_event_players,
  public.testing_event_tests, public.test_results to authenticated;

create or replace function crm_private.can_access_testing_event(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.testing_events e where e.id = p_event and (
      public.is_admin() or e.created_by = auth.uid()
      or exists (select 1 from public.testing_event_teams et where et.testing_event_id=e.id and public.is_coach_for_team(et.team_id))
      or exists (select 1 from public.testing_event_players ep where ep.testing_event_id=e.id
        and (public.is_parent_for_player(ep.player_id) or public.is_linked_player(ep.player_id)))
    )
  );
$$;

create or replace function crm_private.can_manage_testing_event(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.testing_events e where e.id=p_event
    and (public.is_admin() or (e.created_by=auth.uid() and public.has_role('coach')))
  );
$$;

revoke all on function crm_private.can_access_testing_event(uuid) from public, anon;
revoke all on function crm_private.can_manage_testing_event(uuid) from public, anon;
grant execute on function crm_private.can_access_testing_event(uuid) to authenticated, service_role;
grant execute on function crm_private.can_manage_testing_event(uuid) to authenticated, service_role;

create policy test_categories_read on public.test_categories for select to authenticated using (true);
create policy test_categories_admin on public.test_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy test_definitions_read on public.test_definitions for select to authenticated using (true);
create policy test_definitions_admin on public.test_definitions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy testing_events_read on public.testing_events for select to authenticated
  using (crm_private.can_access_testing_event(id));
create policy testing_events_insert on public.testing_events for insert to authenticated
  with check (created_by=auth.uid() and (public.is_admin() or public.has_role('coach')));
create policy testing_events_update on public.testing_events for update to authenticated
  using (crm_private.can_manage_testing_event(id)) with check (crm_private.can_manage_testing_event(id));
create policy testing_events_delete on public.testing_events for delete to authenticated
  using (public.is_admin() or (created_by=auth.uid() and status='draft'));

create policy testing_event_teams_read on public.testing_event_teams for select to authenticated
  using (crm_private.can_access_testing_event(testing_event_id));
create policy testing_event_teams_manage on public.testing_event_teams for all to authenticated
  using (crm_private.can_manage_testing_event(testing_event_id))
  with check (crm_private.can_manage_testing_event(testing_event_id)
    and (public.is_admin() or public.is_coach_for_team(team_id)));

create policy testing_event_players_read on public.testing_event_players for select to authenticated
  using (crm_private.can_access_testing_event(testing_event_id));
create policy testing_event_players_manage on public.testing_event_players for all to authenticated
  using (crm_private.can_manage_testing_event(testing_event_id))
  with check (crm_private.can_manage_testing_event(testing_event_id)
    and (public.is_admin() or crm_private.can_access_player(player_id)));

create policy testing_event_tests_read on public.testing_event_tests for select to authenticated
  using (crm_private.can_access_testing_event(testing_event_id));
create policy testing_event_tests_manage on public.testing_event_tests for all to authenticated
  using (crm_private.can_manage_testing_event(testing_event_id))
  with check (crm_private.can_manage_testing_event(testing_event_id));

create policy test_results_read on public.test_results for select to authenticated using (
  (crm_private.can_access_player(player_id) and (public.is_admin() or public.has_role('coach')))
  or (visibility='parent' and public.is_parent_for_player(player_id))
  or (visibility in ('player','parent') and public.is_linked_player(player_id))
);
create policy test_results_insert on public.test_results for insert to authenticated with check (
  recorded_by=auth.uid() and (public.is_admin() or public.has_role('coach'))
  and crm_private.can_access_player(player_id)
  and (testing_event_id is null or (
    crm_private.can_manage_testing_event(testing_event_id)
    and exists (select 1 from public.testing_event_players ep where ep.testing_event_id=test_results.testing_event_id and ep.player_id=test_results.player_id)
    and exists (select 1 from public.testing_event_tests et where et.testing_event_id=test_results.testing_event_id and et.test_definition_id=test_results.test_definition_id)
  ))
);
create policy test_results_update on public.test_results for update to authenticated
  using (public.is_admin() or recorded_by=auth.uid())
  with check ((public.is_admin() or recorded_by=auth.uid()) and crm_private.can_access_player(player_id));
create policy test_results_delete on public.test_results for delete to authenticated
  using (public.is_admin() or recorded_by=auth.uid());

create or replace function crm_private.protect_test_result_identity()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user='authenticated' and not public.is_admin() and (
    new.id is distinct from old.id
    or new.player_id is distinct from old.player_id
    or new.test_definition_id is distinct from old.test_definition_id
    or new.testing_event_id is distinct from old.testing_event_id
    or new.recorded_by is distinct from old.recorded_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Test result identity cannot be changed.' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function crm_private.protect_test_result_identity() from public, anon;
grant execute on function crm_private.protect_test_result_identity() to authenticated, service_role;
create trigger protect_test_result_identity before update on public.test_results
  for each row execute function crm_private.protect_test_result_identity();

create trigger touch_test_categories before update on public.test_categories
  for each row execute function public.touch_development_record();
create trigger touch_test_definitions before update on public.test_definitions
  for each row execute function public.touch_development_record();
create trigger touch_testing_events before update on public.testing_events
  for each row execute function public.touch_development_record();
create trigger touch_test_results before update on public.test_results
  for each row execute function public.touch_development_record();
