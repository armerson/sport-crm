# Changelog

## Unreleased — Cross-club session test (`claude/club-isolation-test`)

### Added
- `scripts/test-club-isolation.mjs` (`npm run test:isolation`, also run at the
  end of `npm run test:db`). Signs in a throwaway user on the local stack, then
  replays the same session claims signed with another club's keys (HS256 secret,
  ES256 key with the same key id) and unsigned. API reads and writes, auth and
  storage must all refuse them; the backend's own session must still work.
  Deletes its user afterwards and refuses to run against a hosted URL.
- Verified the test fails when the keys are shared: storage accepted a token
  re-signed with the local stack's own secret.

### Notes
- Local Supabase stacks share the published default JWT secret, so they are not
  isolated from each other. Hosted projects have their own keys.
- Phase 1 roadmap items are marked done.

### Rollback
Revert the branch. Test and documentation only; no app or database change.

## Unreleased — Restore match stats and guard camp payment links (`claude/restore-match-stats`)

### Fixed
- `player_match_stats` was missing on the Ambassadors live database (removed
  outside the migration history), so coaches could not save goals, assists or
  cards and the season Stats tab was empty. Migration
  `20261127120000_restore_player_match_stats.sql` recreates it where missing.
- Privacy: the table's original read policy let anyone, including signed-out
  visitors, read children's match stats. Reading is now limited to signed-in
  people who can see the team (admins, its coaches, parents and linked players
  of its squad). Writing is limited to admins and the team's coaches; a coach
  can only record players in their squad, for that team's own matches.
- "Copy guest pay link" (Admin > Billing) and `/pay/camp` no longer offer a
  payment that cannot work. Guest checkout is off unless
  `VITE_GUEST_CHECKOUT_ENABLED=true`; the page asks visitors to contact the club.

### Tests
- `supabase/tests/player_match_stats_access.sql`: anonymous, parent, unrelated
  parent, coach and admin access, the app's upsert, and a check that no open
  read policy returns. Verified it fails against the old policy and that the
  migration works on a database without the table, run twice.
- Unit test for the guest checkout switch; browser test for the camp page.

### Not changed
- Live database: not modified. Guest checkout table and Edge Function are not
  created or deployed; that needs Stripe test-mode verification first.

### Applying to live (needs owner approval)
Do not run `supabase db push`: the live migration history uses different
version numbers and the project is shared with other tools. Apply only this
file, e.g. `supabase db query --linked -f supabase/migrations/20261127120000_restore_player_match_stats.sql`,
then record it with `supabase migration repair --status applied 20261127120000`.

### Limitations
- Any stats that existed before the table was removed on live are not recovered.
- The Stats tab still hides load errors silently.

### Rollback
Code: revert the branch. Database: the migration only creates the table and
replaces its policies; to undo on a database that lacked it,
`drop table public.player_match_stats;` (deletes stats recorded since).

## Unreleased — ClubOS Phase 1 foundation (`claude/clubos-phase1-foundation`)

Builds on PR #30 (`codex/multi-club-foundation`).

### Added
- Operator-managed club registry with strict validation (`src/clubos/registry.ts`):
  backend, branding, location, sport, status, plan and feature overrides.
  Rejects service-role/secret keys, unapproved hosts, mismatched project keys,
  and clubs sharing a code, origin or backend.
- `VITE_CLUBOS_MODE`: `standalone` (default), `directory`, `multi`.
- Multi-club mode: members choose a club and the app connects to that club's
  own backend, with per-club auth storage and cache namespaces.
- Club finder at `/clubs`: search by name, code or town; continue to last club.
- Club links `/clubs/<code>/...` for sign-in, registration, forms, invitations,
  camp payment and password reset, with a strict route allow-list.
- Configurable plan catalogue and feature entitlements (`src/clubos/plans.ts`).
- Club-scoped UI preferences (`readClubPreference` / `writeClubPreference`):
  message drafts, unread markers, the push-notification banner and the admin
  onboarding checklist no longer leak between clubs in multi mode. A guard
  test fails if new code uses browser storage directly.
- Docs: AGENTS.md, ARCHITECTURE.md, ADR 0001, SECURITY.md, roadmaps.
- Tests: 21 new unit tests (replacing PR #30's 3; 53 in total) and 3 new browser
  tests run on desktop and mobile.

### Changed
- Push notification and calendar feed URLs come from the active Supabase client
  instead of reading build env directly.
- Invitation, registration, form, camp-payment, email-confirmation and
  password-reset links include the club in multi mode. Unchanged in standalone.
- `.env.example` points at a local Supabase stack instead of the live
  Ambassadors backend.
- PR #30's directory parser is replaced by the registry (old entries still
  parse). Its website starter moved to `src/utils/publicClubSite.ts`.

### Not changed
- No database migrations, no production configuration, no billing changes.
- Standalone deployments keep the same backend, storage keys and links.

### Limitations
- Registry is build-time JSON; the control-plane service is Phase 2.
- The "install app" banner dismissal stays device-wide by design.
- Feature entitlements are not yet used to hide features.
- Migration chain not yet replayed on a fresh Supabase project.

### Rollback
Unset `VITE_CLUBOS_MODE` or set it to `standalone`, or revert the branch. No
data migration is involved.
