---
phase: 09-mobile-production-parity
plan: "02"
subsystem: payments
tags: [stripe, react-native, payment-sheet, hpi, stripe-connect, expo-linking]

# Dependency graph
requires:
  - phase: 09-mobile-production-parity-01
    provides: storageHelper, sellWizardStore, SellCarFlowScreen POST /listings wired

provides:
  - Listing fee Payment Sheet (BASIC £1 / STANDARD £10 / PREMIUM £25) gating POST /listings/:id/publish
  - HPI check Payment Sheet (£9.99) on VehicleDetailScreen with inline report display
  - Auction buyer fee Payment Sheet (£125) on AuctionCompleteScreen (pre-existing from prior wave)
  - Stripe Connect onboarding CTA in EarningsScreen (POST /users/stripe-connect/onboard)

affects:
  - 09-mobile-production-parity-03
  - 09-mobile-production-parity-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stripe Payment Sheet with explicit appearance.colors (dark theme: background #111116, primary #DC1F26) — never use style: 'alwaysDark'"
    - "createPaymentSheet({ listingId, amount, type: 'COMMISSION', currency: 'gbp' }) — amounts in POUNDS not pence"
    - "presentPaymentSheet() error.code === 'Canceled' treated as user dismiss, not error"
    - "Stripe Connect: POST /users/stripe-connect/onboard -> Linking.openURL(res.url)"

key-files:
  created: []
  modified:
    - "carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx"
    - "carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx"
    - "carmazium app/carmazium app/src/screens/seller/EarningsScreen.tsx"

key-decisions:
  - "Listing fee payment required for ALL classified tiers including BASIC (£1) — consistent UX, no special-casing"
  - "HPI report results shown inline below button (not just modal) after payment — plan requirement"
  - "AuctionCompleteScreen already had full buyer fee Stripe implementation — no changes needed"
  - "expo-file-system/legacy import fixed in EarningsScreen (SDK 54 requirement, pre-existing bug)"

patterns-established:
  - "Payment gate pattern: triggerListingFeePayment returns bool (true=paid, false=cancelled), throws on error"
  - "HPI inline card: hpiData state shows results below button; modal still available for full details"

requirements-completed: []

# Metrics
duration: 25min
completed: "2026-06-20"
---

# Phase 09 Plan 02: Wave 2 — Stripe Native Payments Summary

**Native Stripe Payment Sheet for listing fees (£1/£10/£25), HPI checks (£9.99) with inline report display, and Stripe Connect payout onboarding — all using dark-theme appearance.colors**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-20T00:38:00Z
- **Completed:** 2026-06-20T00:45:04Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- SellCarFlowScreen: listing fee Payment Sheet gates `POST /listings/:id/publish` for all classified badge tiers; cancel shows "draft saved" alert; auction tier publishes without fee
- VehicleDetailScreen: "Check HPI (£9.99)" presents Payment Sheet before fetching HPI data; results render inline with key fields (stolen, finance, write-off, mileage anomaly); "View Full Report" opens existing modal
- EarningsScreen: "Set up Payouts with Stripe" button calls `POST /users/stripe-connect/onboard` and opens returned URL in system browser via `Linking.openURL`
- AuctionCompleteScreen buyer fee (£125) was already fully implemented — confirmed as no-op

## Task Commits

1. **Task 09-02-01: Listing fee Payment Sheet** - `90002c93` (feat)
2. **Task 09-02-02: HPI Payment Sheet + inline report** - `3d234e3c` (feat)
3. **Task 09-02-03: Stripe Connect onboarding** - `6366f541` (feat)

## Files Created/Modified

- `carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx` — Added useStripe + createPaymentSheet imports, triggerListingFeePayment function, payment gate in handlePublish
- `carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx` — Replaced free HPI fetch with payment-gated handleHpiCheck; inline hpiInlineCard component; ErrorBanner on failure
- `carmazium app/carmazium app/src/screens/seller/EarningsScreen.tsx` — Added Stripe Connect section with handleStripeConnect, payoutsCard UI, expo-file-system/legacy fix

## Decisions Made

- All classified tiers (including BASIC at £1) go through the Payment Sheet for consistency — no free-path special-casing
- HPI data displayed inline after payment (per plan spec) rather than only in modal — modal still accessible via "View Full Report"
- AuctionCompleteScreen buyer fee was already complete; confirmed working and left untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed expo-file-system/legacy import in EarningsScreen**
- **Found during:** Task 09-02-03 (EarningsScreen modification)
- **Issue:** `import * as FileSystem from 'expo-file-system'` causes TS errors in SDK 54 (documentDirectory and EncodingType moved to /legacy subpath)
- **Fix:** Changed to `import * as FileSystem from 'expo-file-system/legacy'`
- **Files modified:** `carmazium app/carmazium app/src/screens/seller/EarningsScreen.tsx`
- **Verification:** TS errors for EarningsScreen resolved; only pre-existing GlobalDrawer.tsx and DealerInventoryScreen.tsx errors remain
- **Committed in:** `6366f541` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix)
**Impact on plan:** Pre-existing bug that was deferred in Plan 01 — fixed as it was in the file being modified. No scope creep.

## Issues Encountered

- AuctionCompleteScreen task was already complete from prior work — confirmed correct implementation (useStripe, createPaymentSheet, dark appearance, handlePayFee) and no changes needed.

## Next Phase Readiness

- All Stripe Payment Sheets implemented with consistent dark theme
- Listing publish flow complete end-to-end: create → pay → publish
- Wave 3 (Dealer KYC) can proceed — already implemented per git log

---
*Phase: 09-mobile-production-parity*
*Completed: 2026-06-20*
