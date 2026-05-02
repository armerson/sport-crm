alter table public.players
  add column if not exists email text default null;
