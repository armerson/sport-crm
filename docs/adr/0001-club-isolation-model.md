# ADR 0001: Club isolation model

- Status: Accepted for Phase 1–2. Revisit before the tenth club or before shared logins.
- Date: 26 November 2026

## Context

ClubOS holds children's records, family details, safeguarding information and
payment data for independent clubs. Ambassadors FC runs live on its own Supabase
project. The schema assumes one club per database: `club_settings` is a single
row (`id = 1`), roles live on `profiles.roles`, and RLS policies decide access by
role and team membership with no club column anywhere.

We want one codebase, one iOS app and one Android app serving many clubs.

## Options

### A. Separate backend per club (silo) — current model

Each club has its own Supabase project (database, Auth, Storage, Edge Functions,
secrets, Stripe keys). The app chooses which backend to talk to.

For:
- Strongest isolation. A bug in an RLS policy exposes one club's data to that
  club's own members, never to another club.
- No migration of live Ambassadors data. Zero risk to the existing release.
- Per-club Stripe secrets, VAPID keys, COMET credentials and backups are
  naturally separate.
- A club can be exported, restored, suspended or deleted on its own. Clean UK
  GDPR story: each club is its own data controller with its own processor
  environment.

Against:
- Cost and operations grow per club (a Supabase project each; free tier limits).
- Every migration must be rolled out to every project and verified on each.
- Cross-club features (one login for a parent in two clubs, platform-wide
  reporting) need a separate identity/control-plane service.
- Supabase Auth email templates, redirect allowlists and secrets are configured
  per project.

### B. Shared multi-tenant database (pool)

One database with `club_id` on every row and RLS keyed by club membership.

For: one migration, one deployment, cheap per club, easy cross-club login.
Against: every one of the ~60 migrations and every policy must be rewritten to
add `club_id`; a single policy mistake leaks children's data across clubs;
migrating Ambassadors live data is high-risk; per-club restore becomes hard;
Edge Functions and storage buckets need tenant scoping throughout.

### C. Hybrid

Silo for club data, plus one small operator-owned **control plane** for the
directory, onboarding, subscriptions, feature flags and support audit logs. No
member or child records in the control plane.

## Decision

Adopt **C**, built in steps:

1. **Now (Phase 1):** keep one backend per club. Introduce a validated,
   operator-managed **club registry** in the app (`src/clubos/registry.ts`). The
   app runs in one of three modes:
   - `standalone` (default): backend from build env. Ambassadors is unchanged.
   - `directory`: a central finder with no backend that links to club apps.
   - `multi`: one app where the member picks a club and the app connects to
     that club's backend from the registry. This is the native-app model.
2. **Phase 2:** move the registry from build-time JSON to a ClubOS control-plane
   Supabase project (operator-only writes, public read of a `clubs_public`
   view). The app fetches it at start-up, falls back to a bundled copy, and
   applies the same validator. Onboarding writes go there, not to club data.
3. **Later:** revisit pooling only if the number of clubs makes per-project
   operations unsustainable, and only with a written migration and rollback
   plan, a tenant-isolation test suite run against every table, and explicit
   approval. Ambassadors live data is not migrated as part of this ADR.

## Rules that follow from this decision

- Backend configuration comes only from build env (standalone) or the
  registry (multi). Never from a URL, query string, deep link or form.
- The registry validator rejects service-role and secret keys, non-HTTPS
  URLs, unapproved hosts, a key from a different project than its URL, and
  any two clubs sharing a code, origin or backend.
- In multi mode, auth tokens, caches and pending invite codes are stored under a
  per-club namespace. Switching club does a full reload so no client, cache or
  realtime channel survives into the next club.
- A `/clubs/<code>/...` link selects its club before the Supabase client is
  created, and only opens allow-listed public routes.
- Platform operators get no standing access to club databases. Support access
  is a Phase 2 design with logging (see SECURITY.md).

## Consequences

- Shipping a second club means provisioning a second Supabase project with the
  full migration chain (CLUB_SETUP.md). That chain has not yet been replayed on
  a fresh project; doing so locally is the next Phase 1 task.
- Supabase Auth on each club backend must allow that club's `/clubs/<code>/...`
  redirect URLs when it is used in multi mode.
- Push subscriptions are per backend. A device signed in to two clubs is
  registered with both. Phase 6 adds unregistration when leaving a club.

## Rollback

All Phase 1 behaviour is behind `VITE_CLUBOS_MODE`. Removing the variable (or
setting `standalone`) restores the previous behaviour exactly: same backend,
same storage keys, same links. No database changes were made.
