# ClubOS: multi-club foundation and optional websites

## Phase 1 (this branch)
- Keep a separate Supabase project, authentication, storage, Stripe settings and deployment per club. No database or production account changes.
- A central, directory-only deployment can list verified club names and codes, and link to each existing branded CRM. Credentials are entered only on the chosen club's own deployment.
- Configure the directory at build time with VITE_CLUB_DIRECTORY_JSON. Only operator-managed HTTPS origins are accepted. No arbitrary URL entry, automatic tenant provisioning, or cross-club session sharing.
- Example (replace with approved production values): `[{"code":"example-fc","name":"Example FC","origin":"https://crm.example.org","website":"https://www.example.org"}]`.
- Set VITE_CLUB_DIRECTORY_ONLY=true on the central directory deployment, and leave Supabase configuration unset. Its root redirects to /clubs. Existing club deployments leave this flag unset. They can optionally link to their configured directory at /clubs.
- Each club can keep its existing website, or opt into the starter website at /club-website on its own CRM deployment. The directory website link can point to either. Existing website integrations are unchanged.

## Optional website starter
Set VITE_CLUB_PUBLIC_SITE_JSON on a club's own deployment to publish the template. Example:
`{"name":"Example FC","introduction":"Football for our community","about":"Tell visitors about the club.","programmes":["Youth football","Senior football"],"contactEmail":"info@example.org","primaryColor":"#17466e"}`
This is intentionally a public, static, operator-configured starter, not an admin CMS. It only renders explicitly configured public text and uses existing registration/sign-in routes. Never put personal information, private squad records, bank details or credentials in the configuration.

## Next phases
1. Validate a clean second-club backend using CLUB_SETUP.md; run permission tests, registration, email, notifications and test-mode Stripe.
2. Add an operator-controlled directory service with verified domains, club lifecycle and audited onboarding. For a single native app, select verified backend configuration before creating a Supabase client; isolate auth/storage/cache namespaces, validate callback and invite routing, and keep club-specific push, payments and branding. Do not ship a native wrapper that merely navigates to separate websites.
3. Build an optional website editor: templates, pages, branding, sponsors, news, public fixtures/results, image cropping/focal points, preview, explicit publication and custom domain onboarding. Only publish approved public content through a separate public read model. Do not expose private CRM records or registration data. Keep existing Ambassadors website untouched until explicitly migrated.
4. Package with Capacitor for iOS and Android and test deep links, native push, account deletion and privacy controls. A shared single-login identity system, if required, is a later design with explicit membership and isolation tests.
5. Add club subscription plans and optional website add-on; keep player fees separate from ClubOS subscription revenue.

## Acceptance
Run npm ci, npm run lint, npm test, npm run build and npm run test:e2e. Test directory-only deployment without a backend, two independent club deployments, known/unknown club search, malicious config rejection, signup and reset links, and website opt-in and opt-out. Verify no data or credentials cross club boundaries. Do not deploy to existing production before passing checks.
