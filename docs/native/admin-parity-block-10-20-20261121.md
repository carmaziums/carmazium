# CarMazium Android versus website: Admin parity 10–20% checkpoint

**Status:** Comparison block complete; **release and visual acceptance remain open**. Pause until user says "proceed". This is 20% of the ten-block work plan, not the percentage of achieved feature equivalence.

## Test environment and role matching
- Both runs took place in the SAME BlueStacks SM_S908E Android emulator (emulator-5554, 1600x900, density 240).
- Native installed package uk.carmazium.app, versionCode 121, versionName 1.0.1.
- Live website opened in Chrome INSIDE that emulator at https://carmazium.com/dashboard/admin.
- Verified the exact same admin email from the account menus on BOTH website and native app. No login changes or user-token extraction.
- Paired captures are saved locally under C:\Users\Dell\CarMazium-QA-Tools: admin-web-role-check.png, admin-app-role-check.png, admin-web-account.png, admin-app-dashboard.png, admin-web-mid.png, admin-app-mid.png, admin-web-customize-check.png, admin-web-card-editor.png. Do not publish screenshots containing profile details.

## Confirmed differences in installed Android build 121

| Item | Website admin | Native Android build 121 | Severity |
|---|---|---|---|
| Landing screen | Admin Command Centre hero, Refresh data, Create listing | Plain Admin Control Panel header | High |
| Visitor activity | Recently active estimated signals split between website and app, refresh every 30 seconds | Not displayed on admin home | High |
| App downloads / first opens | Android native, APK downloads, Android web-app, iPhone web-app, more counts | Not displayed on admin home | High |
| KPI cards | Responsive colourful tiles; configurable using profile preferences | Six plain static tiles | High |
| Quick actions | Prominent cards for listings, HPI, dealer KYC, handovers | Long list of module rows only | Medium |
| Admin navigation | Bottom tabs Overview, Listings, Transactions, Messages, More | Public marketplace tabs elsewhere; separate admin screen lacking persistent admin tabs | Critical |
| Native module coverage | Most tools within website experience | Several admin items marked "Website" and opened externally instead of as native screens | Critical |
| Account identity | Authenticated admin | Same authenticated admin confirmed | Pass |

Live counts can change between captures. A brief difference in users count is not proven to be a code defect. Website Customize cards was opened read-only; no preferences were altered.

## Changes made in isolated source branch fix/native-app-tour-20261121
- Reworked native admin dashboard around the website command-centre content and action hierarchy: same title, Refresh/Create actions, recently-active and app-first-open cards using existing analytics endpoints, handover alert using existing admin endpoint, and responsive colourful KPI cards.
- Added Customize cards supporting all 18 website admin-card IDs, reading the same server preference and writing the same preferences.adminDashboardCardIds field ONLY when the administrator taps Save.
- Added quick actions and grouped tools. Existing access control is still enforced by the admin navigation gate.
- Unavailable data is shown as unavailable, never invented.
- Existing external website fallbacks are NOT yet native and remain open defects.
- Existing signed-in build 121 remains installed and unmodified. The newly authored screen is NOT YET visually verified in the emulator.

## Verification and remaining scope
- 16 focused unit tests passed (admin dashboard model and native tour).
- ESLint passed.
- TypeScript tsc --noEmit passed (exit 0).
- The website's persistent admin bottom navigation and the native Modules/Website fallback pages still need fixes.
- Full Android emulator review of the NEW build has not yet happened; zero-difference claims are unwarranted.
- No live admin payments, approvals, offers, bids, listings or account mutations were performed.

**Next checkpoint, only after explicit "proceed":** 20–30% Admin modules and workflow parity, including native pages currently marked Website. Pause now.
