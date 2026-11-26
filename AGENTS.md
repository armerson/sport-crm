# Working on ClubOS

Instructions for people and coding agents working in this repository.

## Product

ClubOS is a club management platform for independent sports clubs, starting
with football. Ambassadors FC (Northern Ireland) is the flagship club and live
production user. Four connected products share one source of club data:

- **App** — coaches, parents, players, volunteers (web now; iOS/Android via Capacitor).
- **Admin** — club administration, finance, registrations, settings.
- **Websites** — optional public club sites fed by approved public data.
- **Media** — graphics, match reports and approval-gated social publishing.

Aim: an affordable, complete alternative to existing club platforms. Prefer
features that remove real admin work. Keep coaches' and parents' screens simple;
admin dashboards should surface exceptions and actions, not just statistics.

## Architecture rules

Read [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md) and
[ADR 0001](docs/adr/0001-club-isolation-model.md) first.

1. One codebase. Never fork code per club; use configuration.
2. Each club keeps its own Supabase backend. Never connect a club, a dev
   machine or a preview to another club's backend.
3. Backend configuration comes only from build env or the validated club
   registry (`src/clubos/registry.ts`). Never from user input.
4. Use `src/lib/supabase.ts` for every backend call, including function URLs.
   Never read `VITE_SUPABASE_URL` elsewhere.
5. Browser state that belongs to a club uses `clubSessionStorage()` /
   `clubLocalStorage()` from `src/clubos/runtime.ts`.
6. Shared links (invites, registration, payments, email redirects) use
   `clubShareUrl()`.
7. Gate packaged features with `hasFeature()` from `src/clubos/plans.ts`. Never
   hard-code plan names or prices elsewhere.
8. Integrations (COMET, Stripe, Xero, calendars, maps, social, ArenaBook,
   safeguarding) are optional per club. COMET stays the source of truth for
   official fixtures where a club has it; manual entry and CSV must also work.
9. Build for football first without assuming football in shared models
   (`sport` is a field, not a constant).
10. ClubOS subscription revenue and club membership payments are separate
    systems and separate Stripe accounts.

## Security rules

- Enforce permissions in RLS and server functions, not only in the UI.
- Never disable RLS, broaden a policy or grant execute on a privileged function
  to fix a bug. Fix the query or the policy correctly and add a test.
- No secrets in `VITE_` variables or in Git.
- Children's data, photos and schedules are private by default. Publishing
  anything externally requires an explicit approval step.

## Change process

For every substantial change:

1. Work on a dedicated branch (`claude/...` or `codex/...`). Preserve unrelated
   work; never reset or overwrite someone else's uncommitted changes.
2. Database changes are new files in `supabase/migrations`. Never edit an
   applied migration. Add or update a test in `supabase/tests`.
3. Run `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e`
   (locally, `npx playwright install chromium` once, or use the Chrome channel).
4. Add regression tests for the behaviour you changed.
5. Document configuration changes in `.env.example` and ARCHITECTURE.md.
6. Update CHANGELOG.md with what changed, limitations and rollback.
7. Keep the docs below current when you change their area.

Do not, without explicit approval from the owner: delete production data,
change live billing or Stripe settings, create paid infrastructure, submit to
app stores, deploy breaking changes, or replace the Ambassadors FC website.

## Documentation map

| File | Purpose |
| --- | --- |
| PRODUCT_OVERVIEW.md | What exists today and who uses it |
| ARCHITECTURE.md | Modes, layout, registry schema, environments |
| docs/adr/ | Architecture decisions |
| SECURITY.md | Security model and required tests |
| MULTI_CLUB_ROADMAP.md | Audit findings and prioritised phases |
| MOBILE_APP_ROADMAP.md | Capacitor plan |
| WEBSITE_BUILDER_ROADMAP.md | Website builder plan |
| CHANGELOG.md | Changes, limitations and rollback per release |
| CLUB_SETUP.md | Provisioning a club backend |
| COMET_INTEGRATION.md, WEBSITE_INTEGRATION.md, UI_SYSTEM.md | Area guides |
