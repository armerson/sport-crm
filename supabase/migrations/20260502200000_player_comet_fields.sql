-- Additional fields needed for IFA COMET player registration
alter table public.players
  add column if not exists passport_number  text default null,
  add column if not exists country_of_birth text default null,
  add column if not exists national_id      text default null,
  add column if not exists gender           text default null,
  add column if not exists father_name      text default null,
  add column if not exists mother_name      text default null;
