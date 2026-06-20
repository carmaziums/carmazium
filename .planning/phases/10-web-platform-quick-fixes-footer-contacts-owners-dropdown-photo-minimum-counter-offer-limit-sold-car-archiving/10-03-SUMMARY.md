---
phase: 10-web-platform-quick-fixes-footer-contacts-owners-dropdown-photo-minimum-counter-offer-limit-sold-car-archiving
plan: "03"
subsystem: ui
tags: [react, nextjs, counter-offer, negotiation, buyer-ui, seller-ui, countdown]

requires:
  - phase: 10-01
    provides: [counter-tracking-schema, buyer-re-counter, counterAttemptsBuyer, counterAttemptsSeller, counterExpiresAt, lastCounteredBy]

provides:
  - buyer counter-offer input in OutgoingOffersTab (PATCH /api/offers/:id/respond-counter)
  - "X counter-offers remaining" display for both buyer and seller
  - buyer locked state amber banner with 48h countdown timer
  - seller locked state amber banner with 48h countdown timer
  - seller counter area shown for COUNTERED+lastCounteredBy=BUYER (not just PENDING)
  - CountdownTimer shared helper component (inline in both files)

affects: [seller-offers, buyer-offers, negotiation-ux]

tech-stack:
  added: []
  patterns:
    - CountdownTimer component using useEffect+setInterval (60s tick, expires gracefully)
    - Derive isBuyerLocked/isSellerLocked from counterAttemptsBuyer/Seller >= 5
    - counterAmounts state map keyed by offer.id for multi-offer input handling
    - showSellerCounterArea condition covers PENDING and COUNTERED+lastCounteredBy=BUYER

key-files:
  created: []
  modified:
    - src/lib/listingApi.ts
    - src/app/dashboard/user/page.tsx
    - src/app/dashboard/seller/offers/page.tsx

key-decisions:
  - "Added counterAttemptsBuyer/Seller, counterExpiresAt, lastCounteredBy to LatestOffer interface in listingApi.ts — required for both pages to use backend fields"
  - "CountdownTimer inlined in both files (no shared component directory discovered) — acceptable for this phase per plan"
  - "Buyer counter input only shown when isBuyerTurn (lastCounteredBy === 'SELLER') and not locked — prevents double-counter"
  - "Seller counter area extended to cover COUNTERED+lastCounteredBy=BUYER so seller can respond to buyer re-counters"

patterns-established:
  - "CountdownTimer: useEffect with setInterval(60000), diff <= 0 shows Expired, returns h/m string"
  - "Lock condition: counterAttemptsBuyer >= 5 (buyer), counterAttemptsSeller >= 5 (seller)"
  - "Remaining count: 5 - attempts; plural/singular grammar handled with ternary"

requirements-completed: [COUNTER-04, COUNTER-05, COUNTER-06, COUNTER-07]

duration: 18min
completed: 2026-06-21
---

# Phase 10 Plan 03: Counter-Offer Limit UI Summary

**Buyer counter-offer input, "X remaining" count display, and amber locked-state banners with 48h countdown timer added to both buyer (OutgoingOffersTab) and seller (OfferRow) offer UIs**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-21T00:00:00Z
- **Completed:** 2026-06-21T00:18:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Buyer can now submit a counter-offer amount via input in the OutgoingOffersTab — previously only Accept/Reject was available; calls PATCH `/api/offers/:id/respond-counter` with `{ status: 'COUNTERED', counterAmount }`
- Both buyer and seller dashboards display "X counter-offers remaining" during live negotiation
- Locked-state amber banners with 48h countdown timer surfaced for both parties when limit (5) is reached
- Seller counter area extended to cover buyer re-counter path (COUNTERED + lastCounteredBy=BUYER) in addition to initial PENDING offers
- TypeScript passes clean (0 errors) — new Offer fields typed correctly via LatestOffer interface extension

## Task Commits

1. **Task 1: Buyer offer thread — re-counter input, remaining count, locked state** - `331bd9d2` (feat)
2. **Task 2: Seller offers page — remaining count, locked state banner** - `cb4b5967` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/listingApi.ts` — Added `counterAttemptsBuyer?`, `counterAttemptsSeller?`, `counterExpiresAt?`, `lastCounteredBy?` to `LatestOffer` interface
- `src/app/dashboard/user/page.tsx` — CountdownTimer helper; counterAmounts state map; handleBuyerCounter(); remaining count display; buyer counter input; locked banner; preserved Accept/Decline/Message buttons
- `src/app/dashboard/seller/offers/page.tsx` — CountdownTimer helper; sellerRemaining/isSellerLocked derived values; showSellerCounterArea condition; remaining count display; locked amber banner replacing counter input; COUNTERED+lastCounteredBy=BUYER path with seller action buttons

## Decisions Made

- Added the four new offer fields to `LatestOffer` (not `Offer`) so they're available everywhere LatestOffer is used
- CountdownTimer inlined in both files rather than extracting to a shared component — no shared UI component directory was found and the plan explicitly allowed this
- Buyer counter input only shows when `lastCounteredBy === 'SELLER'` (it's the buyer's turn) — prevents buyer from countering when seller hasn't responded yet
- Seller counter area now wraps both PENDING (initial offer) and COUNTERED+lastCounteredBy=BUYER (buyer re-countered) states under `showSellerCounterArea`

## Deviations from Plan

None — plan executed exactly as written. The `LatestOffer` interface extension was an implicit requirement (fields didn't exist in the type) handled as Rule 3 (blocking issue) but was a trivial prerequisite, not a meaningful deviation.

## Issues Encountered

None. TypeScript passed clean on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Counter-offer limit UX is now complete end-to-end (backend from Plan 01, UI from this plan)
- Both parties can see remaining attempt counts and understand lock states
- Ready for Plan 04 (sold car archiving / next plan in phase 10)

---
*Phase: 10-web-platform-quick-fixes*
*Completed: 2026-06-21*
