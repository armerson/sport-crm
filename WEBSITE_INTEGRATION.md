# Ambassadors FC registration integration

The website repository is `armerson/ambassadors-fc-website`, checked out at
`/Users/stewartglass/Downloads/Ambassasdors FC`.

The existing Vercel CRM project has the production alias
`https://sports-crm-dun.vercel.app`. No custom CRM domain was supplied.

## Standalone app

ClubOS is deployed separately from the public website. Its registration pages
use the configured club name, badge and colour. Set the optional
`VITE_CLUB_WEBSITE_URL` to provide a return link to that club’s own website.
For Ambassadors FC use `https://www.ambassadorsfc.org/`. There is no hardcoded
club website inside the registration component.

Other websites can link to the same documented routes on their own CRM
deployment. This is not yet a shared multi-tenant database: club isolation
requires separate backends until tenant membership and row policies are designed.

## Prepared entry points

- `/register`: public page with parent/guardian and adult player choices.
- `/login?mode=register&kind=parent`: family registration, including multiple children.
- `/login?mode=register&kind=player`: adult player registration.
- `/login`: existing member sign-in.
- `/?view=coach`: coaching workspace. Sign-in preserves this destination.

Website `index.html` now points the hero Join the Club button and Play card to
`https://sports-crm-dun.vercel.app/register`. The Get involved section also has
an existing-member sign-in link. Trial enquiries still point to the contact form.

Registration uses the CRM's existing account and pending-player workflows;
there is no new public access to player records and no website database copy.
Administrators retain the existing review and team-assignment steps.

## Release status

The CRM and database repairs are deployed. The public website's targeted changes
were merged as [PR 106](https://github.com/armerson/ambassadors-fc-website/pull/106)
and verified on `https://www.ambassadorsfc.org/`.

The release used an isolated checkout of the currently published website commit.
Pre-existing conflicts and unrelated edits in the Downloads checkout were left
intact. Future edits there should first reconcile its older homepage with main.

`VITE_CLUB_WEBSITE_URL` is saved in the CRM's Vercel production environment so
future builds retain the website return link.

## Verification

- Application lint, 22 automated checks and the production build pass.
- 83 database checks cover access, invitations, approval and registration.
- All 81 website checks and its public-page validator pass.
- Real disposable accounts verified sign-in, registration completion, approval,
  squad access and attendance. The accounts were pre-confirmed; mail delivery is
  still a separate test requiring a controlled inbox.

No real-member messages, push notifications or payment charges were sent.
See [SECURITY_RELEASE_BLOCKERS.md](SECURITY_RELEASE_BLOCKERS.md) for remaining
verification limits and [CLUB_SETUP.md](CLUB_SETUP.md) for separate-club setup.
