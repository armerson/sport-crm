-- Add optional photo to teams
alter table public.teams add column if not exists photo_url text;

-- Storage bucket for team photos
insert into storage.buckets (id, name, public)
values ('team-photos', 'team-photos', true)
on conflict (id) do nothing;

-- Anyone authenticated can read team photos (they're public)
create policy "team photos public read"
  on storage.objects for select
  using (bucket_id = 'team-photos');

-- Only admins can upload / update / delete team photos
create policy "admins manage team photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'team-photos' and public.is_admin());

create policy "admins update team photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'team-photos' and public.is_admin());

create policy "admins delete team photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'team-photos' and public.is_admin());
