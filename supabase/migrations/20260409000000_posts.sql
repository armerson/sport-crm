-- ─────────────────────────────────────────────
-- Posts (club noticeboard)
-- ─────────────────────────────────────────────

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references public.profiles(id) on delete set null,
  title      text,
  body       text not null,
  image_url  text,
  team_id    uuid references public.teams(id) on delete cascade,  -- null = club-wide
  pinned     boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- ─────────────────────────────────────────────
-- Storage bucket for post images
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "authenticated upload post images" on storage.objects;
create policy "authenticated upload post images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images');

drop policy if exists "anyone view post images" on storage.objects;
create policy "anyone view post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

drop policy if exists "admins delete post images" on storage.objects;
create policy "admins delete post images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images' and public.is_admin());

-- ─────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────

alter table public.posts          enable row level security;
alter table public.post_likes     enable row level security;
alter table public.post_comments  enable row level security;

-- Posts: everyone authenticated can read; only admins can write
drop policy if exists "authenticated read posts" on public.posts;
create policy "authenticated read posts"
  on public.posts for select
  to authenticated
  using (true);

drop policy if exists "admins manage posts" on public.posts;
create policy "admins manage posts"
  on public.posts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Likes: anyone authenticated can like; own likes only
drop policy if exists "authenticated read post likes" on public.post_likes;
create policy "authenticated read post likes"
  on public.post_likes for select
  to authenticated
  using (true);

drop policy if exists "authenticated insert own like" on public.post_likes;
create policy "authenticated insert own like"
  on public.post_likes for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "authenticated delete own like" on public.post_likes;
create policy "authenticated delete own like"
  on public.post_likes for delete
  to authenticated
  using (profile_id = auth.uid());

-- Comments: anyone authenticated can read/create; author or admin can delete
drop policy if exists "authenticated read post comments" on public.post_comments;
create policy "authenticated read post comments"
  on public.post_comments for select
  to authenticated
  using (true);

drop policy if exists "authenticated insert post comment" on public.post_comments;
create policy "authenticated insert post comment"
  on public.post_comments for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "author or admin delete comment" on public.post_comments;
create policy "author or admin delete comment"
  on public.post_comments for delete
  to authenticated
  using (public.is_admin() or author_id = auth.uid());

-- ─────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────

do $$ begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.post_likes;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.post_comments;
exception when duplicate_object then null;
end $$;
