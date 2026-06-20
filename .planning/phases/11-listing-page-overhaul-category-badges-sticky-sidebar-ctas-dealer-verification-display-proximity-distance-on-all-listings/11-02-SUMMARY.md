---
phase: 11-listing-page-overhaul-category-badges-sticky-sidebar-ctas-dealer-verification-display-proximity-distance-on-all-listings
plan: 02
subsystem: ui
tags: [next.js, react, lucide, tailwind, listing-detail, compare-context, location-context]

# Dependency graph
requires:
  - phase: 11-listing-page-overhaul-category-badges-sticky-sidebar-ctas-dealer-verification-display-proximity-distance-on-all-listings
    plan: 01
    provides: "vehicleLabels.ts, LocationContext, listingCount field on Listing.seller"
provides:
  - "Listing detail page with bodyType/fuelType/Auction pill badges above H1"
  - "Emerald trust panel (ShieldCheck + Verified + active listing count) in desktop sidebar"
  - "Sidebar distance display (X miles away) via LocationContext + haversineDistanceMiles"
  - "Sidebar secondary CTA icon row: Save/Share/Compare buttons"
  - "Mobile fixed sticky bottom bar (lg:hidden) with Make an Offer + Enquire + Save + Share + Compare"
  - "handleCompareAndNavigate: addToCompare(listing) + router.push('/compare')"
affects:
  - compare-feature
  - listing-detail
  - mobile-ux

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Category eyebrow badges above H1 for listing type classification"
    - "Trust panel with ShieldCheck + listingCount in sidebar seller info"
    - "Fixed mobile sticky bar (lg:hidden) with safe-area-inset-bottom padding"
    - "CompareContext addToCompare + /compare navigation pattern (not URL-param)"

key-files:
  created: []
  modified:
    - "src/app/buy-cars/[slug]/page.tsx"

key-decisions:
  - "Mobile sticky bar uses fixed bottom + z-50 + lg:hidden; desktop sidebar has secondary icon row instead"
  - "handleCompare replaced entirely with handleCompareAndNavigate using addToCompare context method"
  - "Outer wrapper uses pb-36 lg:pb-12 to prevent mobile content being obscured by sticky bar"
  - "Trust panel is always shown (not conditional on verified status) — seller info block always has it"

patterns-established:
  - "Eyebrow badge pattern: flex-wrap pill row above H1 with CarIcon/Fuel/Gavel icons from lucide"
  - "Mobile sticky bar pattern: fixed bottom-0 lg:hidden with env(safe-area-inset-bottom) inset"

requirements-completed:
  - CAT-01
  - CAT-02
  - CAT-03
  - SIDE-01
  - SIDE-02
  - SIDE-03
  - SIDE-04
  - TRUST-01
  - TRUST-02
  - DIST-03

# Metrics
duration: 12min
completed: 2026-06-21
---

# Phase 11 Plan 02: Listing Detail Page Overhaul Summary

**Listing detail page overhauled with bodyType/fuelType/Auction pill eyebrow, emerald trust panel with listingCount, sidebar Save/Share/Compare icon row, mobile fixed sticky bar, and distance display via LocationContext**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-20T20:19:06Z
- **Completed:** 2026-06-20T20:31:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added Fuel and Gavel Lucide icons + 4 new imports (vehicleLabels, LocationContext, haversineDistanceMiles, CompareContext)
- Category pill eyebrow (bodyType, fuelType, Auction amber pill) rendered above H1 title
- Emerald trust panel with ShieldCheck, "Verified" label, and active listing count in desktop sidebar
- Sidebar distance "X miles away" computed via useMemo with haversineDistanceMiles when geolocation resolved
- Secondary CTA icon row (Save/Share/Compare) below primary Enquire button in desktop sidebar
- Mobile fixed sticky bar (lg:hidden) with all 5 action buttons and safe-area-inset-bottom support
- handleCompare replaced with handleCompareAndNavigate (addToCompare + router.push('/compare'))

## Task Commits

Each task was committed atomically:

1. **Task 1: Category badge eyebrow + trust panel + sidebar distance** - `9350adef` (feat)
2. **Task 2: Sidebar CTAs overhaul + mobile sticky bottom bar** - `6a2edbb4` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `src/app/buy-cars/[slug]/page.tsx` — All four Phase 11 improvements applied: eyebrow badges, trust panel, sidebar CTAs, mobile sticky bar, distance display

## Decisions Made
- Mobile sticky bar uses `fixed bottom-0 left-0 right-0 z-50 lg:hidden` — avoids desktop sidebar duplication while giving mobile full CTA access
- `pb-36 lg:pb-12` on outer wrapper prevents sticky bar from obscuring bottom content on mobile
- handleCompareAndNavigate uses `addToCompare(listing)` from CompareContext then `router.push('/compare')` — consistent with the rest of the app's compare flow
- Trust panel is always rendered in the sidebar seller info block regardless of badge tier — all sellers are verified on this platform

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 Plan 02 complete — listing detail page has all four buyer-facing improvements
- Plan 03 (if any) can build on the compare, location, and trust patterns established here
- Mobile buyers will see the sticky bar immediately on page load; desktop buyers see the full sidebar CTA set

---
*Phase: 11-listing-page-overhaul-category-badges-sticky-sidebar-ctas-dealer-verification-display-proximity-distance-on-all-listings*
*Completed: 2026-06-21*
