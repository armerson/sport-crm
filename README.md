# Sports Club CRM

Sports Club CRM is a Vite + React app for club admins, coaches, and parents. The app now runs on Supabase for auth, data storage, realtime refresh, and privileged provisioning.

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

## Supabase Setup

1. Create a Supabase project.
2. Enable Email auth in Supabase Auth.
3. Apply the SQL schema in [supabase/migrations/20260402170000_initial_schema.sql](supabase/migrations/20260402170000_initial_schema.sql).
4. Deploy the edge function in [supabase/functions/provision-club-user/index.ts](supabase/functions/provision-club-user/index.ts).
5. Set `APP_BASE_URL` for the edge function using [supabase/functions/.env.example](supabase/functions/.env.example).

Core database tables:

- `profiles`
- `teams`
- `players`
- `team_coaches`
- `player_teams`
- `player_parents`
- `events`
- `attendance`
- `messages`
- `audit_logs`

## Supabase Launch Checklist

1. Create the Supabase project.
2. In Supabase Auth, enable Email sign-in.
3. Run the SQL in [supabase/migrations/20260402170000_initial_schema.sql](supabase/migrations/20260402170000_initial_schema.sql).
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`.
5. Add the same two variables in Vercel.
6. Set `APP_BASE_URL` for the provisioning edge function using [supabase/functions/.env.example](supabase/functions/.env.example).
7. Deploy the edge function in [supabase/functions/provision-club-user/index.ts](supabase/functions/provision-club-user/index.ts).
8. Create the first admin user in Supabase Auth, then set that user's `profiles.role` to `admin` in the database.
9. Open the app locally or on Vercel and verify admin, coach, parent, attendance, and messaging flows.

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

Current frontend validation passes:

- `npm run build`
- `npm run lint`

## Legacy Cleanup

The active app runtime uses Supabase only.
