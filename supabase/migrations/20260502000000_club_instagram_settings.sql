-- Add Instagram caption defaults to club_settings.
-- instagram_tagline : short phrase appended to generated captions (e.g. "Up the Rovers!")
-- instagram_hashtags: space-separated hashtags (e.g. "#COYB #GrassrootsFootball")

alter table public.club_settings
  add column if not exists instagram_tagline  text default null,
  add column if not exists instagram_hashtags text default null;
