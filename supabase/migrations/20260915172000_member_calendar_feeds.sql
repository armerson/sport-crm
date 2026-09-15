-- Private, revocable calendar subscription URLs for signed-in members.
create table if not exists public.calendar_feed_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  rotated_at timestamptz not null default timezone('utc', now())
);

alter table public.calendar_feed_tokens enable row level security;

create policy "Members can read their calendar feed token"
  on public.calendar_feed_tokens for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Members can create their calendar feed token"
  on public.calendar_feed_tokens for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Members can rotate their calendar feed token"
  on public.calendar_feed_tokens for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Members can remove their calendar feed token"
  on public.calendar_feed_tokens for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.calendar_feed_tokens is
  'Revocable bearer tokens for calendar clients that cannot use a ClubOS login session.';
