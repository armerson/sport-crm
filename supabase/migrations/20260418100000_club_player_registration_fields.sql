-- Club-wide custom fields stored on each player (parent self-reg + squad profiles).
-- Complements generic registration_forms (submissions); these attach to players.rows.

create table if not exists public.club_player_fields (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  field_type   text not null default 'text'
    check (field_type in ('text', 'email', 'phone', 'date', 'number', 'textarea', 'select', 'checkbox', 'checkboxes')),
  required     boolean not null default false,
  options      jsonb,
  placeholder  text,
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default timezone('utc', now())
);

create table if not exists public.player_field_values (
  player_id uuid not null references public.players(id) on delete cascade,
  field_id  uuid not null references public.club_player_fields(id) on delete cascade,
  value     text,
  primary key (player_id, field_id)
);

alter table public.club_player_fields enable row level security;
alter table public.player_field_values enable row level security;

-- Anyone can read active field definitions (public parent registration)
create policy "public read active club player fields"
  on public.club_player_fields for select
  using (active = true or exists (
    select 1 from public.profiles where id = auth.uid() and 'admin' = any(roles)
  ));

create policy "admins manage club player fields"
  on public.club_player_fields for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and 'admin' = any(roles)
  ))
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and 'admin' = any(roles)
  ));

-- Field values: admins
create policy "admins all player field values"
  on public.player_field_values for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and 'admin' = any(roles)
  ))
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and 'admin' = any(roles)
  ));

-- Parents: own linked players
create policy "parents manage own children field values"
  on public.player_field_values for all
  using (
    exists (
      select 1 from public.player_parents pp
      where pp.player_id = player_field_values.player_id
        and pp.parent_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.player_parents pp
      where pp.player_id = player_field_values.player_id
        and pp.parent_id = auth.uid()
    )
  );

-- Coaches: players on their teams
create policy "coaches manage squad player field values"
  on public.player_field_values for all
  using (
    exists (
      select 1
      from public.player_teams pt
      join public.team_coaches tc on tc.team_id = pt.team_id and tc.coach_id = auth.uid()
      where pt.player_id = player_field_values.player_id
    )
  )
  with check (
    exists (
      select 1
      from public.player_teams pt
      join public.team_coaches tc on tc.team_id = pt.team_id and tc.coach_id = auth.uid()
      where pt.player_id = player_field_values.player_id
    )
  );

-- RPC: create pending children + optional custom field map { "field_uuid": "value", ... }
create or replace function public.register_signup_children_with_field_values(p_children jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $body$
declare
  elem jsonb;
  new_id uuid;
  ids uuid[] := '{}';
  fk text;
  fv text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and ('parent' = any(roles) or 'admin' = any(roles))
  ) then
    raise exception 'not authorised';
  end if;

  for elem in select * from jsonb_array_elements(coalesce(p_children, '[]'::jsonb))
  loop
    insert into public.players (name, dob, status)
    values (
      trim(coalesce(elem->>'name', '')),
      nullif(trim(coalesce(elem->>'dob', '')), '')::date,
      'pending'
    )
    returning id into new_id;

    insert into public.player_parents (player_id, parent_id)
    values (new_id, auth.uid());

    ids := array_append(ids, new_id);

    if elem ? 'custom' and jsonb_typeof(elem->'custom') = 'object' then
      for fk, fv in select * from jsonb_each_text(elem->'custom')
      loop
        begin
          if exists (
            select 1 from public.club_player_fields f
            where f.id = fk::uuid and f.active = true
          ) then
            insert into public.player_field_values (player_id, field_id, value)
            values (new_id, fk::uuid, fv)
            on conflict (player_id, field_id) do update set value = excluded.value;
          end if;
        exception
          when invalid_text_representation then
            null;
        end;
      end loop;
    end if;
  end loop;

  return ids;
end;
$body$;

grant execute on function public.register_signup_children_with_field_values(jsonb) to authenticated;

do $do$ begin
  alter publication supabase_realtime add table public.club_player_fields;
exception when duplicate_object then null;
end $do$;
