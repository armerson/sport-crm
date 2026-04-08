-- ─────────────────────────────────────────────
-- Event comments (coaches and parents can discuss events)
-- ─────────────────────────────────────────────

create table if not exists public.event_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null check (char_length(body) > 0 and char_length(body) <= 1000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists event_comments_event_id_idx on public.event_comments(event_id);

alter table public.event_comments enable row level security;

-- Any authenticated user who can see the event can read its comments
drop policy if exists "authenticated read event comments" on public.event_comments;
create policy "authenticated read event comments"
  on public.event_comments for select
  to authenticated
  using (true);

-- Authenticated users can post comments (author_id must be their own profile)
drop policy if exists "authenticated insert event comment" on public.event_comments;
create policy "authenticated insert event comment"
  on public.event_comments for insert
  to authenticated
  with check (author_id = auth.uid());

-- Author or admin can delete
drop policy if exists "author or admin delete event comment" on public.event_comments;
create policy "author or admin delete event comment"
  on public.event_comments for delete
  to authenticated
  using (public.is_admin() or author_id = auth.uid());

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.event_comments;
exception when duplicate_object then null;
end $$;
