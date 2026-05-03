-- ============================================================
-- ClubOS RLS Isolation Tests (pgTAP)
-- ============================================================
-- Prereq: run supabase/seed.sql first.
-- Run in the Supabase SQL editor (service_role / postgres).
--
-- WHY NO SET LOCAL ROLE:
--   The Supabase SQL editor always runs as the postgres superuser,
--   which bypasses RLS regardless of SET LOCAL ROLE.  Instead we:
--
--   Layer 1 — Policy-helper tests:
--     set_config(request.jwt.claims) makes auth.uid() return the
--     target user's UUID.  We then call is_admin(),
--     is_coach_for_team(), is_parent_for_player(), and
--     is_linked_player() directly.  These SECURITY DEFINER functions
--     use auth.uid() internally, so they behave exactly as they
--     would for a real authenticated session.
--
--   Layer 2 — Effective-visibility tests:
--     We inline each table's RLS policy WHERE clause verbatim
--     (with the user's UUID hardcoded) and assert the correct row
--     counts.  If the policy logic is correct AND the helper
--     functions are correct (proven in Layer 1), production RLS
--     will enforce the same results.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

-- Convenience: set the "current user" for all auth.uid() calls
CREATE OR REPLACE FUNCTION qa_as(p_user_id uuid)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
$$;

SELECT plan(38);

-- ── Aliases ──────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM set_config('qa.admin',    '00000000-2000-0000-0000-000000000001', true);
  PERFORM set_config('qa.coach_a',  '00000000-2000-0000-0000-000000000002', true);
  PERFORM set_config('qa.coach_b',  '00000000-2000-0000-0000-000000000003', true);
  PERFORM set_config('qa.par_a',    '00000000-2000-0000-0000-000000000004', true);
  PERFORM set_config('qa.par_b',    '00000000-2000-0000-0000-000000000005', true);
  PERFORM set_config('qa.player',   '00000000-2000-0000-0000-000000000006', true);
  PERFORM set_config('qa.pending',  '00000000-2000-0000-0000-000000000007', true);
  PERFORM set_config('qa.u10',      '00000000-1000-0000-0000-000000000001', true);
  PERFORM set_config('qa.u14',      '00000000-1000-0000-0000-000000000002', true);
  PERFORM set_config('qa.seniors',  '00000000-1000-0000-0000-000000000003', true);
  PERFORM set_config('qa.child_a',  '00000000-3000-0000-0000-000000000001', true);
  PERFORM set_config('qa.child_b',  '00000000-3000-0000-0000-000000000002', true);
  PERFORM set_config('qa.p18',      '00000000-3000-0000-0000-000000000003', true);
END $$;

-- ════════════════════════════════════════════════════════════════
-- SECTION 1: Seed data integrity
-- Verify that seed.sql wired up all the relationships correctly.
-- ════════════════════════════════════════════════════════════════

SELECT ok(
  EXISTS (SELECT 1 FROM public.team_coaches
          WHERE team_id = '00000000-1000-0000-0000-000000000001'
            AND coach_id = '00000000-2000-0000-0000-000000000002'),
  'Seed: Coach A is assigned to U10'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.team_coaches
              WHERE team_id = '00000000-1000-0000-0000-000000000002'
                AND coach_id = '00000000-2000-0000-0000-000000000002'),
  'Seed: Coach A is NOT assigned to U14'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.team_coaches
          WHERE team_id = '00000000-1000-0000-0000-000000000002'
            AND coach_id = '00000000-2000-0000-0000-000000000003'),
  'Seed: Coach B is assigned to U14'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.player_parents
          WHERE player_id = '00000000-3000-0000-0000-000000000001'
            AND parent_id = '00000000-2000-0000-0000-000000000004'),
  'Seed: Parent A is linked to Child A'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.player_parents
          WHERE player_id = '00000000-3000-0000-0000-000000000002'
            AND parent_id = '00000000-2000-0000-0000-000000000005'),
  'Seed: Parent B is linked to Child B'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.profiles
          WHERE id = '00000000-2000-0000-0000-000000000006'
            AND linked_player_id = '00000000-3000-0000-0000-000000000003'),
  'Seed: Player 18+ profile linked to their player row'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.player_parents
              WHERE parent_id = '00000000-2000-0000-0000-000000000007'),
  'Seed: Pending user has no player_parents rows (waiting state)'
);

