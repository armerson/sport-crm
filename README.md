# Sports Club CRM

Sports Club CRM is a Vite + React app for club admins, coaches, and parents. The app now runs on Supabase for auth, data storage, realtime refresh, and privileged provisioning.

For a plain-English explanation of the product, roles, separate club apps and
current progress, read [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md).

## Club websites

ClubOS is a standalone management app. Initially, each club has its own branded
deployment and separate Supabase backend. Public websites link into registration
and member sign-in; they do not host the CRM or access private club records.

See [Website integration](WEBSITE_INTEGRATION.md) for entry points, configuration
and release order. Set `VITE_CLUB_WEBSITE_URL` to show that club’s website link.

For the Irish FA fixture and result sync, plus the later registration phase, see
[IFA COMET integration](COMET_INTEGRATION.md).

## Stack

- React 19 with Vite and TypeScript
- Tailwind CSS 4
- Supabase Auth
- Supabase Postgres + Realtime
- Supabase Edge Functions for privileged provisioning
- React Router
- Vercel for frontend hosting

## Current Scope

- Email/password sign-in and self-service parent signup
- Admin team creation, player creation, coach assignment, and parent linking
- Coach event creation with attendance seeding
- Parent event visibility and attendance responses
- Team messaging for admin, coach, and parent roles
- Admin audit feed for operational visibility

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase client credentials.

```bash
cp .env.example .env.local
```

Required frontend variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional integrations:

- `VITE_GOOGLE_MAPS_API_KEY` enables Google venue search when coaches create or edit events. Enable Maps JavaScript API and Places API (New) for the key. Without it, the location field falls back to basic address search and Google Maps directions still work.

## Supabase Setup

See [CLUB_SETUP.md](CLUB_SETUP.md) for the separate-club deployment checklist.
Apply the complete migration history, including the September access-control and
registration repairs. The initial April migration alone no longer supports the app.
First-admin access uses the `profiles.roles` array, not the retired `role` column.

See [SECURITY_RELEASE_BLOCKERS.md](SECURITY_RELEASE_BLOCKERS.md) for the repaired
access boundaries, deployed migrations and remaining verification limits.

## Auth And Roles

- Self-service signup creates parent accounts.
- Admin and coach accounts should be provisioned by an admin through the provisioning edge function.
- Role enforcement is handled by Postgres row level security in the Supabase migration.

## Provisioning

The admin dashboard calls the `provision-club-user` edge function to create coach and admin accounts safely.

The function:

- validates the signed-in admin
- creates the auth user with the service role
- inserts the `profiles` row
- generates the invite link
- writes an audit log entry

## Vercel Frontend With Supabase Backend

Vercel responsibilities:

- build and serve the Vite app
- provide `VITE_SUPABASE_*` env vars at build time
- handle SPA routing through `vercel.json`

Supabase responsibilities:

- authentication
- relational data model
- row level security
- realtime row-change refresh
- edge functions for privileged actions

Vercel setup:

1. Import the repository into Vercel.
2. Use the Vite preset or keep the detected defaults.
3. Confirm build command `npm run build`.
4. Confirm output directory `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings.

Routing note:

- `vercel.json` rewrites all routes to `index.html`, so React Router deep links continue to work on refresh.

## Local Development

```bash
npm install
npm run dev
```

## Validation

Frontend validation commands (repository-wide lint has pre-existing failures):

- `npm run build`
- `npm test` (Node 24+)
- `npm run lint`

## Legacy Cleanup

The active app runtime uses Supabase only.
