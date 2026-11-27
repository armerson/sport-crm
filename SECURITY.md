# ClubOS security model

ClubOS handles children's personal data, safeguarding information, family
contact details and payments. Security requirements here override convenience.
Evidence from the September 2026 access-control repair is in
[SECURITY_RELEASE_BLOCKERS.md](SECURITY_RELEASE_BLOCKERS.md).

## Club isolation

- Each club has its own Supabase project: database, Auth, Storage, secrets and
  Stripe keys ([ADR 0001](docs/adr/0001-club-isolation-model.md)).
- The app's backend comes only from build env (standalone) or the validated,
  operator-managed registry (multi). Never from user input, URLs or deep links.
- The registry rejects service-role and secret keys, non-HTTPS or unapproved
  hosts, keys from a different project than the URL, and shared backends.
- In multi mode, auth tokens, caches and pending invites are stored per club;
  switching club reloads the app.
- Club links only open an allow-list of public routes.

## Within a club

- Row-level security on every exposed table; anonymous access denied except
  public branding and active registration questions.
- Roles (admin, coach, parent, player) are enforced in RLS and in privileged
  functions, never only in the UI. Staff roles are never granted from signup
  metadata.
- Edge Functions with `verify_jwt=false` must validate the caller themselves
  (`auth.getUser`) or a private shared secret, and must keep their tests.
- Service-role keys live only in Supabase secrets. No `VITE_` variable may hold a
  secret: everything prefixed `VITE_` ships to browsers.

## Platform operators

Operators manage clubs, plans and features in the control plane (Phase 2). They
have no standing access to club databases. Support access will require a
reason, be time-limited, be logged in `support_access_log`, and be visible to
the club's administrators. Children's records are out of scope for support
unless the club grants access for a specific request.

## Never

- Disable or loosen RLS to fix a development problem. The untracked repo-root
  scripts that do this must not be run.
- Point a development or preview environment at a live club backend.
- Publish children's names, photos, schedules or registration details to a
  public website or social channel without the club's approval and consent.
- Treat an unverified standing order as a completed payment.
- Enable new live payment flows before a Stripe test-mode end-to-end run.

## Required tests

- `tests/clubIsolation.test.ts`: backend selection, tampered selections, storage
  namespacing, entry-link allow-list, share links.
- `tests/clubRegistry.test.ts`: registry validation including key-role checks.
- `supabase/tests/*.sql`: role permissions for admin, coach, parent, player and
  anonymous users, run in rollback-only transactions.
- `scripts/test-club-isolation.mjs` (`npm run test:isolation`, also run by
  `npm run test:db`): a session's claims re-signed with another club's keys, or
  unsigned, are refused by the API (reads and writes), auth and storage. Local
  stack only; it refuses hosted URLs.
- Local stacks share Supabase's published default JWT secret, so two local
  stacks are not isolated from each other. Hosted projects have their own keys;
  never give two clubs the same project (the registry rejects shared backends).
- Before a second production club: replay all migrations on a fresh project and
  run the SQL suite there.

## Data protection (UK GDPR)

Each club is the data controller for its members. ClubOS is a processor.
Outstanding work, tracked in the roadmap: account deletion and data export in
the app, retention rules per record type, documented backup and restore per
club backend, photography consent recorded per child, and a breach procedure.

## Reporting

Report suspected vulnerabilities privately to the ClubOS operator, not in a
public issue.
