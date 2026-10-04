# Block 1 release acceptance: dealer shortlist on website, iOS and Android

**Status:** Test specification only. Physical device / store-build execution evidence **not yet provided**. This file is intended for the same release candidate commit represented in draft PR #413, not an arbitrary earlier app-store version.

## Test environment and isolation

- Use an existing production-like backend with safe disposable/test auctions. Do not place real customer bids, charge platform fees, alter production credentials or create paid infrastructure to manufacture evidence.
- Use a verified dealer owner and two delegated staff accounts (one with `VIEW_TRADE`, one without). Separately use an unverified dealer account and a non-dealer buyer account.
- Sign and install both native app candidates using the real accepted application IDs, signing settings and tested association/deep links. Record exact native build number, PR-head SHA and test/backend environment for each run.
- Prepare at least 13 test auctions or use a controlled equivalent with explicitly recorded API fixtures. Include one live auction with simulated fresh bids, one upcoming auction and one that is about to end.
- Document the website deployment commit and each client's ID separately; do not report an uninstalled source revision as a live app test.
- Record PASS, FAIL or BLOCKED for each platform and each applicable account with a timestamp and redacted screenshot/log. Avoid personally identifiable seller details in logs.

## Manual / integration journeys

| ID | Action to execute | Required expected result | Web | iOS | Android |
|---|---|---|---|---|---|
| B1-01 | Owner signs in, opens live auctions, saves a vehicle | Heart/listing indicates saved; registered under correct user; no fee, seller contact or bid placed | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-02 | Save on web, open Live and shortlist on iOS and Android | Hearts reflect saved state on focus; native Live to Bid shows same vehicle from `GET /watchlist/auctions` | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-03 | Save via Android heart, then refresh website and iPhone | The same user-scoped item appears on all three, without duplicates | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-04 | Remove saved item on iPhone, revisit website and Android | Item no longer saved on all clients; removal does not alter auction state | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-05 | Populate 13+ saved auctions and navigate to page 2; delete only final page item | Automatically returns to prior nonempty page rather than showing false empty state | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-06 | Save an upcoming test auction and switch Live to Bid / All Saved | Live lists only valid currently live/approved items; All Saved retains upcoming, ended and cancelled items | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-07 | Have a live test auction receive a legitimate test bid and later expire while shortlist remains open | Fresh bid amount/count and state update within refresh interval; countdown expires; ended auction leaves Live view and remains in All Saved | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-08 | Background each app then return; revisit shortlist after web change | No continuous background polling; app foreground/focus fetches authoritative state; no stale bid eligibility | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-09 | Tap Open auction to bid on live item, View auction on ended item, and visit My Auction Bids from dealer menu | Opens current server auction without blindly bidding; bid history visible only where backend/dealership permission permits; actual bid eligibility is enforced by backend | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-10 | Access saved dealer auctions as delegated staff with `VIEW_TRADE` on verified dealership | Screen and allowed shortcut reachable on all clients; staff's personal shortlist not conflated with owner's | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-11 | Access shortlist as verified staff without `VIEW_TRADE`, unverified dealer or buyer | No native shortlist shortcut exposed; direct navigation/server request denied; no trade-price or seller-contact leak | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-12 | With a populated saved list, drop the network and refresh, then restore connection | Old saved items remain visible but no false confirmation or invented latest data; refresh repairs state on recovery | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-13 | Sign out dealer A while watchlist load is pending; sign in dealer B on same device | Old in-flight data cannot refill B's list; B sees only own items; session/token/permission state scoped to B | NOT TESTED | NOT TESTED | NOT TESTED |
| B1-14 | Repeat B1-01 to B1-13 with screen reader enabled and larger text | Every actionable icon accessible and focusable; no clipped headings/buttons or blocked confirmation | NOT TESTED | NOT TESTED | NOT TESTED |

## Automated evidence (different from native release acceptance)

- [ ] Record green One Product Parity checks **on exact final PR head**, including web/mobile/backend typechecks, backend guards and source-path parity contract.
- [ ] Record green Mobile Listing CI and Release Certification code/build checks on the exact head; separately record any skipped live production/store checks.
- [ ] Verify secure backend unit test `src/watchlist/watchlist.service.spec.ts`: owner isolation, verified dealer route, reserve/seller privacy and last-page fetch protection.
- [ ] Attach native physical results and blocker/reproduction details before switching PR from draft to ready or merging. If real devices/store credentials unavailable, leave BLOCKED; do not invent synthetic passes.

## Rollback and release

Rollback checkpoint: main `b0bca15cc91e5cc3967065cf975f0ca2ec506486` with the website-only shortlist. PR #413 is an isolated draft. Do not independently cherry-pick an incomplete subset of its changes. No native store publication until green code checks, device evidence, correct signing and production association verification.
