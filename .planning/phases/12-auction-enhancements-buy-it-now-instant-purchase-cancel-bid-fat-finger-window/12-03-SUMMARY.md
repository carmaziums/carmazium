---
phase: 12-auction-enhancements-buy-it-now-instant-purchase-cancel-bid-fat-finger-window
plan: "03"
subsystem: ui
tags: [react, next.js, typescript, auction, websocket, framer-motion, svg]

# Dependency graph
requires:
  - phase: 12-01
    provides: BIN trigger/confirm/decline endpoints + bin:pending socket event
  - phase: 12-02
    provides: PATCH /bids/:id/cancel endpoint + bid:cancelled socket event

provides:
  - auctionApi.ts BIN types and 4 API functions (triggerBuyItNow, confirmBuyItNow, declineBuyItNow, cancelBid)
  - Live auction room BIN card + confirmation modal + pending banner + cancel countdown button
  - Listing detail sidebar BIN section with Buy Now CTA
  - Dealer auction creation form optional BIN price field

affects:
  - Phase 13 (listing form enhancements — BIN field already wired in dealer form)
  - Phase 15 (delivery system — live auction room sidebar patterns)
  - Any phase touching auctionApi.ts or live auction room page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AnimatePresence + motion.div inline modal pattern (no separate component)"
    - "setInterval cancel countdown depleting from 120000ms in 100ms ticks"
    - "SVG arc countdown (strokeDashoffset calculated from cancelWindowMs/120000 ratio)"
    - "reserveMet derived via useMemo from topBid.amount vs auction.reservePrice"
    - "showBin compound guard: isLive && !isSeller && buyItNowPrice && !reserveMet && !binPending"

key-files:
  created: []
  modified:
    - src/lib/auctionApi.ts
    - src/app/auctions/live/[id]/page.tsx
    - src/app/buy-cars/[slug]/page.tsx
    - src/app/dashboard/dealer/auctions/page.tsx

key-decisions:
  - "BIN card placed between Bid Controls and Trust Note in live auction room right sidebar"
  - "Cancel countdown uses setInterval at 100ms ticks (not setTimeout) for smooth SVG arc animation"
  - "BIN confirmation modal is inline AnimatePresence (not a separate component) — matches existing acceptingBid overlay pattern"
  - "handleBinFromDetail redirects buyer to /auctions/live/:id after triggerBuyItNow — live room is the confirmation UX"
  - "buyItNowPrice omitted from POST payload entirely (not sent as 0) when field is blank or zero"

patterns-established:
  - "SVG arc countdown: r=10 circle, strokeDasharray = 2*PI*10, strokeDashoffset = dashArray*(1 - elapsed/total)"
  - "Cancel button guard: bid.bidId === cancelableBidId && user?.id === bid.bidderId && !isSeller"
  - "BIN pending state initialised from auctionData.buyItNowPendingBuyerId on API load, then updated via bin:pending socket event"

requirements-completed:
  - BIN-UI-01
  - BIN-UI-02
  - CANCEL-UI-01

# Metrics
duration: 45min
completed: 2026-06-21
---

# Phase 12 Plan 03: Auction Enhancements Frontend UI Summary

**BIN card + confirmation modal + cancel countdown button wired to Phase 12 backend endpoints across live auction room, listing detail sidebar, and dealer auction creation form**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-21T00:10:00Z
- **Completed:** 2026-06-21
- **Tasks:** 3 auto + 1 checkpoint (human-verified, approved)
- **Files modified:** 4

## Accomplishments

- Extended `auctionApi.ts` with 3 BIN interface fields, `buyItNowPrice` on `CreateAuctionRequest`, and 4 new exported async functions (`triggerBuyItNow`, `confirmBuyItNow`, `declineBuyItNow`, `cancelBid`) matching existing error-handling patterns
- Live auction room (`/auctions/live/[id]`) receives full BIN and cancel UI: BIN card in right sidebar with AnimatePresence confirmation modal, BIN pending banner, SVG arc cancel countdown button visible only to the bid owner (2-minute window, 100ms tick interval), and socket handlers for `bin:pending` and `bid:cancelled` events
- Listing detail page (`/buy-cars/[slug]`) shows BIN section in right sidebar for active auction listings below reserve; "Buy Now" calls `triggerBuyItNow` then routes buyer to live auction room
- Dealer auction creation form gains optional "Buy It Now Price" input; `buyItNowPrice` included in POST payload only when value > 0
- Human checkpoint approved: all UI verified in browser, TypeScript passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend auctionApi.ts — types + API functions** - `48a39829` (feat)
2. **Task 2: Live auction room BIN card + cancel countdown** - `62fc8e7c` (feat)
3. **Task 3: Listing detail BIN section + dealer form BIN field** - `dfa33de6` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `src/lib/auctionApi.ts` — Added `buyItNowPrice?`, `buyItNowPendingBuyerId?`, `buyItNowPendingAt?` to Auction interface; `buyItNowPrice?` to `CreateAuctionRequest`; exported `triggerBuyItNow`, `confirmBuyItNow`, `declineBuyItNow`, `cancelBid`
- `src/app/auctions/live/[id]/page.tsx` — BIN card with confirmation modal, BIN pending banner, SVG arc cancel countdown button, `bin:pending` and `bid:cancelled` socket handlers, `reserveMet` useMemo, `showBin` derived state
- `src/app/buy-cars/[slug]/page.tsx` — BIN section in listing detail right sidebar, `reserveMet` derived value, `handleBinFromDetail` routing to live auction room
- `src/app/dashboard/dealer/auctions/page.tsx` — Optional BIN price input below Reserve Price; conditionally included in POST payload

## Decisions Made

- BIN card placed between Bid Controls and Trust Note in right sidebar — natural purchase funnel position without disrupting bidding controls
- Cancel countdown uses `setInterval` at 100ms ticks (not `setTimeout`) for smooth continuous SVG arc animation
- BIN confirmation modal is inline `AnimatePresence` (not extracted to a separate component) — consistent with the existing `acceptingBid` overlay pattern in the same file
- `handleBinFromDetail` redirects to `/auctions/live/:id` after triggering BIN — the live room provides the pending/confirmed UX rather than duplicating it in the detail page
- `buyItNowPrice` omitted from POST body entirely (not sent as `0`) when input is blank — clean null vs. disabled distinction for the backend

## Deviations from Plan

None - plan executed exactly as written. All BIN fields, API functions, UI components, socket handlers, and form fields matched the plan spec. TypeScript passed with zero errors across all four modified files.

## Issues Encountered

None. The live auction page was already structured with AnimatePresence imported and a clear right-sidebar card order, making surgical insertion straightforward. The dealer form's existing state pattern (`React.useState<string>` for numeric fields) was followed for `buyItNowPrice`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 12 complete: all three plans (BIN backend, cancel backend, frontend UI) are done; BIN and cancel-bid features are fully end-to-end
- Phase 13 (listing form enhancements) can proceed immediately — no dependencies on this plan beyond the existing `listingApi.ts` patterns
- The `buyItNowPrice` field in the dealer auction creation form is ready; backend migration SQL from Plan 12-01 already added the column
- Pre-existing TypeScript errors in `GlobalDrawer.tsx` and `DealerInventoryScreen.tsx` remain deferred (out of scope, documented in STATE.md)

---
*Phase: 12-auction-enhancements-buy-it-now-instant-purchase-cancel-bid-fat-finger-window*
*Completed: 2026-06-21*
