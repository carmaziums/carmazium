---
phase: 11-listing-page-overhaul-category-badges-sticky-sidebar-ctas-dealer-verification-display-proximity-distance-on-all-listings
plan: "01"
subsystem: web-platform
tags: [shared-modules, location-context, vehicle-labels, backend-api]
dependency_graph:
  requires: []
  provides:
    - src/lib/vehicleLabels.ts (BODY_TYPE_LABELS, FUEL_TYPE_LABELS)
    - src/context/LocationContext.tsx (LocationProvider, useLocation)
    - backend listingCount in GET /listings/:slug seller
  affects:
    - src/components/features/CarCard.tsx (now imports from vehicleLabels)
    - src/app/layout.tsx (LocationProvider wraps app)
    - src/lib/listingApi.ts (Listing.seller type extended)
tech_stack:
  added: []
  patterns:
    - localStorage geo cache with TTL (carmazium_user_location key)
    - postcode geocoding via postcodes.io with 600ms debounce
    - Prisma _count select for computed seller listing count
key_files:
  created:
    - src/lib/vehicleLabels.ts
    - src/context/LocationContext.tsx
  modified:
    - src/components/features/CarCard.tsx
    - src/app/layout.tsx
    - backend/src/listings/listings.service.ts
    - src/lib/listingApi.ts
decisions:
  - LocationProvider placed inside CompareProvider to avoid context ordering issues
  - Same localStorage key (carmazium_user_location) reused from useUserLocation hook for cache hit on first render
  - listingCount mapped via (seller as any)._count?.listings to avoid Prisma type narrowing issues
  - return listingWithCount as any to satisfy existing Listing return type without schema migration
metrics:
  duration: "4 minutes"
  completed_date: "2026-06-21"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 4
---

# Phase 11 Plan 01: Shared Infrastructure Modules Summary

**One-liner:** Shared vehicleLabels maps, site-wide LocationContext with geo/postcode fallback, and backend listingCount via Prisma _count select — all prerequisites for Wave 2 and Wave 3 Phase 11 plans.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create vehicleLabels.ts, update CarCard imports | 655f9ec1 | src/lib/vehicleLabels.ts, src/components/features/CarCard.tsx |
| 2 | Create LocationContext.tsx, wire into root layout | d489ace2 | src/context/LocationContext.tsx, src/app/layout.tsx |
| 3 | Add listingCount to backend findBySlug + extend Listing.seller type | b4a244f4 | backend/src/listings/listings.service.ts, src/lib/listingApi.ts |

## Decisions Made

- **LocationProvider wrapping order:** LocationProvider sits inside CompareProvider (CompareProvider → LocationProvider → children). Either order is valid but inner placement is slightly more composable for future additions.
- **Cache key reuse:** `carmazium_user_location` key matches the existing `useUserLocation` hook exactly — users with cached geo data from the old hook get an instant location hit without a new geolocation prompt.
- **Prisma _count cast:** `(listing.seller as any)._count?.listings` avoids TypeScript narrowing failures on the Prisma inferred type; the `as any` cast is scoped to a single expression and doesn't affect downstream consumers.
- **Return type:** `return listingWithCount as any` satisfies the existing `Promise<Listing>` return signature without requiring a Prisma schema migration or return type widening across the service.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- tsc --noEmit: PASS (0 errors)
- BODY_TYPE_LABELS and FUEL_TYPE_LABELS exported from src/lib/vehicleLabels.ts: PASS
- CarCard.tsx no longer defines label maps locally: PASS
- LocationProvider exported from src/context/LocationContext.tsx: PASS
- useLocation exported from src/context/LocationContext.tsx: PASS
- layout.tsx wraps children with LocationProvider: PASS
- backend findBySlug seller include has _count.listings block: PASS
- listingCount mapped before return in findBySlug: PASS
- Listing.seller type includes listingCount?: number: PASS
