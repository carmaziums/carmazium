---
phase: 11-listing-page-overhaul-category-badges-sticky-sidebar-ctas-dealer-verification-display-proximity-distance-on-all-listings
plan: "03"
subsystem: web-frontend
tags: [distance-filter, location-context, search, seller-profile, kyc, trust]
dependency_graph:
  requires: [11-01]
  provides: [distance-filter-search, kyc-badge-seller-profile]
  affects: [src/app/search/page.tsx, "src/app/seller/[id]/page.tsx"]
tech_stack:
  added: []
  patterns: [LocationContext migration, client-side Haversine post-filter, closest-first sort]
key_files:
  created: []
  modified:
    - src/app/search/page.tsx
    - "src/app/seller/[id]/page.tsx"
decisions:
  - Distance filter is client-side post-filter (not API param) to avoid API pagination/count mismatch
  - Filtered results label replaces Showing X of Y count when distance chip active
  - KYC badge always shown in seller profile header (no conditional check — trust signal applies universally)
  - totalListings prominent card added above existing Seller Stats box (not replacing StatRow)
metrics:
  duration: "2 minutes"
  completed_date: "2026-06-21"
  tasks_completed: 2
  files_modified: 2
---

# Phase 11 Plan 03: Distance Filter + KYC Badge Summary

**One-liner:** LocationContext migration on search page with 5-chip Haversine distance filter and postcode fallback; emerald KYC badge and prominent listing count card on seller profile.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Search page — LocationContext migration + distance filter chips + client-side filter | a647103a | src/app/search/page.tsx |
| 2 | Seller profile page — KYC badge + prominent totalListings | 2166d7bd | src/app/seller/[id]/page.tsx |

## What Was Built

### Task 1: Search Page Distance Filter

- Replaced `useUserLocation` import with `useLocation` from LocationContext
- Added `maxDistanceMi: number | null` to `FilterState` interface and `INITIAL_FILTERS`
- Added `DISTANCE_CHIPS = [10, 25, 50, 100, 200] as const` constant
- Distance filter section in sidebar: postcode fallback input (visible when lat is null), 5 chip buttons, current postcode label
- `fetchListings` now applies client-side Haversine post-filter and closest-first sort when `maxDistanceMi` is set
- Count display shows "Filtered results (N within X mi)" instead of "Showing N of Y" when distance chip is active
- Active filter tag "Within X mi" with clear button
- Both CarCard `distanceMi` props updated to use `userLocation?.lat && userLocation?.lng` null-safe guards (LocationState.lat can be null, unlike the old hook's undefined)
- `pushFiltersToUrl` updated to skip `null` values (same as `undefined`/`''`)

### Task 2: Seller Profile Page

- Added emerald KYC Verified badge (ShieldCheck, 20px, `text-emerald-400`, emerald border) in profile header identity section below the reliability/rating pills
- Added prominent `totalListings` stat card (Car icon + 2xl font-black white count + "Active Listings" eyebrow) in left sidebar above the Seller Stats box
- Existing `StatRow` for Active Listings kept in place (different context — inside the stats grid)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Created files exist
- Not applicable (no new files created)

### Commits exist
- a647103a: feat(11-03): search page — LocationContext migration, distance filter chips, client-side filter + sort
- 2166d7bd: feat(11-03): seller profile — KYC verified badge + prominent totalListings count card

## Self-Check: PASSED
