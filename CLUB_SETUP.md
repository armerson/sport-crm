# Deploying a separately branded club

ClubOS currently uses one application deployment and one Supabase project per
club. Never connect another club to the Ambassadors backend. No new club project
or paid service is created by this guide.

## Information to collect

- Club name, badge, primary colour, website URL and CRM domain.
- A club-controlled administrator email and a separate test inbox.
- Age groups, squads, coaches and required registration questions.
- Whether email confirmation, push notifications and billing will be used.
- The club's own payment provider account and pricing, if billing is enabled.

## Backend

Create a separate Supabase project and keep its database, Auth users and Storage
separate. Apply the complete schema and subsequent migrations, including the
September 2026 access-control and registration repairs. The initial April schema
alone is insufficient: it predates multiple roles, player registration, billing,
club settings and the current access rules.

Do not run old repair scripts that disable row-level security. Check the completed
schema before opening registration: every exposed member table must have RLS,
anonymous access must be denied, and the role tests in `supabase/tests` must pass.
The full historical migration chain has not yet been verified against a newly
provisioned Supabase project; validate it in staging before provisioning a second
production club. The permission repair itself was tested against a local copy of
the live schema and against the deployed backend.

Enable email/password authentication and configure the CRM origin as the Auth
Site URL. Allow that same origin's registration and invitation return paths.
Configure the club's email sender and test confirmation and password reset using
the controlled inbox. Leaked-password protection is recommended when available
on the selected Supabase plan.

Create the first administrator through Supabase Auth, then grant the verified
user's `public.profiles.roles` the value `ARRAY['admin']` using trusted backend
administration. Never grant staff access from editable signup metadata. Subsequent
staff can be invited through the app. Keep service-role credentials out of every
frontend environment variable.

## App and branding

Create a separate Vercel project from the shared application repository and set:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | The new club's Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Its public client key |
| `VITE_CLUB_WEBSITE_URL` | The club's HTTPS website URL |
| `VITE_VAPID_PUBLIC_KEY` | Optional matching browser-push public key |

Use the same values for that club's preview environment, or a separate staging
backend. A preview using production data is not an isolated test environment.

In ClubOS settings, save the club name, logo and colour. Add squads and assign
coaches. Configure the club's registration questions before sharing links.

Build with `npm ci`, `npm run lint`, `npm test` and `npm run build`. Deploy the CRM,
verify `/register` and `/login`, then link the public website's joining and sign-in
buttons to those routes on the club's CRM domain. Website integration is ordinary
links; it requires neither a shared database nor a specific website builder.

## Optional services

Deploy the server functions needed by the club. `provision-club-user` needs
`APP_BASE_URL`. `send-push-notification` validates the signed-in account itself;
its VAPID public/private keys and subject must match the browser configuration.
Keep the private key in Supabase secrets only. Test permissions before any real
notification delivery.

Billing uses Stripe server functions and requires that club's Stripe secret and
webhook signing secret. Configure products and test-mode prices, test checkout,
webhook processing and the billing portal, then explicitly choose when live
billing should be enabled. Do not reuse another club's Stripe customer records.
Guest checkout functions exist in the repository but were not deployed in the
Ambassadors project during the September release.

## Acceptance checks

Use dedicated accounts to verify parent and adult registration, email
confirmation, approval, squad assignment, coach event creation, family attendance
responses and team messages. Check mobile navigation, sign-out, password reset,
and that one club's app cannot read another club's backend. Verify reminders and
payments with controlled recipients and test-mode transactions.

Record the club's project IDs, domains, release version and responsible admin in
private operational documentation. Do not put passwords or secret keys in Git.
