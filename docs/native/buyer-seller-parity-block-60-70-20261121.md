# CarMazium Android vs mobile website — Buyer/Seller 60–70% checkpoint

Date: 21 November 2026. **Progress: 70% of the ten-block work plan. This does not equal 70% verified functional or visual parity.**
Status: this block is finished and work must STOP until the user explicitly says 'proceed'.

## Reference and account proof

- Laptop DESKTOP-LPIB4R3, BlueStacks Samsung SM_S908E emulator, Android `emulator-5554`; installed production package `uk.carmazium.app` versionCode **121** remained unchanged.
- Live website opened in Chrome **inside the same Android emulator**, at `https://carmazium.com`.
- The **same authenticated Buyer/Seller account** was confirmed in the app and web profile menus. The profile uses the personal seller-view mobile bottom navigation on the website. No account credentials were retrieved or changed.
- Screenshots for QA were captured on the connected laptop at `C:\Users\Dell\CarMazium-QA-Tools\`. Relevant evidence:
  - `personal-switch-app-ready.png` and `personal-web-account-menu-70.png`: matching personal-account identity.
  - `personal-dashboard-native70.png` and `personal-dashboard-web70.png`: same dashboard labels/cards/attention-state with different bottom nav.
  - `personal-search-app-70.png` and `personal-search-web-settled70.png`: search and matching featured retail card.
  - `personal-saved-app70.png` and `personal-saved-web70.png`: both display 0 saved cars.
  - `personal-detail-app70.png` and `personal-detail-web-matched70.png`: matching BMW vehicle details, different page order/gallery/sticky actions.
- Screenshots may contain user/account information, therefore remain private on the connected laptop.

## Verified paired findings

| Area | Confirmed data / functions | Confirmed differences in installed build 121 |
| --- | --- | --- |
| Dashboard | Same My Dashboard copy, Needs Your Attention clear state and first dashboard cards | Website's four seller bottom tabs are **Home, My cars, Offers Received, Messages**. App globally shows five **Home, Buy Cars, Auctions, Saved, Dashboard**. Card spacing and header vertical rhythm also differ. |
| Vehicle search | Both show **717 vehicles** and the same first featured 2018 BMW 7 Series, price £24,600 | Website combines pale-blue input and red Search CTA within a white bordered form; app separates them and places result controls much closer to the form. Sort/filter hierarchy still differs, including filter toggle placement. |
| Saved cars | Same account and **0 saved cars** on both. Both have a route to browse listings. | Website uses a bordered large empty-state card, pink heart orb, stronger uppercase headline and red filled CTA. Native displays a sparse unboxed state and outline CTA. |
| Vehicle detail | Same BMW 7 Series registration/photo, 2018 year, price, 52,000-mile figure, hybrid fuel and automatic transmission | Website shows car title, badges and price **before** its boxed photo gallery; native app shows full-bleed hero photo **before** metadata. Website persistent lower bar emphasises direct telephone/contact controls; native emphasises private offer. The badge sets, photo lightbox and vertical structure differ. **Major unresolved**. |

## Source changes saved on isolated branch

- `src/lib/personalDashboardTabs.ts`: pure seller and buyer four-tab catalogues aligned with the website's `DashboardSidebar`. Seller: Home / My cars / Offers Received / Messages. Buyer: Home / My Offers / Purchases / Messages. Includes related native-route active-state rules.
- `src/components/PersonalDashboardBottomNav.tsx`: accessible four-tab native bar with the same role-specific shortcuts, wired to already existing native stack screens through `navigationRef`; does not open the website.
- `src/navigation/TabNavigator.tsx`: shows the four personal shortcuts only when a signed-in Buyer/Seller is on their private dashboard. The five public marketplace destinations remain available elsewhere.
- `src/navigation/MainStackNavigator.tsx`: keeps this four-tab personal navigation on the relevant native My Cars, Offers, Purchases and Messages stack pages; admin and dealer navigation remain isolated.
- `src/screens/main/SavedScreen.tsx`: website-style empty saved state with bordered card, large heart icon, matching guidance and prominent primary Browse Listings CTA. The list/grid control hides on an empty list.
- `src/screens/main/SearchScreen.tsx`: search input and button within a single visually bounded website-like form, uses website-style input theme colours, adds separation before result controls, improves header/text contrast and keeps existing search logic/filter implementation.
- New native unit tests for seller/buyer tab ordering and routing.

## Checks

- **38 Jest tests passed** across 7 suites, including personal bottom tab rules and earlier dashboard/cover/admin test suites.
- ESLint on changed source files PASSED.
- TypeScript `tsc --noEmit` PASSED.
- `git diff --check` and commit status to be checked before final commit.
- A new signed Android QA build has **not** been made or installed; the changes are source-only and **cannot** be called visually accepted. No production listings, offers, saved cars, purchase attempts, messages or account data were mutated.

## Outstanding critical differences

1. Vehicle detail needs a full title/badges/gallery layout and fixed contact/action bar parity review. This was not attempted because the page's offer, contact and gallery interactions require a broader coordinated change and signed emulator regression.
2. Search filter UI and sort dropdown hierarchy differ. The form shell was aligned, but all filter controls were not rebuilt or regression-tested.
3. Personal dashboard customisable card ordering/storage remains device/browser-specific; cross-platform preference sync requires an agreed server source.
4. The new personal bottom bar may need additional on-device acceptance around navigation stack transitions, Android back, small screens, safe areas and existing screen-specific bottom bars.
5. Photo gallery thumb scrolling, image number, direct-seller call visibility for non-logged-in users, saved-item persistence after saving and all offer/payment paths were not exercised with production data.
6. User-facing Android APK still build 121; public download remains at previous held release state, no update deployed.

**Next block only after user says 'proceed': 70–80%, Buyer/Seller listing creation/editing, buying, selling, offers and messages.** Pending dashboard/search/detail and device tests are carried to the final regression block. No unverified 100% parity claims.
