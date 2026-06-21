---
phase: "15"
plan: "04"
subsystem: delivery-ui
tags: [delivery, buyer-dashboard, seller-dashboard, next-js-api, google-maps]
dependency_graph:
  requires: ["15-02", "15-03"]
  provides: ["buyer-delivery-flow", "seller-delivery-actions", "delivery-distance-api"]
  affects: ["src/app/dashboard/buyer/offers/page.tsx", "src/app/dashboard/seller/offers/page.tsx", "src/app/api/delivery-distance/route.ts"]
tech_stack:
  added: []
  patterns: ["debounced-fetch", "inline-status-badge", "per-row-delivery-section", "server-side-google-maps"]
key_files:
  created:
    - src/app/api/delivery-distance/route.ts
  modified:
    - src/app/dashboard/buyer/offers/page.tsx
    - src/app/dashboard/seller/offers/page.tsx
decisions:
  - "Delivery row rendered as a separate <tr> below each offer row in the buyer table for visual separation"
  - "Postcode debounce at 600ms matches plan spec; minimum 3 chars before triggering API call"
  - "Outside-radius error is shown inline below postcode field (no modal)"
  - "StatusDeliveryBadge reuses same pill pattern as StatusBadge (border + rounded-full + xs font-bold)"
  - "Seller delivery row indented with pl-14 to align with buyer avatar offset in OfferRow"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-06-21"
  tasks_completed: 2
  files_changed: 3
---

# Phase 15 Plan 04: Buyer + Seller Delivery UI Summary

**One-liner:** Buyer delivery request form with live Google Maps cost preview and status badges; seller Accept/Decline panel — all wired to deliveryApi.ts from plan 15-02.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Next.js API route /api/delivery-distance | 29ca961d | src/app/api/delivery-distance/route.ts |
| 2 | Buyer offers page delivery CTA + form + status badge; seller delivery tag | c2de14dc | src/app/dashboard/buyer/offers/page.tsx, src/app/dashboard/seller/offers/page.tsx |

## What Was Built

### Task 1 — /api/delivery-distance route (already committed as 29ca961d)

Server-side Next.js GET handler that proxies Google Maps Distance Matrix API. Accepts `originLat`, `originLng`, `postcode`, `pricePerMile` query params. Returns `{ distanceMiles, estimatedCostGbp }` on success; `{ error: 'invalid_postcode' }` on 400; `{ error: 'service_error' }` on missing API key or network failure. GOOGLE_MAPS_API_KEY is read from `process.env` — never exposed to the browser.

### Task 2 — Buyer offers page (c2de14dc)

- `DeliveryRequestForm` local component: street/city/postcode/notes fields. Postcode field calls `/api/delivery-distance` with 600ms debounce (minimum 3 chars). Shows "Estimated cost: £X (Y mi)" below postcode, or "Cost: TBD" when `deliveryPricePerMile` is not set. Outside-radius guard shows inline error and disables submit.
- `StatusDeliveryBadge` component: renders amber (PENDING), green (ACCEPTED/COMPLETED), red (DECLINED), grey (CANCELLED) pill with Truck icon and human-readable label.
- Per-offer delivery section row rendered as a separate `<tr className="bg-slate-800/30">` below each offer row when `listing.deliveryAvailable` is true.
- Cancel request button shown for PENDING; Mark as received shown for ACCEPTED.
- `myDeliveryRequests` fetched on mount via `getMyDeliveryRequests()` alongside existing offer fetch; refreshed after each action via `refreshDeliveryRequests` callback.

### Task 2 — Seller offers page (c2de14dc)

- `receivedDeliveryRequests` state fetched on mount via `getReceivedDeliveryRequests()`.
- Per-offer delivery row: `<div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 pl-14">` with Truck icon, status text, and Accept/Decline underline buttons for PENDING state.
- `handleAcceptDelivery` / `handleDeclineDelivery` handlers call `acceptDeliveryRequest` / `declineDeliveryRequest` then refresh state and show toast.
- `refreshDeliveryRequests` callback used to avoid stale closures.

## Deviations from Plan

None — plan executed exactly as written. All three files match the plan's specification precisely. Task 1 had already been committed (29ca961d) during wave 2 execution; Task 2 uncommitted changes were staged and committed as c2de14dc.

## Verification

TypeScript: `npx tsc --noEmit` — zero errors (no output). Pre-existing GlobalDrawer.tsx and DealerInventoryScreen.tsx errors remain deferred per prior decisions.

## Self-Check: PASSED

- src/app/api/delivery-distance/route.ts: FOUND (committed 29ca961d)
- src/app/dashboard/buyer/offers/page.tsx: FOUND (committed c2de14dc)
- src/app/dashboard/seller/offers/page.tsx: FOUND (committed c2de14dc)
- TypeScript: zero errors
