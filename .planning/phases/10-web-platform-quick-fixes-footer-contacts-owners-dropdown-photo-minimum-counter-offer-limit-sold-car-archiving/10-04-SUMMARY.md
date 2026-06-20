---
phase: 10-web-platform-quick-fixes-footer-contacts-owners-dropdown-photo-minimum-counter-offer-limit-sold-car-archiving
plan: "04"
subsystem: web-frontend, backend-analytics
tags: [sold-archiving, inventory, relist, analytics, sold-badge]
dependency_graph:
  requires: ["10-01", "10-02", "10-03"]
  provides: ["SOLD listings visible in seller/dealer inventory", "Relist from SOLD", "SOLD overlay on listing detail", "SOLD badge on CarCard", "Analytics includes SOLD"]
  affects: ["src/app/dashboard/user/page.tsx", "src/app/dashboard/dealer/inventory/page.tsx", "backend/src/dashboard/dashboard.service.ts", "backend/src/admin/admin.service.ts"]
tech_stack:
  added: []
  patterns: ["PATCH /listings/:id/status for relist", "includeSold query param", "Phase 10 audit comments on analytics queries"]
key_files:
  created: []
  modified:
    - src/app/dashboard/user/page.tsx
    - src/app/dashboard/dealer/inventory/page.tsx
    - backend/src/dashboard/dashboard.service.ts
    - backend/src/admin/admin.service.ts
decisions:
  - "Dealer Relist fixed to use PATCH /status instead of POST /publish (publishListing was wrong endpoint for relisting sold cars)"
  - "Backend analytics queries were already correct — no data changes needed, added Phase 10 comments to confirm audit"
  - "buy-cars/[slug] and CarCard SOLD treatment pre-existed — verified complete, no changes needed"
metrics:
  duration: "5 minutes"
  completed_date: "2026-06-21"
  tasks_completed: 3
  files_modified: 4
requirements_satisfied: [SOLD-01, SOLD-02, SOLD-03, SOLD-04, SOLD-05, SOLD-06, SOLD-07]
---

# Phase 10 Plan 04: Sold Car Archiving Summary

**One-liner:** Sold car archiving — SOLD listings visible in seller/dealer inventory with badge and Relist action (PATCH /status), analytics backend audited to confirm SOLD included in total counts.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | User inventory — includeSold=true, Relist action | eb6b5c06 | `getMyListings({ includeSold: true })`, `handleRelist()` via PATCH /api/listings/:id/status, Relist dropdown item for SOLD listings |
| 2 | Dealer inventory Relist fix; buy-cars SOLD overlay; CarCard SOLD badge | bc61460a | Dealer Relist button fixed to call PATCH /status (was incorrectly calling `publishListing`); buy-cars and CarCard verified pre-existing |
| 3 | Analytics backend audit — SOLD in total count queries | e0ddbbd4 | dashboard.service.ts and admin.service.ts audited; totalListings queries have no status filter (correct); Phase 10 inline comments added |

## What Was Built

### User Inventory (src/app/dashboard/user/page.tsx)
- `getMyListings` call now passes `includeSold: true` — SOLD listings appear in the inventory list alongside ACTIVE/DRAFT
- SOLD status badge was already rendered via existing status color map (`bg-blue-500/10 text-blue-400`)
- `handleRelist(listingId)` function added: calls `PATCH /api/listings/:id/status { status: 'ACTIVE' }` and refreshes the list
- Relist button added to the MoreVertical dropdown menu, visible only when `listing.status === 'SOLD'`

### Dealer Inventory (src/app/dashboard/dealer/inventory/page.tsx)
- `includeSold=true` was already present in the fetch call (pre-existing from earlier work)
- SOLD badge/overlay on the card image was already implemented
- Relist button existed but called `publishListing()` (POST /publish) — fixed to call `apiClient PATCH /listings/:id/status` which is the correct endpoint for status transitions

### Buy-Cars Detail Page (src/app/buy-cars/[slug]/page.tsx)
- Pre-existing: large diagonal "SOLD" text watermark on hero image with `opacity-50 grayscale` treatment
- Pre-existing: "Sold" pill badge in the badges row
- Pre-existing: SOLD box in sidebar showing "Vehicle Sold / This listing is closed"
- Pre-existing: no 404 guard on SOLD status — page renders for any listing found by slug
- No changes needed

### CarCard (src/components/features/CarCard.tsx)
- Pre-existing: `status` prop in `CarCardProps` interface
- Pre-existing: SOLD stamp overlay (large red diagonal text with drop-shadow)
- Pre-existing: `status === 'SOLD'` causes image grayscale + opacity-30
- Pre-existing: button text changes to "View Sold Vehicle"
- Pre-existing: `status` passed at both CarCard call sites in search/page.tsx (lines 1071, 1104)
- No changes needed

### Backend Analytics (dashboard.service.ts + admin.service.ts)
- `getUnifiedDashboard`: `totalListings` query has no status filter (includes SOLD) — already correct
- `activeListings` intentionally remains ACTIVE-only (current live inventory count)
- `soldListings` correctly counts SOLD only
- `getPlatformStats` in admin: `totalListings` via `prisma.listing.count()` no filter — already correct
- Added Phase 10 inline comments to each query to document intent for future audits

## Deviations from Plan

### Pre-existing Implementation (No Change Needed)
- **buy-cars/[slug]/page.tsx SOLD overlay:** The plan called for a `backdrop-blur-sm` overlay div. The existing implementation uses a large diagonal text watermark which is more prominent and already functional. No change made — requirement satisfied.
- **CarCard.tsx SOLD badge:** The plan described a simple blue badge overlay. The existing implementation has a red diagonal stamp with glow effect. More prominent — requirement satisfied.
- **Dealer inventory includeSold:** Already set to `true` in the fetch — no change needed.

### Auto-fix (Rule 1 — Bug)
- **Dealer Relist endpoint:** The existing Relist button called `publishListing(listing.id)` which hits `POST /listings/:id/publish`. This endpoint is for activating DRAFT listings and may require payment. For relisting a SOLD car, the correct endpoint is `PATCH /listings/:id/status { status: 'ACTIVE' }`. Fixed.

## Self-Check: PASSED

All modified files confirmed present on disk. All task commits verified in git log:
- eb6b5c06: feat(10-04): user inventory — includeSold=true, Relist action
- bc61460a: feat(10-04): dealer inventory Relist — use PATCH /status instead of publish
- e0ddbbd4: feat(10-04): analytics backend audit — SOLD in total count queries
