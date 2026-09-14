# ClubOS — sports club management

## What it is

ClubOS is a standalone management app for sports clubs. It helps administrators,
coaches, parents and players organise club life in one place: registration,
squads, schedules, attendance, messages and payments.

The aim is an app that is easy to use on a phone at the pitch and polished enough
to feel like a premium product. Ambassadors FC is the first club using this project.

## Separate from the public website

The management app and a club’s public website are separate products.

- The website introduces the club, shares public information and attracts members.
- ClubOS handles member accounts and private club operations.
- A website’s Join the Club button opens ClubOS registration.
- Existing members use a sign-in link to reach their own workspace.
- ClubOS can provide a return link to the club’s website.

A club does not need to rebuild its website to connect it to ClubOS. The initial
integration is ordinary web links, rather than embedding the entire app or
sharing private member records with a website.

This repository is primarily a CRM and club operations app. Its posts and forms
features do not yet make it a general-purpose website CMS. Managing arbitrary
website pages from ClubOS would be a separate extension.

## How other clubs will use it

The agreed initial model is **a separate branded app for each club**.

Each club should have:

- Its own app deployment and public address.
- Its own database, authentication and storage backend.
- Its own club name, badge and primary colour.
- Its own members, staff, teams and payment configuration.
- A configurable link to its own public website.

The same application code can be reused across these deployments. This avoids
hardcoding Ambassadors FC into the product and keeps each club’s records separate.

A single shared platform with a club switcher is not part of the initial release.
The current database is not designed to safely mix independent clubs in one
backend; that would require explicit tenant membership and access policies.

## Who uses it

### Coaches — the current development priority

Coaches can work with their assigned teams, manage players, create training
sessions and fixtures, review availability, record attendance and communicate
with families. Existing features also include match results, lineups, statistics,
player reviews and club posts.

The latest development pass adds:

- A coaching overview with the next session and useful shortcuts.
- Upcoming, past and all-event views, plus event search.
- Attendance search by player name and response status.
- Correct squad selection when opening an event from All teams.
- Team messages that open for the selected squad.
- Message drafts kept separate for each user and conversation.
- A registration link coaches can copy for families.
- A more compact desktop header and improved mobile attendance layout.

### Parents and guardians

Parents can register their children, see their activities, respond to availability,
follow team communication and access family billing. One family account can
include more than one child.

### Adult players

Players aged 18 or over can register themselves, access their schedule, update
their profile, see messages and manage club payments.

### Club administrators

Administrators manage teams, players, staff access, parent links and registrations.
The existing app also contains billing, forms, posts, bulk import, club branding
and an activity log.

## Registration from a website

The new `/register` page offers two clear choices:

1. Register a child or children as a parent or guardian.
2. Register yourself as a player aged 18 or over.

The selected route opens the appropriate account form. Birth dates are checked
for validity, future dates are rejected, and adult registration checks age.
Account confirmation follows the club backend’s email settings. The club’s
existing registration review and team-assignment workflow controls team access.

The Ambassadors FC homepage changes point Join the Club and the Play card to
registration, and add a member sign-in link. Trial enquiries remain available
through the website’s contact page.

See [WEBSITE_INTEGRATION.md](WEBSITE_INTEGRATION.md) for the exact links,
configuration and release order.

## What has been verified

For this development pass:

- The production build passes.
- Twenty-two automated checks cover registration retries, role selection, child
  validation, safe sign-in destinations, birth dates and website links.
- Two website checks cover registration, member sign-in and trial links.
- The complete application lint check passes.
- Browser checks cover parent and player entry forms, multiple-child labels,
  desktop and phone layouts, coach schedule filters, attendance search and
  response updates, team selection and separate message drafts.

Initial coach browser checks used isolated sample data. The release was then
verified using disposable accounts against the real backend: sign-in, registration
completion, approval, team assignment, event creation and attendance all passed.
Email confirmation delivery, real push delivery and payment processing still need
controlled end-to-end tests.

## Release status

The CRM is live at [sports-crm-dun.vercel.app](https://sports-crm-dun.vercel.app).
The Ambassadors website now links to `/register` and `/login` through
[website PR 106](https://github.com/armerson/ambassadors-fc-website/pull/106).
Its release preserved the existing fixture and graphics updates and did not alter
the unfinished Downloads checkout.

Database access-control repairs and registration safeguards are deployed. The
notification endpoint now checks sign-in and team membership. See
[SECURITY_RELEASE_BLOCKERS.md](SECURITY_RELEASE_BLOCKERS.md) for the exact evidence,
the revoked old staff invitation and remaining test limits.

The latest quality pass fixes cancelled-event status loading, stale squad/review
state, notification-permission initialisation and the deletion undo timer.

## Remaining rollout work

1. Verify email confirmation and password reset using a controlled test inbox.
2. Verify real notification delivery with a controlled device.
3. Configure and test billing using the club's intended Stripe test setup before
   enabling any new live payment journey.
4. Use [CLUB_SETUP.md](CLUB_SETUP.md) to provision and validate a second branded club
   when its details and backend are available.
5. Gather coach feedback from everyday use and prioritise the next improvements.

## Other documentation

- [README.md](README.md): development setup and technical foundations.
- [WEBSITE_INTEGRATION.md](WEBSITE_INTEGRATION.md): website links and release order.
- [REVIEW_GAPS.md](REVIEW_GAPS.md): an earlier technical review; some findings may
  have changed since it was written.
