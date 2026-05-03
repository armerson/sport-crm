-- ============================================================
-- ClubOS RLS Isolation Tests (pgTAP)
-- ============================================================
-- Prereq: run supabase/seed.sql first.
-- Run in the Supabase SQL editor (service_role / postgres).
--
-- Strategy:
--   1. Create helper + extension as superuser (before role switch).
--   2. SET LOCAL ROLE authenticated — RLS now fires for every query.
--   3. Between user groups, call qa_become() to change the JWT sub.
--      auth.uid() reads from request.jwt.claims, so RLS treats each
--      subsequent query as that specific user.
--   4. Everything is wrapped in a transaction that we ROLLBACK at the
--      end, so no side-effects survive the test run.
-- ============================================================

BEGIN;

-- Must be created as superuser (before role switch)
CREATE EXTENSION IF NOT EXISTS pgtap;

CREATE OR REPLACE FUNCTION qa_become(p_user_id uuid)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true   -- is_local: scoped to this transaction
  );
$$;

-- ── Switch to authenticated role — RLS now enforces on every query ──
SET LOCAL ROLE authenticated;

SELECT plan(28);

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
  'Admin sees all 9 QA events'
);

SELECT is(
  (SELECT count(*)::int FROM public.messages WHERE content LIKE 'QA -%'),
  4,
  'Admin sees all 4 QA messages (1 club-wide + 3 team)'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-2000-0000-0000-000000000007'::uuid
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
  (SELECT count(*)::int FROM public.players WHERE name LIKE 'QA -%'),
  1,
  'Coach A sees only 1 QA player (Child A)'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000002'::uuid),
  'Coach A cannot see Child B (U14 player)'
);

SELECT is(
  (SELECT count(*)::int FROM public.events WHERE title LIKE 'QA -%'),
  3,
  'Coach A sees 3 QA events (U10: future training + future match + past)'
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
  NOT EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000001'::uuid),
  'Coach B cannot see Child A (U10 player)'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000002'::uuid),
  'Coach B can see Child B (U14 player)'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 4: PARENT A  — Child A / U10 only
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000004');

SELECT ok(
  EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000001'::uuid),
  'Parent A can see their own child (Child A)'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000002'::uuid),
  'Parent A cannot see Child B (belongs to Parent B)'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000001'::uuid),
  'Parent A can see QA - Test U10 (via child link)'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000002'::uuid),
  'Parent A cannot see QA - Test U14'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 5: PARENT B  — Child B / U14 only
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000005');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000001'::uuid),
  'Parent B cannot see Child A'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000002'::uuid),
  'Parent B can see their own child (Child B)'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 6: PLAYER 18+  — own row + Seniors only
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000006');

SELECT ok(
  EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000003'::uuid),
  'Player 18+ can see their own player row (is_linked_player)'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-1000-0000-0000-000000000003'::uuid),
  'Player 18+ can see QA - Test Seniors (via linked_player_id → player_teams)'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-3000-0000-0000-000000000001'::uuid),
  'Player 18+ cannot see Child A (unrelated junior player)'
);

-- ════════════════════════════════════════════════════════════════
-- GROUP 7: PENDING USER  — no team access yet, sees nothing
-- ════════════════════════════════════════════════════════════════
SELECT qa_become('00000000-2000-0000-0000-000000000007');

SELECT is(
  (SELECT count(*)::int FROM public.teams WHERE name LIKE 'QA -%'),
  0,
  'Pending user sees 0 teams (no player or team link)'
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

-- ── Finish ────────────────────────────────────────────────────────
SELECT * FROM finish();

ROLLBACK;
