-- Store the confirmed Man of the Match winner on the match result.
-- Coaches can override the poll result before confirming.

alter table public.results
  add column if not exists motm_winner_id uuid references public.profiles(id) on delete set null;
