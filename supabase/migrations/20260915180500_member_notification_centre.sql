create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 2000),
  url text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint member_notifications_url_check check (url ~ '^/[^/]' or url = '/')
);

create index if not exists member_notifications_user_created_idx
  on public.member_notifications (user_id, created_at desc);
create index if not exists member_notifications_user_unread_idx
  on public.member_notifications (user_id, created_at desc) where read_at is null;

alter table public.member_notifications enable row level security;

create policy "Members read their notifications"
  on public.member_notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Members update their notifications"
  on public.member_notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Members delete their notifications"
  on public.member_notifications for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.member_notifications is
  'Private in-app history of announcements and alerts sent to each member.';
