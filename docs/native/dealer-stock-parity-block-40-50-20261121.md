# CarMazium Android versus mobile website: Dealer stock, listing and cover-photo block 40–50%

**Date:** 21 November 2026.
**Milestone:** 50% of the ten-block work plan; this does NOT mean 50% feature parity has been verified.
**Stop rule:** Pause after this checkpoint until the user explicitly says "proceed". No public release or reinstall.

## Live paired mobile evidence — same dealer

- Device: BlueStacks Samsung SM_S908E (emulator-5554), same device size and OS for both surfaces.
- App: `uk.carmazium.app`, installed versionCode **121** (unchanged).
- Web: `https://carmazium.com` in Chrome **inside the same emulator**, not laptop desktop Chrome.
- **Same dealer account confirmed** on both by matching signed-in account menus and visible dealership name Pulse Cars Limited. Both had verified-dealer status.
- Captures are in the private local folder `C:\Users\Dell\CarMazium-QA-Tools\`:
  - `dealer-block-app-current.png`, `dealer-block-web-settled.png` — dealer dashboards.
  - `dealer-profile-app-50.png`, `dealer-profile-web-50.png` — same account verified.
  - `dealer-stock-app-50.png`, `dealer-stock-web-clean2-50.png` — both Stock screens.
  - `dealer-filter-app-50.png`, `dealer-filter-web-50.png` — expanded stock-status controls.
  - `dealer-add-app-50.png`, `dealer-add-web-50.png` — initial Add Vehicle entries.
  - `dealer-edit-app-50.png`, `dealer-edit-web-50.png` — existing first car, opened in edit mode read-only.
- Do not share screenshots containing third-party listing/customer data outside approved QA.

## Verified observations

1. Both Stock screens showed **48 of 48** vehicles, with **Live 48**, **Draft 0** and no listings in Under Review/Rejected/Sold/Sale pending/Withdrawn/Other at capture. The same Audi A1 2015 and Toyota Auris were the first two listings; the first Audi had the same registration, mileage, asking amount, engagement and hot-lead counts. These are point-in-time values, not immutable fixtures.
2. Website Stock shows native-select-like drop-down options with full status labels/counts, while installed app build 121 showed an in-flow collection of chips. Both include the same categories. **Native source was adjusted** to a vertical, dropdown-like list and clearer light-theme input contrast. Still requires device screenshot acceptance.
3. Website **Add Vehicle** from dealer Stock begins with **Choose How You Want to Sell** (Auction vs Retail). Installed app skipped this choice and went directly to Step 1 with Retail preselected. New isolated native **DealerListingMethod** screen now reproduces the two choices, website headings/benefits and local £100 promotional stamp; Stock, dashboard and dealer drawer link to it. Select Auction -> wizard receives `listingType='AUCTION'`; Retail -> `'CLASSIFIED'` with Basic tier. No listing is created just by opening the choice screen. The same dealer `MANAGE_INVENTORY` permission gate applies.
4. Existing live listing EDIT must continue direct to `SellCarFlow({ listingId })`; it is not routed through the new choice screen and must not change listing type. The direct edit was checked with the same existing Audi A1 on both. VRM/make/model were populated on both, but wizard layout and guidance still differ visibly.
5. Website uses an icon-based four-stage guided wizard for Retail; the app uses flat progress segments. Native source now renders responsive icons and stage labels; no new APK was installed to visually verify the change.
6. Photo-cover recommendation code in both uses **POST /listings/photo-cover-recommendation**, first **30** candidate exterior images, confidence **≥0.6**, promotes the chosen photo to cover while keeping metadata and the other images, preserves order when confidence is low or the API fails, and leaves a manual Make cover option. Native tests pass. **Actual new photo upload was NOT carried out against live stock**, so runtime photo parity remains unverified.
7. The website and native dashboard tiles already share dealer card catalogue and colours; source was adjusted to use exact website dashboard colour tokens rather than raw hex literals.
8. The website still shows some visual differences: price formatting (website `£10495` versus app `£10,495`), spacing, field styles, wizard header, guided full-screen/website switch, image/card rhythm. Do not declare pixel parity.

## Source corrections on isolated branch

- NEW `src/screens/sell/DealerListingMethodScreen.tsx` plus `src/lib/dealerListingEntry.ts`.
- Copied exact website artwork `public/assets/images/auction-100-stamp.png` to native app assets for this choice screen.
- Native `DealerListingMethod` route is protected by `withDealerGate(..., 'MANAGE_INVENTORY')`.
- Routed new dealer additions from Stock, dealer dashboard main action, dashboard-card tool and dealer drawer to that route.
- No change to existing vehicle `listingId` edit routes.
- Adjusted native stock status control to full-label vertical rows and search input to website-style `inputBg` with readable `textPrimary`.
- Converted shared dashboard-card colours to fixed semantic tokens matching the website in both themes, preserving exact RGB/alpha values and typographic sizes.
- Replaced native wizard's flat-progress indicator with an icon-based stepper and accessible current-step information, including five auction steps if applicable.
- Restored lint conformance in files touched (no behavioural changes to auction price warnings).
- Added automated tests of listing method entry and cover-recommendation behavior, preserving candidate limit, low-confidence fallback and image order.

## Verification and safety

- **31 focused Jest tests passed** in five suites, including new dealer listing/cover tests.
- Existing **5 native cover-selection Node tests passed**.
- TypeScript `tsc --noEmit` passed after new listing-choice and style changes; check final rerun before commit.
- ESLint for changed files passed at final run; confirm after last edits.
- No live listing, paid checkout, auction bid, vehicle status or seller data was saved or changed. Opening edit screen was view-only.
- **Installed build 121**, app data, production website, and public Android download remain unchanged. The changes above are SOURCE ONLY; do not claim they're already visible on the user's installed app.
- No claim of 100%, 50% functional parity or pixel-level equivalence. A signed compatible QA APK and side-by-side post-change screenshots are mandatory before release.

## Outstanding for the next steps

- New DealerListingMethod, stepper, filter and card styling need emulator validation in a fresh compatible build without wiping app data.
- Full Step 1–4/5 entry, save-draft, edit, cover-photo upload, empty draft/rejected states and import/bulk import still need authenticated runtime testing. The account had zero drafts, so true draft-edit parity was not proved.
- Listed vehicle detail card spacing, price formatting, and web-only wizard mode switch differ.
- Do not perform mark-sold, paid promotions, auction bidding, fees or submission on production without explicit permission for a safe test case.
- **Next block on user's "proceed": 50–60% dealer bids, offers, purchases, handovers, services**, plus any unresolved dealer-page evidence that can be collected safely.
