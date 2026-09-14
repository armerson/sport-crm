# Security and release verification — 14 September 2026

## Access-control blockers repaired and deployed

The ten core tables that previously had disabled row-level security now enforce
member permissions. Anonymous access to profiles, players, family/squad links,
teams, events, attendance, messages and audit logs is denied. Admin management,
assigned coach access, family access and linked-player access were tested.

Direct self-service writes cannot grant staff roles, claim another player, approve
a registration or change an attendance record's identity. Private lookup helpers
avoid recursive policies. Public branding and active registration questions remain
available without signing in.

Club invitation codes are no longer publicly enumerable. One existing active club
staff invitation was deactivated because its code had been public; an administrator
must issue a replacement if it is still needed. Existing memberships were retained.
Coach invitations require staff authorisation, and invitation redemption validates
the caller and reports failures.

The notification function now verifies the account, limits non-admin recipients
to shared teams, validates payloads and restricts delivery to browser push-service
hosts. It cannot be used anonymously to send notifications. Its gateway setting
remains `verify_jwt=false` because the function performs explicit `auth.getUser`
validation; this setting alone must not be treated as authorisation.

## Deployed changes

Local filenames match the versions recorded by Supabase's migration tool:

- `20260913230720_registration_approval_guardrails.sql`: atomic approval and
  authorised invitation creation/redemption.
- `20260913230724_restore_member_access_controls.sql`: RLS policies, protected
  columns, function grants, public-form compatibility and invitation revocation.
- `20260914061025_validate_and_deduplicate_registration.sql`: database validation,
  initial-signup retry protection, adult age checks and required custom answers.
- `send-push-notification` version 7: verified callers and restricted recipients.

## Evidence

- 64 role/permission checks and nine approval/invitation checks passed locally and
  against the deployed backend inside rollback-only transactions.
- Ten further registration validation/retry checks passed locally and live.
- 22 automated application/service checks pass, including six notification tests.
- The complete application lint check and production build pass.
- Live pre-confirmed disposable accounts verified real sign-in, parent/player
  profile creation, registration completion, admin approval, squad isolation,
  coach-created events, family attendance responses and a browser-sent team
  message visible only to its intended test squad.
- Live notification checks rejected anonymous and unrelated-team requests. A
  permitted request to a test account with no subscriptions returned zero sent.
- The public website's 81 tests and site validator passed; joining and sign-in
  links were verified on its production domain.

No real-member messages, notifications or charges were sent during these checks.
The SQL regression fixtures were rolled back. All disposable live accounts were
signed out, then removed. Follow-up queries confirmed zero remaining test users,
players, teams or messages.

## Repository automation

The release is recorded in [CRM PR 1](https://github.com/armerson/sport-crm/pull/1).
A verification workflow is prepared locally at `.github/workflows/verify.yml`.
It could not be pushed because the GitHub OAuth connection lacks the `workflow`
scope. Application checks passed locally; the release PR also passed Vercel checks.

## Advisor status and remaining limits

The post-repair security advisor reports no disabled-RLS errors or mutable-search-
path findings. It retains warnings for the two intentionally public known-code
invite lookups and authenticated privileged functions whose caller checks were
reviewed. These warnings do not establish that all future uses are safe; preserve
caller checks and execution grants when changing them.

Leaked-password protection is still disabled in Supabase Auth. See the
[password-security setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Email delivery and confirmation-link completion still require a user-controlled
test inbox. Pre-confirmed test accounts verify post-confirmation behaviour, not
mail delivery. Real push delivery and Stripe checkout/webhook completion have not
been exercised. Guest-payment functions in the repository are not yet deployed.

A fresh second-club backend has not been provisioned or validated. See
[CLUB_SETUP.md](CLUB_SETUP.md) before reusing the app for another club.

Relevant Supabase references:
[securing the Data API](https://supabase.com/docs/guides/api/securing-your-api),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and
[privileged-function warnings](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
