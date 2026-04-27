-- Add focal point columns to teams so admins can reposition team photos
alter table public.teams
  add column if not exists photo_focus_x integer default 50 check (photo_focus_x between 0 and 100),
  add column if not exists photo_focus_y integer default 50 check (photo_focus_y between 0 and 100);
