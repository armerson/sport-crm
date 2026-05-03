-- ============================================================
-- ClubOS QA Seed — fake club dataset for end-to-end testing
-- ============================================================
-- All rows use fixed UUIDs so the script is idempotent.
-- Every name is prefixed "QA -" for easy filtering / cleanup.
-- Password for every test account: Test@clubos1
--
-- UUID layout  (type digit in position 5)
--   Teams     00000000-1000-0000-0000-0000000000{nn}
--   Profiles  00000000-2000-0000-0000-0000000000{nn}
--   Players   00000000-3000-0000-0000-0000000000{nn}
--   Events    00000000-4000-0000-0000-0000000000{nn}
--   Messages  00000000-5000-0000-0000-0000000000{nn}
--   Invites   00000000-6000-0000-0000-0000000000{nn}
--
-- Run this in the Supabase SQL editor (service_role / postgres).
-- Re-running is safe — all inserts use ON CONFLICT DO NOTHING.
-- To remove everything: run supabase/tests/00_qa_teardown.sql
-- ============================================================

-- ── 0. Extension ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Auth users ────────────────────────────────────────────────
-- Supabase stores BCrypt hashes in encrypted_password.
-- We derive the hash inline so no pre-computed constant is needed.

DO $$
DECLARE
  pw text := crypt('Test@clubos1', gen_salt('bf', 10));
  users record;
BEGIN
  FOR users IN SELECT * FROM (VALUES
    ('00000000-2000-0000-0000-000000000001'::uuid, 'admin.test@clubos.test',   'QA - Admin'),
    ('00000000-2000-0000-0000-000000000002'::uuid, 'coach.a.test@clubos.test', 'QA - Coach A'),
    ('00000000-2000-0000-0000-000000000003'::uuid, 'coach.b.test@clubos.test', 'QA - Coach B'),
    ('00000000-2000-0000-0000-000000000004'::uuid, 'parent.a.test@clubos.test','QA - Parent A'),
    ('00000000-2000-0000-0000-000000000005'::uuid, 'parent.b.test@clubos.test','QA - Parent B'),
    ('00000000-2000-0000-0000-000000000006'::uuid, 'player.test@clubos.test',  'QA - Player'),
    ('00000000-2000-0000-0000-000000000007'::uuid, 'pending.test@clubos.test', 'QA - Pending')
  ) AS t(id, email, name)
  LOOP
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      users.id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      users.email, pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', users.name),
      now(), now()
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ── 2. Profiles ──────────────────────────────────────────────────
INSERT INTO public.profiles (id, name, email, roles) VALUES
  ('00000000-2000-0000-0000-000000000001', 'QA - Admin',    'admin.test@clubos.test',    ARRAY['admin']),
  ('00000000-2000-0000-0000-000000000002', 'QA - Coach A',  'coach.a.test@clubos.test',  ARRAY['coach']),
  ('00000000-2000-0000-0000-000000000003', 'QA - Coach B',  'coach.b.test@clubos.test',  ARRAY['coach']),
  ('00000000-2000-0000-0000-000000000004', 'QA - Parent A', 'parent.a.test@clubos.test', ARRAY['parent']),
  ('00000000-2000-0000-0000-000000000005', 'QA - Parent B', 'parent.b.test@clubos.test', ARRAY['parent']),
  ('00000000-2000-0000-0000-000000000006', 'QA - Player',   'player.test@clubos.test',   ARRAY['player']),
  ('00000000-2000-0000-0000-000000000007', 'QA - Pending',  'pending.test@clubos.test',  ARRAY['parent'])
ON CONFLICT (id) DO NOTHING;

-- ── 3. Teams ─────────────────────────────────────────────────────
INSERT INTO public.teams (id, name, age_group, is_senior) VALUES
  ('00000000-1000-0000-0000-000000000001', 'QA - Test U10',     'U10', false),
  ('00000000-1000-0000-0000-000000000002', 'QA - Test U14',     'U14', false),
  ('00000000-1000-0000-0000-000000000003', 'QA - Test Seniors', 'Senior', true)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Players ───────────────────────────────────────────────────