-- ════════════════════════════════════════════════════════════════
-- SECTION 2: Policy helper functions
-- Call each SECURITY DEFINER helper with auth.uid() faked via
-- set_config so we confirm they read JWT claims correctly.
-- ════════════════════════════════════════════════════════════════

-- ── Admin ──────────────────────────────────────────────────────
SELECT qa_as('00000000-2000-0000-0000-000000000001');

SELECT ok(public.is_admin(),                                                       'Helper: is_admin() → true for Admin');
SELECT ok(NOT public.is_coach_for_team('00000000-1000-0000-0000-000000000001'),    'Helper: is_coach_for_team(U10) → false for Admin');

-- ── Coach A ────────────────────────────────────────────────────
SELECT qa_as('00000000-2000-0000-0000-000000000002');

SELECT ok(NOT public.is_admin(),                                                   'Helper: is_admin() → false for Coach A');
SELECT ok(public.is_coach_for_team('00000000-1000-0000-0000-000000000001'),        'Helper: is_coach_for_team(U10)  → true  for Coach A');
SELECT ok(NOT public.is_coach_for_team('00000000-1000-0000-0000-000000000002'),    'Helper: is_coach_for_team(U14)  → false for Coach A');
SELECT ok(NOT public.is_coach_for_team('00000000-1000-0000-0000-000000000003'),    'Helper: is_coach_for_team(Snrs) → false for Coach A');

-- ── Parent A ───────────────────────────────────────────────────
SELECT qa_as('00000000-2000-0000-0000-000000000004');

SELECT ok(public.is_parent_for_player('00000000-3000-0000-0000-000000000001'),     'Helper: is_parent_for_player(Child A) → true  for Parent A');
SELECT ok(NOT public.is_parent_for_player('00000000-3000-0000-0000-000000000002'), 'Helper: is_parent_for_player(Child B) → false for Parent A');

-- ── Player 18+ ─────────────────────────────────────────────────
SELECT qa_as('00000000-2000-0000-0000-000000000006');

SELECT ok(public.is_linked_player('00000000-3000-0000-0000-000000000003'),         'Helper: is_linked_player(Player row) → true  for Player 18+');
SELECT ok(NOT public.is_linked_player('00000000-3000-0000-0000-000000000001'),     'Helper: is_linked_player(Child A)    → false for Player 18+');

-- ════════════════════════════════════════════════════════════════
-- SECTION 3: Effective visibility — inline RLS policy logic
-- Each query replicates verbatim the WHERE clause from the RLS
-- policy for that table so row counts match what a real session
-- would see.  If the helpers pass (Section 2) AND these counts
-- are correct, production RLS enforces the same results.
-- ════════════════════════════════════════════════════════════════

-- Macro: teams policy WHERE for a given user UUID
-- (mirrors migration 20260407000000_registration_overhaul.sql)
CREATE OR REPLACE FUNCTION qa_visible_teams(uid uuid)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM public.teams t
  WHERE t.name LIKE 'QA -%'
    AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND 'admin' = ANY(roles))
      OR EXISTS (SELECT 1 FROM public.team_coaches   WHERE team_id = t.id AND coach_id = uid)
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 JOIN public.player_parents pp ON pp.player_id = pt.player_id
                 WHERE pt.team_id = t.id AND pp.parent_id = uid)
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 JOIN public.profiles pr ON pr.linked_player_id = pt.player_id
                 WHERE pt.team_id = t.id AND pr.id = uid)
    );
$$;

CREATE OR REPLACE FUNCTION qa_visible_players(uid uuid)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM public.players p
  WHERE p.name LIKE 'QA -%'
    AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND 'admin' = ANY(roles))
      OR EXISTS (SELECT 1 FROM public.player_parents  WHERE player_id = p.id AND parent_id = uid)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND linked_player_id = p.id)
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 JOIN public.team_coaches tc ON tc.team_id = pt.team_id
                 WHERE pt.player_id = p.id AND tc.coach_id = uid)
    );
$$;

