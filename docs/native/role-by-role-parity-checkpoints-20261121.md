# CarMazium Android / mobile website — gated role-by-role parity

Date: 2026-11-21.
Emulator: BlueStacks `emulator-5554`, Samsung SM_S908E, Android package `uk.carmazium.app`, installed app build 121 (`versionName=1.0.1`).
Website baseline: the LIVE `https://carmazium.com` opened in Chrome inside the **same emulator**, not desktop Chrome.
Source branch: `fix/native-app-tour-20261121` (commit `70ba2738` at the start of this audit). Do not overwrite installed emulator app or public APK while auditing.

## Non-negotiable acceptance

Compare Admin native account to Admin web account, Dealer native account to Dealer web account, and Buyer/Seller native account to Buyer/Seller web account. Match role, identity where feasible, service approval/verification and permissions, light/dark theme, viewport, content, pricing, data, navigation, feature availability, actions, error states, and after-refresh/relaunch state. Store screen pairs and a discrepancy log. If one role cannot be signed in on both surfaces, mark NOT VERIFIED; never substitute a different role's screen.

A 10% checkpoint is a **scope milestone**, not a measured functional equality percentage. No unsupported 100% parity claim. Avoid modifying live production listings, bids, orders, payments or permissions during comparison. Only user explicitly saying 'proceed' authorises the NEXT 10%-block; pause at every boundary.

## Blocks — each ends with a report and a stop

| Block | Scope | State |
| --- | --- | --- |
| 0–10% | Check connection, actual Android package/build, same-emulator Chrome, account/role availability, baseline captures and a route comparison inventory | CHECKPOINT REACHED (environment + inventory); account identity not independently proven |
| 10–20% | Admin↔admin: sign-in, dashboard, bottom navigation, cards, alerts, tour and settings entry points | SOURCE CHANGES SAVED — emulator acceptance still pending |
| 20–30% | Admin↔admin: listings, auctions, approvals, dealer verification, users, transactions, services, handovers, refunds/cancellations, content and reporting | PARTIAL SOURCE IMPLEMENTATION — several modules and runtime QA outstanding |
| 30–40% | Dealer↔dealer: sign-in, dashboard cards, stock, profile, business settings, customisation, mobile menu and appearance | SOURCE AUDIT & NOTICE FIXES — LIVE DEALER COMPARISON BLOCKED by admin sessions; paused until proceed |
| 40–50% | Dealer to dealer: listing wizard, drafts, cover photos, edits, filters and inventory | SAME-ACCOUNT EMULATOR COMPARISON COMPLETED; new source changes saved; new APK visual QA still pending; no draft available to test |
| 50–60% | Dealer to dealer: bids, offers, purchases, handovers, messages and trade services | SAME-ACCOUNT EMULATOR COMPARISON COMPLETE FOR AVAILABLE READ-ONLY STATES; source fixes saved, live actions and new APK QA outstanding; paused until proceed |
| 60–70% | Buyer/Seller to Buyer/Seller: dashboard, navigation, search, filters, saved vehicles and detail | SAME-ACCOUNT EMULATOR COMPARISON COMPLETED; source navigation/saved/search fixes; new APK verification and detail page still outstanding; PAUSED |
| 70–80% | Buyer/Seller↔Buyer/Seller: auction/retail listing, offers, purchases, messages, delivery, cancellations, finance/warranty flows | NOT STARTED |
| 80–90% | Cross-role: settings, tour/replay, voice, navigation, alerts, permissions, responsiveness, light/dark, auto-update and notification flows | NOT STARTED |
| 90–100% | Regression across all three roles in emulator; account persistence, screenshots, functional assertions, release candidate readiness. Public rollout stays separate from testing | NOT STARTED |

## 10% checkpoint evidence (read-only)

- Desktop Commander connection: `DESKTOP-LPIB4R3` online. BlueStacks adb `C:\Program Files\BlueStacks_nxt\HD-Adb.exe` reports `emulator-5554 device product:b0qxxx model:SM_S908E`; reported physical size `1600x900`, density `240`.
- Real installed app package `uk.carmazium.app` versionCode=121. Thus comparisons reference the correct installed app, not a sandbox package. App installation, storage and APK delivery unchanged.
- Existing paired emulator captures in `C:\Users\Dell\CarMazium-QA-Tools\`: `native-home.png` / `web-mobile.png`, `android-current.png` / `web-dashboard.png`, `native-search.png` / `web-search.png`, `app-menu.png` / `web-menu.png`.
- In these captures, mobile app and mobile website both show a signed-in buyer/seller-style account (matching letter A/a), but the *underlying account ID* was not independently compared; do not claim it is the same email/user ID until confirmed in both account settings.
- Already identified visible differences (evidence in `docs/native/android-vs-live-web-20261121.md`): buyer/seller bottom navigation mismatch; search form/sort controls and vertical spacing mismatch; mobile menu Appearance missing in installed build 121; authenticated tour missing. The isolated source branch has staged tour/menu changes, not yet installed and visually verified.
- Native and website sources declare distinct role-aware dashboard/mobile navigation, and dealer permission checks; therefore one global 'looks similar' review is invalid. Admin/dealer live account pairs have **not** yet been opened side by side in this checkpoint.
- **No actual Admin↔Admin or Dealer↔Dealer user journey validated at 10%.** They are scheduled for checkpoints 20–60%.

## Report format at every checkpoint

1. Checkpoint percentage and exact role(s)/pages inspected.
2. Side-by-side proof: matching device/session and screenshots.
3. Defects found, severity, action taken, and verification status.
4. What remains unverified; do not turn a test count into a success percentage.
5. Stop. The user must say 'proceed' for the next 10% block.
