# CarMazium Android vs mobile website — Buyer/Seller 70–80% checkpoint

Date: 21 November 2026. **80% is a work-plan milestone, not 80% verified parity.** After this report, STOP until the user explicitly authorises the 80–90% block by saying "proceed".

## Same-device and account comparison

- Connected laptop DESKTOP-LPIB4R3. Emulator: BlueStacks Samsung SM_S908E (`emulator-5554`); Android app package `uk.carmazium.app`, installed versionCode **121**.
- Website: live `carmazium.com` opened in Chrome INSIDE the same emulator, matching the same Buyer/Seller account confirmed in the previous checkpoint.
- No production listing, offer, bid, checkout, sale, message or account configuration was submitted/changed. Only read-only navigation, fullscreen swipes and screenshots.
- Private screenshot evidence in `C:\Users\Dell\CarMazium-QA-Tools\`:
  - `fullscreen-open80.png`, `fullscreen-swipe-actual-after80.png`: same first BMW 7 Series photo and **1/10** before and after a deliberate right-to-left swipe in the installed app — directly reproduces the bug
  - `personal-sell-entry-app80.png`, `personal-sell-entry-web80.png`: different vehicle valuation/listing entry layouts
  - `personal-offers-app80.png`, `personal-offers-web80.png`: no received offers
  - `personal-messages-app80.png`, `personal-messages-web80.png`: 6 same-account conversations in the same order
  - `personal-my-cars-app80.png`, `personal-my-cars-web80.png`: zero listings, different new-listing route/buttons and empty-state copy
- This screenshot evidence must remain private where account/customer information appears.

## Critical native fullscreen-gallery defect: confirmed and corrected in SOURCE

**Reproduced on installed build 121:** The BMW 7 Series full-screen viewer opened on photo 1 of 10. Dragging from right to left left it on photo 1 of 10 and displayed the same photo. Existing `VehicleDetailScreen.tsx` had a fullscreen Pan gesture that moved `panX/panY` but never changed `fullscreenIndex`. Therefore there was no photo navigation in fullscreen. Inline gallery swipes used a separate gesture and did advance photos.

**Photo count clarity:** The installed app had a small `1/10` top-right overlay, but it was easy to miss and never changed with the broken fullscreen gesture. Both inline and fullscreen counters now use the same `n / total` formatter, with a larger high-contrast treatment and screen-reader labels (e.g. `Photo 2 of 10`).

Changes on isolated branch:
- New `src/lib/fullscreenGalleryNavigation.ts` with pure, tested edge-safe navigation, 18%-viewport/55px normal swipe threshold, optional flick velocity, no photo switching when zoomed, and clear/current index counters
- In `VehicleDetailScreen.tsx`, fullscreen Pan gesture now calls JS to change the selected photo; panning is preserved for zoomed pictures; gestures snap back at normal zoom
- Accessible **Previous** / **Next** buttons and a "Swipe left or right · Pinch to zoom" hint in the fullscreen viewer
- Active fullscreen photo is synchronised back to the regular gallery so that closing at photo 4 keeps the inline gallery on photo 4 and updates its count
- Fixed close icon foreground colour on the black modal; named theme tokens keep import badges/legacy HPI colours intact
- Added 8 photo-navigation tests: both swipe directions, bounds, rapid flick, zoomed pan, short gesture, single/empty photo and dynamic count

**Important:** The revised gallery has **not** been installed in BlueStacks. Its actual swipe and pinch behaviour with React Native Gesture Handler remains pending a compatible signed QA APK, and is NOT certified fixed for the installed or public app.

## Buyer/Seller workflow parity findings and source corrections

### New listing / valuation
- The website's `/sell` entry starts with registration and current mileage, a free valuation CTA and a later caravan/campervan opt-out route.
- Installed native `SellLanding` shows more manual vehicle fields and caravan actions above the valuation panel. This is a significant layout and first-step difference, still OUTSTANDING.
- The app's personal **My Cars → New Listing** button previously navigated directly to `SellCarFlow`, bypassing the website's selling/valuation entry. It now opens native `SellLanding`, matching website routing without creating or editing a listing.
- Personal My Cars Import Listing and New Listing buttons now stack full width, and the no-listings empty message matches the website instead of saying a filter returned nothing.
- Same account had no personal listings/drafts; completed listing submission, draft editing and paid checkout cannot be certified in this checkpoint.

### Offers received
- Both surfaces showed **zero received offers** for this account.
- The website distinguishes **"No listings to receive offers for."** (zero seller listings) from **"No offers yet"** (listings exist but have no offers). The native app previously always showed "No offers received".
- `SellerOffersScreen.tsx` now uses the existing complete `fetchAllMyListings` result to distinguish those states, and a pure helper `sellerOffersEmptyState.ts` captures the website copy. It does not send or respond to offers and does not change their backend state.
- Four tests cover no-listings, listings-no-offers, unavailable listing count and existing-offers cases.
- Actual accept, decline, counter, mark-sold, cancellation and payment steps were not executed on production data.

### Messages
- Both website and Android app displayed **6 conversations**, in the same order, with matching participant and vehicle associations.
- Differences remain in the list header padding, message-row spacing and compactness. No message was sent or conversation deliberately opened/marked read.

### Buying / vehicle detail
- Current 2018 BMW 7 Series vehicle data and price matched as in 60–70% checkpoint. The native full-bleed gallery-before-title order differs materially from the website's title/price/badges-before-gallery layout.
- User-facing seller contact button and fixed action bar also differ. These are still OUTSTANDING; no purchase, warranty checkout or offers were submitted.

## Verification results

- **50 focused Jest tests PASS** across 9 suites, including the new fullscreen navigation and seller-offers tests
- ESLint PASS on changed native TS/TSX code
- TypeScript `tsc --noEmit` PASS
- Stage/check/commit verification to be recorded before closing checkpoint
- Installed build **121**, local app data and authenticated account sessions preserved. **No public update deployed.**

## Remaining release-critical tasks

- Build a signed, update-compatible QA Android APK and repeat *real* fullscreen swipe, photo number, zoom/pan, previous/next, browser comparison and close/reopen tests in the SAME emulator, with no data reset
- Full first-step `/sell` valuation layout parity, personal listing wizard/draft and editing
- Vehicle detail title/gallery/order, direct contact controls, photo count/gallery swipe animation, filter and theme parity
- Offers acceptance/counter/cancellation, real purchases, seller funds/handover and messaging actions need safe QA fixtures; never test consequential transactions on live customer records
- The new native app tour/replay, settings and notifications are scheduled for the next 80–90% block. All remaining gaps go into final 90–100% regression/release gate

**STOP at the 80% work-plan checkpoint.** Wait for the user's explicit next "proceed" before starting the next block.
