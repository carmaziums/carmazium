---
phase: 12-auction-enhancements-buy-it-now-instant-purchase-cancel-bid-fat-finger-window
plan: "04"
subsystem: auction-live-room
tags: [buy-it-now, seller-ui, auction, frontend]
dependency_graph:
  requires: ["12-03"]
  provides: ["BIN-UI-02"]
  affects: ["src/app/auctions/live/[id]/page.tsx"]
tech_stack:
  added: []
  patterns: ["role-conditional UI rendering", "shared loading state reuse", "useCallback async handlers"]
key_files:
  created: []
  modified:
    - src/app/auctions/live/[id]/page.tsx
decisions:
  - "Reused existing binLoading state for both confirm and decline operations — single loading flag is sufficient since only one action can be in-flight at a time"
  - "handleBinConfirm/handleBinDecline implemented as useCallback (not plain async functions) to match the rest of the component's memoised handler pattern"
  - "Seller panel uses same amber border/bg tokens as buyer banner for visual consistency; emerald for Accept (positive), slate for Decline (neutral)"
metrics:
  duration: "5 minutes"
  completed: "2026-06-21"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 12 Plan 04: Seller BIN Confirm/Decline UI Summary

One-liner: Seller can now accept or decline a pending Buy It Now request from the live auction room via an amber action banner with emerald Accept and slate Decline buttons.

## What Was Built

Added the missing seller-side BIN response UI to the live auction room (`src/app/auctions/live/[id]/page.tsx`). When a buyer triggers a BIN request and `binPending` becomes true, the seller now sees an amber action panel (instead of seeing nothing) with:

- A "Buy It Now Request" heading and explanatory copy
- An **Accept Buy It Now** button (emerald) calling `confirmBuyItNow(auction.id)` — ends the auction
- A **Decline** button (slate) calling `declineBuyItNow(auction.id)` — resumes bidding
- Shared `binLoading` state providing disabled/processing state on both buttons during in-flight calls

Buyer-facing path (`!isSeller && binPending`) is completely unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add seller BIN confirm/decline UI to live auction room | d054c76d | src/app/auctions/live/[id]/page.tsx |

## Verification

- `npx tsc --noEmit` — zero errors (no output)
- `confirmBuyItNow` and `declineBuyItNow` imported on line 22
- `handleBinConfirm` and `handleBinDecline` useCallback handlers added after `handleCancelBid`
- `binPending && isSeller` renders seller action panel at line 1448
- `binPending && !isSeller` still renders buyer info banner (unchanged)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/app/auctions/live/[id]/page.tsx` modified (commit d054c76d)
- [x] `confirmBuyItNow` and `declineBuyItNow` in import line
- [x] `handleBinConfirm` and `handleBinDecline` exist
- [x] `binPending && isSeller` renders seller action panel
- [x] Zero TypeScript errors from `npx tsc --noEmit`

## Self-Check: PASSED