-- Child A (under 18, in U10)
INSERT INTO public.players (id, name, dob, status) VALUES
  ('00000000-3000-0000-0000-000000000001', 'QA - Child A',   '2016-03-15', 'active'),
  ('00000000-3000-0000-0000-000000000002', 'QA - Child B',   '2012-07-22', 'active'),
  ('00000000-3000-0000-0000-000000000003', 'QA - Player 18+','2000-01-10', 'active'),
  ('00000000-3000-0000-0000-000000000004', 'QA - Pending Player','2014-06-05', 'pending')
ON CONFLICT (id) DO NOTHING;

-- Link Player 18+ auth profile → player row
UPDATE public.profiles
SET linked_player_id = '00000000-3000-0000-0000-000000000003'
WHERE id = '00000000-2000-0000-0000-000000000006'
  AND linked_player_id IS NULL;

-- ── 5. Relationships ─────────────────────────────────────────────

-- Coach → team assignments
INSERT INTO public.team_coaches (team_id, coach_id) VALUES
  ('00000000-1000-0000-0000-000000000001', '00000000-2000-0000-0000-000000000002'), -- Coach A → U10
  ('00000000-1000-0000-0000-000000000002', '00000000-2000-0000-0000-000000000003')  -- Coach B → U14
ON CONFLICT DO NOTHING;

-- Player → team assignments
INSERT INTO public.player_teams (player_id, team_id) VALUES
  ('00000000-3000-0000-0000-000000000001', '00000000-1000-0000-0000-000000000001'), -- Child A → U10
  ('00000000-3000-0000-0000-000000000002', '00000000-1000-0000-0000-000000000002'), -- Child B → U14
  ('00000000-3000-0000-0000-000000000003', '00000000-1000-0000-0000-000000000003')  -- Player 18+ → Seniors
ON CONFLICT DO NOTHING;

-- Parent → player links
INSERT INTO public.player_parents (player_id, parent_id) VALUES
  ('00000000-3000-0000-0000-000000000001', '00000000-2000-0000-0000-000000000004'), -- Parent A → Child A
  ('00000000-3000-0000-0000-000000000002', '00000000-2000-0000-0000-000000000005')  -- Parent B → Child B
ON CONFLICT DO NOTHING;

-- QA - Pending has no player_parents row → triggers "waiting" state in app

-- ── 6. Events ────────────────────────────────────────────────────
-- Future training × 3 teams
INSERT INTO public.events (id, team_id, title, type, date_time, location) VALUES
  ('00000000-4000-0000-0000-000000000001',
   '00000000-1000-0000-0000-000000000001',
   'QA - U10 Training', 'training',
   (now() + interval '7 days')::timestamptz, 'QA Training Ground, Pitch 1'),

  ('00000000-4000-0000-0000-000000000002',
   '00000000-1000-0000-0000-000000000002',
   'QA - U14 Training', 'training',
   (now() + interval '7 days')::timestamptz, 'QA Training Ground, Pitch 2'),

  ('00000000-4000-0000-0000-000000000003',
   '00000000-1000-0000-0000-000000000003',
   'QA - Seniors Training', 'training',
   (now() + interval '7 days')::timestamptz, 'QA Main Stadium')
ON CONFLICT (id) DO NOTHING;

-- Future match × 3 teams
INSERT INTO public.events (id, team_id, title, type, date_time, location, opponent) VALUES
  ('00000000-4000-0000-0000-000000000004',
   '00000000-1000-0000-0000-000000000001',
   'QA - U10 vs Riverside', 'match',
   (now() + interval '14 days')::timestamptz, 'QA Stadium — Away', 'QA Riverside FC'),

  ('00000000-4000-0000-0000-000000000005',
   '00000000-1000-0000-0000-000000000002',
   'QA - U14 vs Northside', 'match',
   (now() + interval '14 days')::timestamptz, 'QA Stadium — Home', 'QA Northside United'),

  ('00000000-4000-0000-0000-000000000006',
   '00000000-1000-0000-0000-000000000003',
   'QA - Seniors vs City', 'match',
   (now() + interval '14 days')::timestamptz, 'QA City Ground', 'QA City Athletic')
ON CONFLICT (id) DO NOTHING;