CREATE OR REPLACE FUNCTION qa_visible_events(uid uuid)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM public.events e
  WHERE e.title LIKE 'QA -%'
    AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND 'admin' = ANY(roles))
      OR EXISTS (SELECT 1 FROM public.team_coaches   WHERE team_id = e.team_id AND coach_id = uid)
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 JOIN public.player_parents pp ON pp.player_id = pt.player_id
                 WHERE pt.team_id = e.team_id AND pp.parent_id = uid)
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 JOIN public.profiles pr ON pr.linked_player_id = pt.player_id
                 WHERE pt.team_id = e.team_id AND pr.id = uid)
    );
$$;

-- ── Admin ──────────────────────────────────────────────────────
SELECT is(qa_visible_teams ('00000000-2000-0000-0000-000000000001'), 3, 'Visibility: Admin   sees 3 QA teams');
SELECT is(qa_visible_players('00000000-2000-0000-0000-000000000001'), 4, 'Visibility: Admin   sees 4 QA players');
SELECT is(qa_visible_events ('00000000-2000-0000-0000-000000000001'), 9, 'Visibility: Admin   sees 9 QA events');

-- ── Coach A ────────────────────────────────────────────────────
SELECT is(qa_visible_teams ('00000000-2000-0000-0000-000000000002'), 1, 'Visibility: Coach A sees 1 QA team  (U10 only)');
SELECT is(qa_visible_players('00000000-2000-0000-0000-000000000002'), 1, 'Visibility: Coach A sees 1 QA player (Child A)');
SELECT is(qa_visible_events ('00000000-2000-0000-0000-000000000002'), 3, 'Visibility: Coach A sees 3 QA events (U10)');

-- ── Coach B ────────────────────────────────────────────────────
SELECT is(qa_visible_teams ('00000000-2000-0000-0000-000000000003'), 1, 'Visibility: Coach B sees 1 QA team  (U14 only)');
SELECT is(qa_visible_players('00000000-2000-0000-0000-000000000003'), 1, 'Visibility: Coach B sees 1 QA player (Child B)');
SELECT is(qa_visible_events ('00000000-2000-0000-0000-000000000003'), 3, 'Visibility: Coach B sees 3 QA events (U14)');

-- ── Parent A ───────────────────────────────────────────────────
SELECT is(qa_visible_teams ('00000000-2000-0000-0000-000000000004'), 1, 'Visibility: ParentA sees 1 QA team  (U10)');
SELECT is(qa_visible_players('00000000-2000-0000-0000-000000000004'), 1, 'Visibility: ParentA sees 1 QA player (Child A)');
SELECT is(qa_visible_events ('00000000-2000-0000-0000-000000000004'), 3, 'Visibility: ParentA sees 3 QA events (U10)');

-- ── Parent B ───────────────────────────────────────────────────
SELECT is(qa_visible_teams ('00000000-2000-0000-0000-000000000005'), 1, 'Visibility: ParentB sees 1 QA team  (U14)');
SELECT is(qa_visible_players('00000000-2000-0000-0000-000000000005'), 1, 'Visibility: ParentB sees 1 QA player (Child B)');

-- ── Player 18+ ─────────────────────────────────────────────────
SELECT is(qa_visible_teams ('00000000-2000-0000-0000-000000000006'), 1, 'Visibility: Player  sees 1 QA team  (Seniors)');
SELECT is(qa_visible_players('00000000-2000-0000-0000-000000000006'), 1, 'Visibility: Player  sees 1 QA player (own row)');
SELECT is(qa_visible_events ('00000000-2000-0000-0000-000000000006'), 3, 'Visibility: Player  sees 3 QA events (Seniors)');

-- ── Pending ────────────────────────────────────────────────────
SELECT is(qa_visible_teams ('00000000-2000-0000-0000-000000000007'), 0, 'Visibility: Pending sees 0 QA teams');
SELECT is(qa_visible_players('00000000-2000-0000-0000-000000000007'), 0, 'Visibility: Pending sees 0 QA players');
SELECT is(qa_visible_events ('00000000-2000-0000-0000-000000000007'), 0, 'Visibility: Pending sees 0 QA events');

-- ── Wrap up ───────────────────────────────────────────────────────
SELECT * FROM finish();

ROLLBACK;
