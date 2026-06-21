---
phase: "15"
plan: "05"
subsystem: "Buyer Discovery — Delivery Badges & Filter"
tags: [delivery, search, car-card, listing-detail, filter, badge]
dependency_graph:
  requires:
    - "15-03"  # delivery fields on Listing + ListingFilters
    - "15-04"  # /api/delivery-distance route
  provides:
    - "Emerald delivery chip on CarCard"
    - "deliveryAvailable filter toggle on search page"
    - "Delivery availability section in listing detail sidebar"
  affects:
    - "src/components/features/CarCard.tsx"
    - "src/app/search/page.tsx"
    - "src/app/buy-cars/[slug]/page.tsx"
    - "src/app/HomeClient.tsx"
tech_stack:
  added: []
  patterns:
    - "Inline IIFE for conditional sidebar sections avoiding extra component defs"
    - "useEffect + fetch to /api/delivery-distance for buyer proximity hint"
    - "FilterState boolean field with URL param coercion (=== 'true') and FilterSection toggle"
key_files:
  created: []
  modified:
    - "src/components/features/CarCard.tsx"
    - "src/app/search/page.tsx"
    - "src/app/buy-cars/[slug]/page.tsx"
    - "src/app/HomeClient.tsx"
decisions:
  - "Used inline IIFE in JSX for the delivery sidebar section to derive isOutsideRadius without adding a new component"
  - "Sidebar distance check is informational only — authoritative radius check happens server-side on delivery request submission"
  - "deliveryAvailable filter uses === 'true' string coercion for URL param (not JSON.parse) per RESEARCH.md Pitfall 4"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-06-21"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 15 Plan 05: Buyer Delivery Discovery Surfaces Summary

Emerald delivery chip on CarCard, delivery filter toggle on search page, and delivery availability section in listing detail sidebar — all buyer-facing discovery surfaces for delivery are complete.

## What Was Built

### Task 1: CarCard delivery badge + search page delivery filter

**CarCard.tsx**
- Added `Truck` import from lucide-react
- Added `deliveryAvailable?: boolean` prop to `CarCardProps` interface and destructured in function signature
- Rendered emerald `Delivery` chip (`bg-emerald-500/15 text-emerald-300 border border-emerald-500/30`) with `Truck size={11}` after the distance/location chip in the specs row
- Prop is optional (falsy = no chip rendered) — non-breaking addition

**search/page.tsx**
- Added `Truck` to lucide-react import
- Added `deliveryAvailable: boolean` to `FilterState` interface and `deliveryAvailable: false` to `INITIAL_FILTERS`
- Added URL param hydration: `deliveryAvailable: p('deliveryAvailable') === 'true'`
- Added active filter count increment: `if (appliedFilters.deliveryAvailable) count++`
- Added `buildApiFilters` mapping: `if (state.deliveryAvailable) f.deliveryAvailable = true`
- Added `FilterSection` titled "Delivery" with toggle button (emerald active state)
- Added `FilterTag` for "Delivery available" with remove handler calling `clearFilter({ deliveryAvailable: false })`
- Passed `deliveryAvailable={listing.deliveryAvailable ?? false}` to both featured listings and main results `<CarCard>` call sites

**HomeClient.tsx**
- Passed `deliveryAvailable={listing.deliveryAvailable ?? false}` to `<CarCard>` — listing source already has delivery fields from plan 15-03

### Task 2: Listing detail sidebar delivery availability section

**buy-cars/[slug]/page.tsx**
- Added `Truck` to lucide-react import
- Added `deliveryDistanceInfo` state: `React.useState<{ distanceMiles: number } | null>(null)`
- Added `useEffect` that calls `/api/delivery-distance` using buyer's GPS `postcode` from `useLocation()` context when `listing.deliveryAvailable`, `listing.deliveryMaxMiles`, `listing.latitude`, `listing.longitude`, and `userLoc.postcode` are all set
- `isOutsideRadius` derived inline in JSX using IIFE pattern
- Three render states:
  - **Hidden**: `listing.deliveryAvailable` is false/null — renders nothing
  - **In-radius (or no radius/postcode)**: emerald card with price per mile, max radius, and CTA note
  - **Out-of-radius**: greyed card (`opacity-60`) with "Delivery not available to your location" and seller's mile radius

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- `src/components/features/CarCard.tsx` — modified, contains `deliveryAvailable` prop and Truck chip
- `src/app/search/page.tsx` — modified, contains `deliveryAvailable` in FilterState and Delivery FilterSection
- `src/app/buy-cars/[slug]/page.tsx` — modified, contains delivery sidebar section
- `src/app/HomeClient.tsx` — modified, passes `deliveryAvailable` to CarCard

### Commits Exist
- `bab2b45c` — feat(15-05): add delivery badge to CarCard and delivery filter to search page
- `54ff31f8` — feat(15-05): add delivery availability section to listing detail sidebar

### TypeScript
- `npx tsc --noEmit` — zero errors (output was empty)
