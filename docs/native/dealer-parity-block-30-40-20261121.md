# CarMazium Android versus mobile website: Dealer block 30–40%

Date: 21 November 2026. **Status: source-level correction checkpoint reached, but LIVE dealer-to-dealer verification BLOCKED.** This is the fourth 10%-plan checkpoint; it does not assert 40% feature parity or 40% QA coverage. Pause here; do not start 40–50% without the user's next explicit "proceed".

## Same-emulator environment and account blocker

- Connected laptop DESKTOP-LPIB4R3, BlueStacks SM_S908E emulator (emulator-5554, physical 1600x900, density 240).
- Existing installed Android package uk.carmazium.app, versionCode 121, versionName 1.0.1, preserved.
- The *live* https://carmazium.com/dashboard/dealer URL was opened using Chrome INSIDE this same BlueStacks emulator. The screenshot `C:\Users\Dell\CarMazium-QA-Tools\dealer-web-session-check.png` shows it redirecting to **Admin Command Centre** with admin avatar, not an authenticated dealer dashboard. The native app had been left signed in as the admin account from the earlier role comparison.
- This is **not** a successful dealer-to-dealer comparison. Do not use admin output as dealer evidence, infer a dealer login or claim device-side verification. A matching dealer account must be signed in to BOTH Chrome and the native app before the dealer screenshots can be collected and accepted.
- No account was switched, signed out or reset; no credentials were accessed or changed.

## Website versus app source review

Reference website:
- `src/app/dashboard/dealer/page.tsx`: DealerServicesNotice, verified dealer hero, DealerAttentionPanel, DashboardCards, unread AUCTION_ENDED_NO_SALE popup/retail recommendation, email verification state.
- `src/app/dashboard/dealer/layout.tsx`: verified-owner phone gate; KYC and role/permission guard.
- `src/components/dashboard/DashboardCards.tsx` plus `src/data/dashboardCards.json`: 21 dealer dashboard tools, permission-gated, user-customisable card order/show/hide/reset.
- `src/components/dashboard/DashboardSidebar.tsx`: dealer bottom tabs Dashboard, Stock, Customers, Auctions; permissions enforced by dealer-access rules.
- `src/components/dealer/DealerServicesNotice.tsx`: service setup notice hidden after version-2 backend introduction acknowledgement.

Reference native:
- `src/screens/main/DealerProfileScreen.tsx` and `DealerWebParityOverview.tsx`: existing dealer hero and attention tasks.
- `src/components/DashboardCards.tsx` and `src/lib/dashboardNavigation.ts`: dashboard cards and user-customisable order/show/hide/reset.
- `src/navigation/TabNavigator.tsx`: role-gated four-tab dealer navigation.
- `src/screens/main/SettingsScreen.tsx`: personal/business/verification/notifications/payouts/appearance/security/reviews/account sections; finance, warranty, collection/delivery/recovery and inspection switches.

### Confirmed findings
1. **Pass (source contract):** all 21 dealer card IDs, labels and required dealer permissions match the website's card catalogue, according to automated regression tests. This is not visual proof.
2. **Pass (source contract):** dealer bottom-tab routes and permission gates correspond to website Dashboard/Stock/Customers/Auctions shortcuts; role-based positioning and actual tap navigation still need emulator testing.
3. **Difference:** website surfaces a one-time services notice with settings link and server-side dismiss; current installed app does not.
4. **Difference:** website surfaces a role-specific unsold-auction modal with retail recommendation and mark-read; installed native dealer overview does not. New native prompt safely routes to existing auction/inventory management. **Its action is not yet identical to the website's direct retail-conversion URL; this remains an open gap.**
5. **Difference:** website requires a verified dealership owner to save a phone number with a non-dismissable gate. Native build 121 instead has a dismissible recurring warning. Not changed until actual dealer QA due to the risk of locking out an in-progress session.
6. **Difference:** website stores dashboard customisation in browser localStorage; app uses per-account AsyncStorage on device. Same controls and default card set, but layouts don't automatically sync between platforms. Cross-platform shared preferences would require coordinated migration/product decision.
7. **Potential difference:** web dealer layout has special verification email panel and unsold-auction modal. Native sign-in blocks an unconfirmed Supabase session earlier. Their user-visible flows need side-by-side verification using permitted accounts.

## Source changes made (isolated worktree)

- Added a native `DealerServicesNotice` with Business settings navigation, visible only for an actual dealer profile with unsaved version-2 notice acknowledgement. Dismiss is posted through the website's existing `PATCH /users/me/introduction` only after a deliberate tap, not during read-only audit.
- Added `DealerUnsoldAuctionNotice` using the same existing notification type `AUCTION_ENDED_NO_SALE`; fetches unread alerts on focus and periodically every 30 seconds, and marks the notification read only upon deliberate dismiss/action. Its navigation stays within native screens and does not initiate a listing, payment, or auction mutation.
- Both components are mounted only in the native dealer home. Existing app build 121, data and public download remain untouched.
- Added pure dealer notice rules and website-catalogue regression tests.

## Tests

- 26 focused Jest tests passed (4 suites), including dealer card/permission catalogue and notice logic plus earlier admin/tour tests.
- ESLint passed for modified dealer components.
- TypeScript tsc --noEmit passed.
- **No signed QA APK was built and installed, so native UI layout, modal overlap, voice tour interaction, account switching, notification dismissal and taps are unverified on a device.** Do not claim feature parity.

## For next checkpoint

A dealer session must be active on BOTH the Android app and Chrome INSIDE BlueStacks, with a matching dealer identity and same relevant permissions. Only then capture dashboard, header, navigation, dashboard customisation, verification, business services and settings screenshot pairs. Work plan proceeds into dealer stock/listing flows at 40–50% only on the user's next instruction; record any unresolved 30–40% runtime gaps.

No production cars, payments, bids, auctions, preferences or accounts were changed during this block.
