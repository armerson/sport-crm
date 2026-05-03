-- ============================================================
-- QA Teardown — removes all seed rows created by seed.sql
-- Run in Supabase SQL editor (service_role / postgres).
-- Safe to run multiple times.
-- ============================================================

-- Order matters: children before parents (FK constraints)

-- Attendance for QA events
DELETE FROM public.attendance
WHERE event_id IN (
  SELECT id FROM public.events WHERE title LIKE 'QA -%'
);

-- Messages
DELETE FROM public.messages  WHERE content LIKE 'QA -%';

-- Events
DELETE FROM public.events    WHERE title LIKE 'QA -%';

-- Invites
DELETE FROM public.team_invites  WHERE code LIKE 'QA%';
DELETE FROM public.club_invites  WHERE code LIKE 'QA%';

-- Player relationships
DELETE FROM public.player_parents
WHERE player_id IN (SELECT id FROM public.players WHERE name LIKE 'QA -%');

DELETE FROM public.player_teams
WHERE player_id IN (SELECT id FROM public.players WHERE name LIKE 'QA -%');

-- Coach → team assignments for QA teams
DELETE FROM public.team_coaches
WHERE team_id IN (SELECT id FROM public.teams WHERE name LIKE 'QA -%');

-- Unlink player profile before deleting player row
UPDATE public.profiles
SET linked_player_id = NULL
WHERE name LIKE 'QA -%';

-- Players
DELETE FROM public.players WHERE name LIKE 'QA -%';

-- Teams
DELETE FROM public.teams   WHERE name LIKE 'QA -%';

-- Profiles (cascade deletes auth.users via FK)
DELETE FROM public.profiles WHERE name LIKE 'QA -%';

-- Auth users that have no matching profile (safety net)
DELETE FROM auth.users
WHERE email LIKE '%@clubos.test';

-- Confirm
SELECT
  (SELECT count(*) FROM public.teams    WHERE name LIKE 'QA -%') AS remaining_teams,
  (SELECT count(*) FROM public.profiles WHERE name LIKE 'QA -%') AS remaining_profiles,
  (SELECT count(*) FROM public.players  WHERE name LIKE 'QA -%') AS remaining_players,
  (SELECT count(*) FROM public.events   WHERE title LIKE 'QA -%') AS remaining_events;
