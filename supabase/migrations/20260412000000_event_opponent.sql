-- Add opponent name to events for match fixtures.
-- Null for non-match events; populated when creating a match event.
alter table public.events add column if not exists opponent text;
