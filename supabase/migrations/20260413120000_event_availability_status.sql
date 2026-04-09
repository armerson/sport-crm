-- Event availability status: coaches send an availability request first,
-- then confirm once they have enough responses.
alter table public.events
  add column if not exists event_status text not null default 'confirmed'
    check (event_status in ('availability_request', 'confirmed', 'cancelled'));

-- Back-fill: existing events are already confirmed
update public.events set event_status = 'confirmed' where event_status is null;
