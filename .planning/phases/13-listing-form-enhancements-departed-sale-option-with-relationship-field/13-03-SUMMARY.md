---
phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field
plan: "03"
subsystem: ui
tags: [react-native, typescript, mobile, estate-sale, badge, vehicle-card]

# Dependency graph
requires:
  - phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field
    provides: "isDepartedSale field on web Listing type and Estate chip on web buy-cars page (Plan 02)"
provides:
  - "isDepartedSale?: boolean on CarListing interface"
  - "isDepartedSale?: boolean | null on ApiListing interface"
  - "mapApiListingToCarListing maps isDepartedSale field"
  - "Grey ESTATE badge on VehicleCard (imageBadgeRow)"
  - "Grey ESTATE badge on HorizontalVehicleCard (absolute top-right)"
affects: [mobile-listing-display, vehicle-cards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Estate badge uses rgba(160,160,171,0.20) background and Colors.textSecondary text — neutral grey, not trust-critical"
    - "HorizontalVehicleCard badge is absolute-positioned (top:8, right:8) to match premiumBadge pattern"
    - "VehicleCard badge flows inline in imageBadgeRow flex row after isNew badge"

key-files:
  created: []
  modified:
    - "carmazium app/carmazium app/src/lib/listingsApi.ts"
    - "carmazium app/carmazium app/src/data/listings.ts"
    - "carmazium app/carmazium app/src/components/VehicleCard.tsx"
    - "carmazium app/carmazium app/src/components/HorizontalVehicleCard.tsx"

key-decisions:
  - "Estate badge uses neutral grey rgba(160,160,171,0.20) — intentionally non-trust-critical, matches web Estate chip colour intent"
  - "HorizontalVehicleCard places badge absolute top-right (not inline) to fit the compact 90x90 image area without overlapping premiumBadge (top-left)"

patterns-established:
  - "isDepartedSale flows: ApiListing → mapApiListingToCarListing → CarListing → component"

requirements-completed: [MOBILE-01]

# Metrics
duration: 2min
completed: 2026-06-21
---

# Phase 13 Plan 03: Mobile Estate Badge Summary

**isDepartedSale threaded from ApiListing through CarListing into neutral grey ESTATE badges on VehicleCard and HorizontalVehicleCard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-21T00:29:42Z
- **Completed:** 2026-06-21T00:31:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended ApiListing with `isDepartedSale?: boolean | null` and mapped it in `mapApiListingToCarListing`
- Added `isDepartedSale?: boolean` to CarListing interface completing the data flow chain
- Added grey ESTATE badge to VehicleCard imageBadgeRow (inline after isNew badge)
- Added grey ESTATE badge to HorizontalVehicleCard imageContainer (absolute top-right, mirrors premiumBadge pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend mobile type layer with isDepartedSale** - `db73998a` (feat)
2. **Task 2: Add Estate badge to VehicleCard and HorizontalVehicleCard** - `6aa810a2` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `carmazium app/carmazium app/src/lib/listingsApi.ts` - ApiListing extended with isDepartedSale; mapApiListingToCarListing maps field
- `carmazium app/carmazium app/src/data/listings.ts` - CarListing interface extended with isDepartedSale?: boolean
- `carmazium app/carmazium app/src/components/VehicleCard.tsx` - estateBadge/estateText styles + conditional render in imageBadgeRow
- `carmazium app/carmazium app/src/components/HorizontalVehicleCard.tsx` - estateBadge/estateText styles (absolute) + conditional render in imageContainer

## Decisions Made
- Estate badge colour: neutral grey rgba(160,160,171,0.20) background with Colors.textSecondary (#A0A0AB) text — matches the web Estate chip intent, visually subdued, not trust-critical
- HorizontalVehicleCard places badge absolute top-right so it does not overlap the premiumBadge which anchors top-left

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Two pre-existing TypeScript errors exist in GlobalDrawer.tsx (`role` property) and DealerInventoryScreen.tsx (`blob url`). These are documented in STATE.md as known deferred issues and are not affected by these changes. Zero new TypeScript errors introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- isDepartedSale data flow is complete end-to-end on mobile: API → type mapping → components
- Estate badges display consistently on both card layouts used across the app
- No blockers for subsequent phases

---
*Phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field*
*Completed: 2026-06-21*
