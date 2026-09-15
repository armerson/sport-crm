-- Preserve a folded team's history while removing it from daily club work.
alter table public.teams add column if not exists archived_at timestamptz;

create index if not exists teams_active_age_group_idx
  on public.teams(age_group, name)
  where archived_at is null;

create or replace function public.teams_in_group(root_group_id uuid)
returns table (team_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  with recursive group_tree as (
    select id from public.groups where id = root_group_id
    union all
    select g.id from public.groups g
    inner join group_tree gt on g.parent_id = gt.id
  )
  select gt2.team_id
  from public.group_teams gt2
  join public.teams t on t.id = gt2.team_id and t.archived_at is null
  where gt2.group_id in (select id from group_tree)
$$;
