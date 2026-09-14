# IFA COMET integration

## Purpose

Connect the Ambassadors FC ClubOS deployment to the Irish Football Association's COMET Football Management System without coupling ClubOS to a single association or exposing COMET credentials in the browser.

The first connection should be a one-way import from COMET into ClubOS. COMET remains the source of truth for official competitions, fixtures, results, registrations, and eligibility. ClubOS remains the source of truth for attendance replies, team messages, news, billing, development reviews, and family-facing profiles.

## Current connection

The Ambassadors FC website already holds the IFA COMET API key on its server and exposes a small, cached fixture feed at `https://www.ambassadorsfc.org/api/comet`. ClubOS reuses this feed, so the COMET key is never copied into the CRM or a member's browser.

Each ClubOS team stores its public COMET team ID and competition ID. An authorised coach or admin can choose **Sync COMET** from the schedule. The sync imports official fixtures and scores, prepares pending attendance for the squad, and updates matching records using the permanent COMET match ID.

Once a fixture has been imported, later syncs compare its kickoff, venue, opponent and status. When any of those details change, ClubOS sends one concise update to the team's linked parents. The first import stays quiet so connecting an existing season does not produce a burst of notifications.

For another separately branded club app, set the Edge Function's `COMET_FEED_URL` secret to that club website's compatible server feed.

## First release

Import these records for Ambassadors FC:

1. Club and team identifiers.
2. Competitions and seasons.
3. Official fixtures, including opponents, venues, and kick-off times.
4. Final scores and match status.

The import should match records using permanent COMET identifiers. It must update an existing fixture when COMET changes it rather than creating a duplicate. Coaches can still create training sessions and friendlies locally.

Player registration data should be a separate phase after the IFA confirms which personal data and registration endpoints the club may access. ClubOS must not send registration changes back to COMET unless the IFA explicitly provides and authorises write access.

## Connection design

COMET credentials remain in the website's Vercel environment. They must never be added to the Vite environment or sent to a member's browser.

A Supabase Edge Function will:

1. Authenticate the ClubOS administrator requesting a sync.
2. Request the permitted, normalised records from the club website feed.
3. Validate and normalise the response.
4. Upsert records into ClubOS using COMET identifiers.
5. Record the sync counts in the club audit log.

The admin app stores the two public IDs while the coach schedule shows the sync action. A scheduled sync can be added after the first manual imports are verified.

## Data ownership

| Record | Source of truth | ClubOS behaviour |
| --- | --- | --- |
| Official fixture | COMET | Import and update from COMET |
| Official result | COMET | Import and update from COMET |
| Competition and season | COMET | Import for filtering and display |
| Training or local friendly | ClubOS | Created and managed by coaches |
| Attendance reply | ClubOS | Managed by players and parents |
| Team communication | ClubOS | Managed by staff and members |
| Player registration status | COMET | Read-only import after IFA approval |
| Family profile and billing | ClubOS | Managed locally |

## Existing access

Ambassadors FC already has the organisation authorisation, API address and key configured on the website. ClubOS needs only the public team and competition IDs already present in the website project. Player registration data remains a later phase and still needs confirmation of the personal-data endpoints the club may use.

## Verification before launch

Test the first import against a small date range and compare the fixture count, opponents, dates, venues, and scores with COMET. Re-run the same import to prove that it updates existing records without duplicates. Keep the connection read-only until the club and IFA have reviewed the result.

## References

- Analyticom COMET REST API: https://kb.analyticom.de/comet/comet-rest-api
- FIFA Connect data standard: https://data.fifaconnect.org/
- IFA COMET terms: https://www.irishfa.com/media/18625/ifa-comet-terms-and-conditions-of-use-last-updated-110718.pdf
