# ClubOS multi-club roadmap

Architecture: [ARCHITECTURE.md](ARCHITECTURE.md) and
[ADR 0001](docs/adr/0001-club-isolation-model.md). Each club keeps its own
backend; the app chooses one from an operator-managed registry.

## Audit summary (26 November 2026)

What is strong and must be preserved:
- Broad, working club feature set: registration with multiple children, roles
  (admin, coach, parent, player) on one account, teams and archiving, events
  with meet/finish times, attendance and automatic reminders, notification
  centre, team messages, posts, forms, MOTM voting, reviews, performance
  testing, pathways, finance transactions, calendar feeds, COMET sync, Stripe
  checkout/portal/webhook, bulk import, audit log.
- September 2026 RLS repair, with 64 role checks and registration guards.
- CI running lint, unit tests, build and Playwright.

Risks found:

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | `.env.example` contained the live Ambassadors backend URL and key, so a new dev environment or new club copied from it would connect to live member data | High | Fixed: points at local Supabase |
| 2 | Push and calendar code read `VITE_SUPABASE_URL` directly, bypassing the chosen backend | High for multi-club | Fixed: use the single client's URL |
| 3 | Profile, club settings and pending invite codes cached under global browser keys | High for multi-club | Fixed: per-club namespace in multi mode |
| 4 | A large body of work on `main` is uncommitted (about 30 files and 3 migrations: additional child registration, client error monitoring, parent-communication safeguards) and exists only on the USB drive | High (data loss) | **Open: commit to a branch and push** |
| 5 | Full migration chain never replayed on a fresh Supabase project | High before club 2 | Open: Phase 1 next step |
| 6 | Repo-root (untracked) SQL scripts such as `disable_auth_temporarily.sql` and older RLS "fix" scripts can undo the access-control repair if run | Medium | Open: move out of the working tree |
| 7 | Leaked-password protection disabled in Supabase Auth | Medium | Open: enable per club |
| 8 | Stripe checkout/webhook, real push and email delivery not verified end-to-end | Medium | Open: Phase 3 |
| 9 | `club_settings` is a single row and no table has a club column, so the schema is single-club by design | Info | Accepted (ADR 0001) |
| 10 | Several Edge Functions use `verify_jwt=false` and rely on in-function checks | Info | Keep checks; add tests per function |

Review of PR #30 (`codex/multi-club-foundation`): sound, cautious start: strict
HTTPS validation, no user-entered URLs, opt-in website starter, no database
changes. Gaps: the directory could only link to separate deployments (no
in-app club choice for a native app), clubs had no backend, branding, location,
status or plan data, and browser state was not club-scoped. This branch builds
on it, replaces its directory parser with the registry (old entries still
parse), and keeps its website starter.

## Prioritised plan

Ordered by risk reduced per unit of effort.

### Phase 1 — architecture and foundation (in progress)

Done on `claude/clubos-phase1-foundation`:
- [x] ADR and architecture docs; AGENTS.md conventions.
- [x] Validated club registry (backend, branding, location, status, plan, features).
- [x] Modes: standalone (default, unchanged), directory, multi.
- [x] Single Supabase client built from the registry in multi mode, with
      per-club auth storage.
- [x] Per-club browser storage for profile, settings and invite codes.
- [x] Club finder with search by name/code/town and "continue to my club".
- [x] Club links `/clubs/<code>/...` with an allow-list; club-aware invite,
      registration, camp payment, confirmation and reset links.
- [x] Configurable plan catalogue and feature entitlements (not yet gating UI).
- [x] `.env.example` points at local Supabase.
- [x] Unit tests for registry, isolation and entitlements; browser tests for
      finder and club links; manual two-club browser run.

Next:
1. Commit the uncommitted `main` work (finding 4) on its own branch.
2. `supabase start` locally; replay all migrations on an empty database; run
   `supabase/tests`. Fix any migration that fails on a fresh project.
3. Add a SQL test that creates two local club databases (or two schemas in CI)
   and proves a club A token is rejected by club B's API.
4. ~~Scope the remaining UI preferences to the club in multi mode.~~ Done:
   drafts, unread markers, banner dismissals and the coach's selected team
   are club-scoped.
5. Move the dangerous repo-root SQL scripts out of the working tree.

### Phase 2 — multi-club administration
- Control-plane Supabase project: `clubs`, `club_domains`, `club_features`,
  `onboarding_applications`, `platform_admins`, `support_access_log`. Public
  view for the directory; operator-only writes. App fetches it and validates
  with the same registry parser.
- Onboarding form (club name, sport, badge, colours, location, contacts,
  website, age groups/teams, fees, season dates, payment methods, required
  registration fields, website wanted) saved as an application for operator
  review. Provisioning stays manual with a checklist until scripted.
- Platform admin area (operator only): clubs, status, plan, features,
  migration version per club, integration health.
- Provision and validate a second test club on its own backend.
- Season rollover and renewals, waiting lists/trials, team moves, admin
  exception dashboard.

### Phase 3 — payments
Stripe test-mode end-to-end; payment plans (monthly 9/10/12, full season,
standing order, manual); family references; bank CSV import with
de-duplication; reconciliation; unified finance dashboard separating expected,
received, overdue, refunds and fees. A standing order is never "paid" until
reconciled.

### Phase 4 — websites
See [WEBSITE_BUILDER_ROADMAP.md](WEBSITE_BUILDER_ROADMAP.md).

### Phase 5 — media
Port the Graphics Studio workflow: fixtures/results → coach report and photos →
AI caption → branded graphics → admin approval → website/social publishing.

### Phase 6 — native apps
See [MOBILE_APP_ROADMAP.md](MOBILE_APP_ROADMAP.md).

### Phase 7 — commercial readiness
Subscriptions billed from an operator Stripe account (separate from club
Stripe accounts), automated provisioning, support, monitoring, pilot clubs.

## Rollback for Phase 1

Unset `VITE_CLUBOS_MODE` (or set `standalone`). Behaviour, backend, storage keys
and links return to exactly what they were. No database or production changes
were made.