-- Past events (one per team, with attendance)
INSERT INTO public.events (id, team_id, title, type, date_time, location) VALUES
  ('00000000-4000-0000-0000-000000000007',
   '00000000-1000-0000-0000-000000000001',
   'QA - U10 Past Training', 'training',
   (now() - interval '7 days')::timestamptz, 'QA Training Ground, Pitch 1'),

  ('00000000-4000-0000-0000-000000000008',
   '00000000-1000-0000-0000-000000000002',
   'QA - U14 Past Training', 'training',
   (now() - interval '7 days')::timestamptz, 'QA Training Ground, Pitch 2'),

  ('00000000-4000-0000-0000-000000000009',
   '00000000-1000-0000-0000-000000000003',
   'QA - Seniors Past Training', 'training',
   (now() - interval '7 days')::timestamptz, 'QA Main Stadium')
ON CONFLICT (id) DO NOTHING;

-- ── 7. Attendance for past events ────────────────────────────────
INSERT INTO public.attendance (event_id, player_id, status) VALUES
  -- Child A attended U10 past training
  ('00000000-4000-0000-0000-000000000007', '00000000-3000-0000-0000-000000000001', 'yes'),
  -- Child B attended U14 past training
  ('00000000-4000-0000-0000-000000000008', '00000000-3000-0000-0000-000000000002', 'yes'),
  -- Player 18+ attended Seniors past training
  ('00000000-4000-0000-0000-000000000009', '00000000-3000-0000-0000-000000000003', 'yes')
ON CONFLICT (event_id, player_id) DO NOTHING;

-- ── 8. Messages ──────────────────────────────────────────────────
-- Club-wide broadcast (team_id = NULL, group_id = NULL)
INSERT INTO public.messages (id, team_id, sender_id, content) VALUES
  ('00000000-5000-0000-0000-000000000001',
   NULL,
   '00000000-2000-0000-0000-000000000001',
   'QA - Welcome to the club! This is a test club-wide announcement from Admin.')
ON CONFLICT (id) DO NOTHING;

-- Team-scoped messages
INSERT INTO public.messages (id, team_id, sender_id, content) VALUES
  ('00000000-5000-0000-0000-000000000002',
   '00000000-1000-0000-0000-000000000001',
   '00000000-2000-0000-0000-000000000002',
   'QA - U10 team message from Coach A. Training confirmed for Friday.'),

  ('00000000-5000-0000-0000-000000000003',
   '00000000-1000-0000-0000-000000000002',
   '00000000-2000-0000-0000-000000000003',
   'QA - U14 team message from Coach B. Please bring water bottles.'),

  ('00000000-5000-0000-0000-000000000004',
   '00000000-1000-0000-0000-000000000003',
   '00000000-2000-0000-0000-000000000006',
   'QA - Seniors message from Player. See you all on Saturday.')
ON CONFLICT (id) DO NOTHING;

-- ── 9. Invites ───────────────────────────────────────────────────
-- Club-level coach invite
INSERT INTO public.club_invites (id, code, role, created_by, active) VALUES
  ('00000000-6000-0000-0000-000000000001', 'QACOACH01', 'coach',
   '00000000-2000-0000-0000-000000000001', true)
ON CONFLICT (id) DO NOTHING;

-- Team-level parent invite for U10
INSERT INTO public.team_invites (id, code, team_id, role, created_by, active)
SELECT
  '00000000-6000-0000-0000-000000000002',
  'QAPAR001',
  '00000000-1000-0000-0000-000000000001',
  'parent',
  '00000000-2000-0000-0000-000000000001',
  true
WHERE EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ── Done ─────────────────────────────────────────────────────────
-- Verify summary
SELECT
  (SELECT count(*) FROM public.teams       WHERE name LIKE 'QA -%') AS qa_teams,
  (SELECT count(*) FROM public.profiles    WHERE name LIKE 'QA -%') AS qa_profiles,
  (SELECT count(*) FROM public.players     WHERE name LIKE 'QA -%') AS qa_players,
  (SELECT count(*) FROM public.events      WHERE title LIKE 'QA -%') AS qa_events,
  (SELECT count(*) FROM public.messages    WHERE content LIKE 'QA -%') AS qa_messages,
  (SELECT count(*) FROM public.attendance  WHERE event_id LIKE '00000000-4000%') AS qa_attendance;
