-- ClubOS Player Cards, Progress Reports and Achievements, Phase 4.
-- The existing players table remains the identity source of truth.

create table public.player_achievements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  achievement_type text not null default 'development'
    check (achievement_type in ('development','testing','pathway','attendance','team','other')),
  awarded_on date not null default current_date,
  awarded_by uuid references public.profiles(id) on delete set null,
  visibility text not null default 'parent' check (visibility in ('internal','player','parent')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index player_achievements_player_date_idx
  on public.player_achievements(player_id, awarded_on desc);
create index player_achievements_awarded_by_idx
  on public.player_achievements(awarded_by) where awarded_by is not null;

-- One explicit allow-list per player. False is the safe default for every field.
-- This configuration does not publish a card; it only records fields approved for
-- a future deliberately shared representation.
create table public.player_card_permissions (
  player_id uuid primary key references public.players(id) on delete restrict,
  show_photo boolean not null default false,
  show_age_group boolean not null default false,
  show_team boolean not null default false,
  show_position boolean not null default false,
  show_pathway_stage boolean not null default false,
  show_attendance boolean not null default false,
  show_development_progress boolean not null default false,
  show_performance_metrics boolean not null default false,
  show_achievements boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  check ((approved_by is null and approved_at is null) or (approved_by is not null and approved_at is not null))
);

create index player_card_permissions_approved_by_idx
  on public.player_card_permissions(approved_by) where approved_by is not null;

-- Snapshot is intentionally JSONB: unlike live structured development data, a
-- report must preserve exactly what was presented at creation time.
create table public.player_reports (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 160),
  period_start date,
  period_end date,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  visibility text not null default 'internal' check (visibility in ('internal','player','parent')),
  coach_comment text check (char_length(coach_comment) <= 4000),
  snapshot_version smallint not null default 1 check (snapshot_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (period_end is null or period_start is null or period_end >= period_start),
  check ((status = 'published' and published_at is not null) or (status <> 'published' and published_at is null))
);

create index player_reports_player_created_idx
  on public.player_reports(player_id, created_at desc);
create index player_reports_created_by_idx
  on public.player_reports(created_by) where created_by is not null;
create index player_reports_visible_idx
  on public.player_reports(player_id, status, visibility, created_at desc);

alter table public.player_achievements enable row level security;
alter table public.player_card_permissions enable row level security;
alter table public.player_reports enable row level security;

revoke all on public.player_achievements, public.player_card_permissions, public.player_reports
  from public, anon, authenticated;
grant select, insert, update, delete on public.player_achievements,
  public.player_card_permissions, public.player_reports to authenticated;

create policy player_achievements_read on public.player_achievements
  for select to authenticated using (
    (crm_private.can_access_player(player_id) and ((select public.is_admin()) or (select public.has_role('coach'))))
    or (visibility='parent' and public.is_parent_for_player(player_id))
    or (visibility in ('player','parent') and public.is_linked_player(player_id))
  );
create policy player_achievements_insert on public.player_achievements
  for insert to authenticated with check (
    awarded_by=(select auth.uid()) and crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or (select public.has_role('coach')))
  );
create policy player_achievements_update on public.player_achievements
  for update to authenticated using (
    crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or awarded_by=(select auth.uid()))
  ) with check (
    crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or awarded_by=(select auth.uid()))
  );
create policy player_achievements_delete on public.player_achievements
  for delete to authenticated using ((select public.is_admin()));

create policy player_card_permissions_read on public.player_card_permissions
  for select to authenticated using (
    crm_private.can_access_player(player_id)
    or public.is_parent_for_player(player_id)
    or public.is_linked_player(player_id)
  );
create policy player_card_permissions_admin on public.player_card_permissions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy player_reports_read on public.player_reports
  for select to authenticated using (
    (crm_private.can_access_player(player_id) and ((select public.is_admin()) or (select public.has_role('coach'))))
    or (status='published' and visibility='parent' and public.is_parent_for_player(player_id))
    or (status='published' and visibility in ('player','parent') and public.is_linked_player(player_id))
  );
create policy player_reports_insert on public.player_reports
  for insert to authenticated with check (
    created_by=(select auth.uid()) and crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or (select public.has_role('coach')))
  );
create policy player_reports_update on public.player_reports
  for update to authenticated using (
    crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or created_by=(select auth.uid()))
  ) with check (
    crm_private.can_access_player(player_id)
    and ((select public.is_admin()) or created_by=(select auth.uid()))
  );
create policy player_reports_delete on public.player_reports
  for delete to authenticated using ((select public.is_admin()));

create or replace function crm_private.protect_phase4_identity()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user='authenticated' and not (select public.is_admin()) then
    if tg_table_name='player_achievements' and (
      new.id is distinct from old.id or new.player_id is distinct from old.player_id
      or new.awarded_by is distinct from old.awarded_by or new.created_at is distinct from old.created_at
    ) then raise exception 'Achievement identity cannot be changed.' using errcode='42501';
    elsif tg_table_name='player_reports' and (
      new.id is distinct from old.id or new.player_id is distinct from old.player_id
      or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
      or new.snapshot is distinct from old.snapshot or new.snapshot_version is distinct from old.snapshot_version
    ) then raise exception 'Report identity and snapshot cannot be changed.' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function crm_private.protect_phase4_identity() from public, anon;
grant execute on function crm_private.protect_phase4_identity() to authenticated, service_role;

create trigger protect_player_achievement_identity before update on public.player_achievements
  for each row execute function crm_private.protect_phase4_identity();
create trigger protect_player_report_snapshot before update on public.player_reports
  for each row execute function crm_private.protect_phase4_identity();

create trigger touch_player_achievements before update on public.player_achievements
  for each row execute function public.touch_development_record();
create trigger touch_player_card_permissions before update on public.player_card_permissions
  for each row execute function public.touch_development_record();
create trigger touch_player_reports before update on public.player_reports
  for each row execute function public.touch_development_record();

create or replace function public.publish_player_report(p_report_id uuid, p_visibility text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_visibility not in ('player','parent') then raise exception 'Invalid report visibility'; end if;
  update public.player_reports
    set status='published', visibility=p_visibility, published_at=timezone('utc', now())
    where id=p_report_id;
  if not found then raise exception 'Report not found or not authorised' using errcode='42501'; end if;
end;
$$;
revoke all on function public.publish_player_report(uuid,text) from public, anon;
grant execute on function public.publish_player_report(uuid,text) to authenticated, service_role;
