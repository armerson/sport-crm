# Review Findings & Improvement Suggestions (April 25, 2026)

This review was done to identify practical gaps and suggest what will most improve this sports club CRM in the near term.

## What I validated

- `npm run lint` (currently failing)
- `npm run build` (currently passing)
- Targeted source review around auth/invites, dashboard roles, messaging, events, and parent/player portals

## High-impact engineering gaps

## 1) Quality gate is still red

`npm run lint` currently reports **21 errors and 6 warnings**.

Largest failure clusters:

- `react-hooks/set-state-in-effect` appears across multiple pages/components/hooks.
- `react-refresh/only-export-components` appears in `BottomNav`.
- `react-hooks/exhaustive-deps` warnings are present in several data-loading effects.
- One unused variable remains in announcements flow.

### Why this matters

- Hook-related issues can lead to unnecessary re-renders, race conditions, and stale UI.
- A red lint baseline slows every future change and lowers confidence during release.

## 2) Build passes while maintainability checks fail

`npm run build` succeeds even with lint failing.

### Why this matters

- The app is shippable from a bundling perspective, but quality/correctness debt accumulates.
- Teams can unintentionally normalize shipping with known issues.

## 3) Missing automated test safety net

Current scripts include `dev`, `build`, `lint`, and `preview`, but no unit/integration/e2e test command.

### Why this matters

- The app has many role-based paths (admin/coach/parent), and those flows are easy to regress.
- Billing + invites + attendance logic deserves smoke/regression coverage.

## 4) Documentation scope drift

README "Current Scope" is now smaller than actual functionality currently in the codebase (payments, guest checkout, reviews, posts, forms, club invites, etc.).

### Why this matters

- New contributors and operators may miss critical features and setup expectations.

## What would make this CRM better (prioritized)

## Next 1–2 weeks (fast wins)

1. **Finish lint baseline cleanup**
   - Resolve all `set-state-in-effect` and dependency warnings.
   - Keep function names that are not hooks from starting with `use` in service modules.

2. **Add a CI quality workflow**
   - Run `npm run lint` and `npm run build` on pull requests.
   - Block merges on failure to avoid further quality drift.

3. **Add smoke tests for core user journeys**
   - Admin: create team/player, invite coach/parent.
   - Coach: create event + attendance update.
   - Parent: view schedule + RSVP + messaging.

## Next 1–2 months (product + platform)

4. **Role-aware observability**
   - Add structured client logging for critical failures (invites, billing, RSVP writes).
   - Add dashboards/alerts for edge-function failures and payment webhook errors.

5. **Performance hardening**
   - Audit large dashboard panels for over-fetching and unnecessary re-renders.
   - Introduce lightweight caching or memoized selectors for repeated role/team data joins.

6. **Operational UX improvements**
   - Add guided "first 10 minutes" admin onboarding checklist in-app.
   - Improve empty/loading/error states across parent/coach portals for clearer recovery.

## Commands used in this review

- `npm run lint`
- `npm run build`
- `rg --files`
- `cat package.json`
- `sed -n '1,220p' README.md`
- `sed -n '1,220p' src/pages/ClubJoinPage.tsx`
- `sed -n '1,260p' src/services/teamInvites.ts`
