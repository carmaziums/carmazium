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
