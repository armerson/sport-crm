-- Add primary_color to club_settings for white-label branding.
-- Stored as a hex string (e.g. '#123524'). Falls back to the default green in the app.

alter table public.club_settings
  add column if not exists primary_color text default '#123524';
