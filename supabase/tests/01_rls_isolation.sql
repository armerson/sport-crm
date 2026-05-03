-- ============================================================
-- ClubOS RLS Isolation Tests (pgTAP)
-- ============================================================
-- Prereq: run supabase/seed.sql first.
-- Run in the Supabase SQL editor (service_role / postgres).
--
-- Strategy:
--   We stay as the postgres/service_role superuser but impersonate
--   each test account by setting request.jwt.claims via set_config().
--   auth.uid() reads from that claim, so every RLS policy fires as
--   if the named user were the authenticated caller.
--
--   After each group we update the claim to switch "user".
--   All SELECT queries are run with SET LOCAL row_security = on so
--   policies are enforced even for the superuser role.
--
-- Usage:
--   Paste into Supabase SQL Editor → Run
--   All lines beginning with "ok" / "not ok" are pgTAP output.
--   Final line: "1..N" — all N tests passed if no "not ok" lines.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

-- ── Fixed UUIDs (mirrors seed.sql) ───────────────────────────────
DO $$ BEGIN
  PERFORM set_config('qa.u10_id',     '00000000-1000-0000-0000-000000000001', true);
  PERFORM set_config('qa.u14_id',     '00000000-1000-0000-0000-000000000002', true);
  PERFORM set_config('qa.senior_id',  '00000000-1000-0000-0000-000000000003', true);
  PERFORM set_config('qa.admin_id',   '00000000-2000-0000-0000-000000000001', true);
  PERFORM set_config('qa.coach_a_id', '00000000-2000-0000-0000-000000000002', true);
  PERFORM set_config('qa.coach_b_id', '00000000-2000-0000-0000-000000000003', true);
  PERFORM set_config('qa.par_a_id',   '00000000-2000-0000-0000-000000000004', true);
  PERFORM set_config('qa.par_b_id',   '00000000-2000-0000-0000-000000000005', true);
  PERFORM set_config('qa.player_id',  '00000000-2000-0000-0000-000000000006', true);
  PERFORM set_config('qa.pending_id', '00000000-2000-0000-0000-000000000007', true);
  PERFORM set_config('qa.child_a_id', '00000000-3000-0000-0000-000000000001', true);
  PERFORM set_config('qa.child_b_id', '00000000-3000-0000-0000-000000000002', true);
  PERFORM set_config('qa.player_row_id','00000000-3000-0000-0000-000000000003', true);
END $$;

-- Helper: switch the "logged-in" user without changing DB role
CREATE OR REPLACE FUNCTION qa_become(p_user_id uuid)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true  -- is_local = true → scoped to transaction
  );
$$;

-- Enable RLS for this session even as superuser
SET LOCAL row_security = on;

-- Count: 7 groups × ~4 tests each + extras = 30
SELECT plan(30);

-- ════════════════════════════════════════════════════════════════
-- GROUP 1: ADMIN  — sees everything
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM public.teams WHERE name LIKE 'QA -%'),
  3,
  'Admin sees all 3 QA teams'
);

SELECT is(
  (SELECT count(*)::int FROM public.players WHERE name LIKE 'QA -%'),
  4,
  'Admin sees all 4 QA players (including pending)'
);

SELECT is(
  (SELECT count(*)::int FROM public.events WHERE title LIKE 'QA -%'),
  9,
  'Admin sees all 9 QA events (future training + match + past × 3 teams)'
);

SELECT is(
  (SELECT count(*)::int FROM public.messages WHERE content LIKE 'QA -%'),
  4,
  'Admin sees all 4 QA messages (1 club-wide + 3 team)'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-2000-0000-0000-000000000007'::uuid  -- Pending user
      AND name LIKE 'QA -%'
  ),
  'Admin can read the pending user profile'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 2: COACH A  — U10 only
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.teams WHERE name LIKE 'QA -%'),
  1,
  'Coach A sees exactly 1 QA team'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000001'::uuid),
  'Coach A can see QA - Test U10'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000002'::uuid),
  'Coach A cannot see QA - Test U14'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000003'::uuid),
  'Coach A cannot see QA - Test Seniors'
);

SELECT is(
  (SELECT count(*)::int
   FROM public.players p
   JOIN public.player_teams pt ON pt.player_id = p.id
   WHERE p.name LIKE 'QA -%'),
  1,
  'Coach A sees only 1 QA player (Child A in U10)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000002'::uuid
  ),
  'Coach A cannot see Child B (U14 player)'
);

SELECT is(
  (SELECT count(*)::int FROM public.events WHERE title LIKE 'QA -%'),
  3,
  'Coach A sees 3 QA events (U10 training + match + past)'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 3: COACH B  — U14 only
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000003');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000001'::uuid),
  'Coach B cannot see QA - Test U10'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000002'::uuid),
  'Coach B can see QA - Test U14'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000001'::uuid
  ),
  'Coach B cannot see Child A (U10 player)'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000002'::uuid
  ),
  'Coach B can see Child B (U14 player)'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 4: PARENT A  — Child A only
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000004');

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000001'::uuid
  ),
  'Parent A can see their own child (Child A)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000002'::uuid
  ),
  'Parent A cannot see Child B (belongs to Parent B)'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000001'::uuid
  ),
  'Parent A can see QA - Test U10 (via child link)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000002'::uuid
  ),
  'Parent A cannot see QA - Test U14'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 5: PARENT B  — Child B only
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000005');

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000001'::uuid
  ),
  'Parent B cannot see Child A'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000002'::uuid
  ),
  'Parent B can see their own child (Child B)'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 6: PLAYER 18+  — own row + Seniors team
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000006');

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000003'::uuid
  ),
  'Player 18+ can see their own player row (linked_player_id)'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000003'::uuid
  ),
  'Player 18+ can see QA - Test Seniors (their team)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000001'::uuid
  ),
  'Player 18+ cannot see Child A (unrelated junior player)'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 7: PENDING USER  — no team access yet
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000007');

SELECT is(
  (SELECT count(*)::int FROM public.teams WHERE name LIKE 'QA -%'),
  0,
  'Pending user sees 0 teams (no player or team link yet)'
);

SELECT is(
  (SELECT count(*)::int FROM public.players WHERE name LIKE 'QA -%'),
  0,
  'Pending user sees 0 players'
);

SELECT is(
  (SELECT count(*)::int FROM public.events WHERE title LIKE 'QA -%'),
  0,
  'Pending user sees 0 events'
);

-- ── Wrap up ───────────────────────────────────────────────────────
SELECT * FROM finish();

ROLLBACK;  -- leave no side-effects
