alter table public.events
  add column if not exists meet_time timestamptz,
  add column if not exists end_time timestamptz;

alter table public.events
  add constraint events_meet_time_check check (meet_time is null or meet_time <= date_time),
  add constraint events_end_time_check check (end_time is null or end_time > date_time);

-- When an external fixture sync moves kickoff, keep manually entered relative
-- meet/finish times aligned unless that same update explicitly changes them.
create or replace function public.shift_event_supporting_times()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  moved_by interval;
begin
  if new.date_time is distinct from old.date_time then
    moved_by := new.date_time - old.date_time;
    if new.meet_time is not distinct from old.meet_time and old.meet_time is not null then
      new.meet_time := old.meet_time + moved_by;
    end if;
    if new.end_time is not distinct from old.end_time and old.end_time is not null then
      new.end_time := old.end_time + moved_by;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists shift_event_supporting_times_trigger on public.events;
create trigger shift_event_supporting_times_trigger
before update of date_time on public.events
for each row execute function public.shift_event_supporting_times();

comment on column public.events.meet_time is 'Optional squad arrival or meet time before the event starts.';
comment on column public.events.end_time is 'Optional expected finish time for the event.';
