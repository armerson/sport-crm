-- Enable realtime for core tables that were missing from the publication.
-- Uses DO blocks to skip tables already added (idempotent).

do $$ begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.team_coaches;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.player_teams;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.player_parents;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.attendance;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
