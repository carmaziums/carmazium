# Website and native dashboard cards

Scope: dealer and buyer/seller dashboards on both website and native app. Customer dashboard More menus are removed. All permitted cards are visible by default. Customise supports show/hide, Earlier/Later, reset and persistence per account/dashboard in each local browser/device. Preferences do not synchronise across devices.

The native navigation catalog generates the website card snapshot and native link mapping using `node scripts/sync-dashboard-cards.mjs`. `--check` detects drift. Dealer staff permissions continue to filter destinations independently of saved preferences.

Native additions include finance referral, warranty quote/order/Stripe payment status, guest enquiries, articles, privacy, warranty terms, partner information and body guides. First-party dashboard links in support chat resolve to native routes. Third-party finance, Stripe, contact apps and external partner sites remain external services. Admin web tooling is outside this customer-dashboard scope.

## Verification

- Web and native TypeScript: pass.
- Repository regression suite: 779 tests pass.
- Native/component suite: 45 tests pass, including rendered website and native customisation, account isolation, permission filtering, storage failure, finance idempotency and warranty status verification.
- Product parity and code-controlled release readiness: pass. External release acceptance remains outstanding.
- Laptop Chrome component preview: 16 combinations (dealer/personal, 320/360/768/1440 px, light/dark) without horizontal overflow or overlapping cards; hide/reorder/reload/reset passed for both account types. This uses synthetic accounts and the real card/Button components with website CSS. It is not logged-in end-to-end production acceptance.
- Original emulator package confirmed as `uk.carmazium.app`, versionCode 108, versionName 1.0.0. No app was uninstalled and no account data was cleared.

## Release state

PR #944 includes the original-app homepage changes from draft #943. Website build and mobile config/typecheck CI passed on 0ae6e075. The backend knowledge-drift check identified the changed dashboard/support sources; guidance and source fingerprints have now been reviewed and updated for the new cards and removed More menu.

The app runtime version becomes 1.0.1 because expo-crypto requires a native rebuild. The production package identity and signing configuration are retained. A signed original-app candidate, installed upgrade testing, live account navigation and native payment acceptance are still needed. No website APK, app-store release or OTA update is published by this change.

## Installed review follow-up, 21 November

PR #944 merged as a4db6e37256d7ddf7a6ee5a71b5c7ae76a3bcd1d and its website deployment is live. Signed candidate 109 passed workflow 44840342344 and upgraded the original emulator package in place. The signing certificate matched build 108, Android UID remained 10064, and firstInstallTime remained 2026-11-20 11:36:34. Its signed-in buyer session survived the upgrade. The public website download was not changed.

Installed review exposed a separate buyer-only dashboard that had not received the shared cards. This follow-up adds the personal cards to that screen and the retained legacy website buyer screen, removes its old dashboard overflow and duplicate quick-action menu, and adds direct My Auction Bids and Seller Delivery Requests cards to both catalogs. A rendered buyer-screen regression test covers this integration. The buyer-specific activity statistics and period toggle remain available beneath the cards. The correction requires the next signed candidate; build 109 alone does not contain it.

Follow-up validation: website/native TypeScript, 779 repository tests, eight dashboard component tests including buyer-screen rendering, 39 knowledge tests, catalog/native-route parity and product-parity checks pass. Dealer-account navigation, payment acceptance and installed testing of the corrected candidate remain outstanding.

## Build 110 and duplicate-panel follow-up

The corrected signed build 110 (1.0.1), source 83b9fd7663cfaa1de61bb5d20a3e262fc587392c, passed candidate run 44844260744 and publication run 44847154991. APK SHA-256 is 18930b23d56129f85e7d3cc1ee6480e890b064e7efa66ab8e5161772650a1b60 (100497826 bytes). The original release signer and package are retained. The in-place emulator upgrade preserved UID 10064, original first-install time and the dealer session. Installed buyer-preview cards, hide/reorder/reset, auction bids and delivery requests passed. Dealer customisation, persistence, native customer forms/articles and light/dark/large-text checks were exercised during the preceding installed review. No live financial transactions were submitted; physical-phone installation has not been independently observed.

The production download page and /api/app-version now advertise build 110. The downloaded bytes match the installed APK. As with build 105, the first-party download URL redirects to the GitHub release-asset host; validation checked that HTTPS host and the complete file hash. Build 109 downloads were removed from the laptop, retaining build 108 as backup and build 110 as current.

The user's screenshots clarified that the complete Overview sections, date filters, statistic tiles and repeated shortcut panels should be removed beneath the cards on dealer and buyer/seller dashboard homes. The follow-up removes these from website and native homes, including legacy personal routes and the native dealer additional-insights section. Detailed destination screens remain accessible from the same cards. The dealer's existing personal-preview switch moves to the account menu. This follow-up requires a newer Android build than 110. The component preview also verified that hiding every card then resetting restores all 20 dealer and 17 personal cards in the default order after reload.
