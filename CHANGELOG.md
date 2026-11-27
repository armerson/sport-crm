# Changelog

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
