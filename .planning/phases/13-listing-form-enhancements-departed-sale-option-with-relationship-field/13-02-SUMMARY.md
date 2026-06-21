---
phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field
plan: 02
subsystem: ui
tags: [react, nextjs, tailwind, carcard, listing]

# Dependency graph
requires:
  - phase: 10-listing-form-enhancements
    provides: isDepartedSale + departedRelationship fields in listingApi.ts Listing type and backend

provides:
  - Grey Estate chip in CarCard body (all web grid contexts) when isDepartedSale=true
  - isDepartedSale prop threaded through search/page.tsx (both sites), HomeClient.tsx, seller/[id]/page.tsx ListingCard
  - "Deceased Estate · Listed by [relationship]" inline display on listing detail page

affects: [listing-display, buyer-browse, seller-profile, listing-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isDepartedSale threaded as explicit prop to CarCard, not derived from listing object internally"
    - "Local Listing interfaces in page-level files extended to match shared listingApi.ts fields when needed"

key-files:
  created: []
  modified:
    - src/components/features/CarCard.tsx
    - src/app/search/page.tsx
    - src/app/HomeClient.tsx
    - src/app/seller/[id]/page.tsx
    - src/app/buy-cars/[slug]/page.tsx

key-decisions:
  - "Estate chip uses bg-white/5 text-gray-400 border-white/10 — lower visual weight than PREMIUM amber or STANDARD blue, matching existing spec tag style"
  - "Estate chip placed in card body after badge tier block, NOT in image corner trust badge area"
  - "departedRelationship shown exactly as stored (no normalisation) — preset or freetext 'Other' value both render verbatim"
  - "Local Listing interface in seller/[id]/page.tsx extended with isDepartedSale?: boolean (Rule 2 auto-fix)"

patterns-established:
  - "Estate chip: inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-white/5 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full"

requirements-completed: [BADGE-01, BADGE-02]

# Metrics
duration: 12min
completed: 2026-06-21
---

# Phase 13 Plan 02: Estate Chip + "Listed by" Relationship Display Summary

**Grey Estate chip added to CarCard and all web listing grids; Deceased Estate detail badge extended with inline "Listed by [relationship]" suffix**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-21T00:20:00Z
- **Completed:** 2026-06-21T00:32:03Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `isDepartedSale?: boolean` to CarCardProps and rendered grey Estate chip in card body (below badge tier, above spec tags) — visible in buy-cars grid, search featured row, search main grid
- Threaded `isDepartedSale` at all 4 web CarCard/ListingCard call sites (search featured, search main, HomeClient, seller profile ListingCard)
- Extended Deceased Estate badge on `/buy-cars/[slug]` detail page to show "· Listed by [relationship]" inline when `departedRelationship` is non-empty; gracefully omits the suffix when empty/null

## Task Commits

1. **Task 1: Add isDepartedSale prop to CarCard and Estate chip; thread prop through call sites** - `830167a7` (feat)
2. **Task 2: Extend listing detail Deceased Estate badge with "Listed by [relationship]"** - `b5faa619` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/components/features/CarCard.tsx` - Added `isDepartedSale?: boolean` prop + grey Estate chip in card body
- `src/app/search/page.tsx` - Passed `isDepartedSale={listing.isDepartedSale ?? false}` at both CarCard render sites
- `src/app/HomeClient.tsx` - Passed `isDepartedSale={listing.isDepartedSale ?? false}` at CarCard render site
- `src/app/seller/[id]/page.tsx` - Added `isDepartedSale?: boolean` to local Listing interface; added Estate chip in ListingCard body
- `src/app/buy-cars/[slug]/page.tsx` - Extended Deceased Estate badge with conditional "· Listed by [departedRelationship]" span

## Decisions Made

- Estate chip uses neutral grey styling (`bg-white/5 text-gray-400 border-white/10`) matching existing spec tag style — intentionally lower visual weight than trust-critical PREMIUM (amber) or STANDARD (blue) badges
- Estate chip is placed in the card body content area, never in the image corner trust badge area (lines 136–145 of CarCard.tsx)
- `departedRelationship` value rendered verbatim — no normalisation applied (matches plan decision: "show exactly as typed")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended local Listing interface in seller/[id]/page.tsx with isDepartedSale**
- **Found during:** Task 1 (TypeScript check after adding Estate chip to ListingCard)
- **Issue:** The `Listing` interface in seller/[id]/page.tsx is a local page-level type, not imported from listingApi.ts. It was missing `isDepartedSale?: boolean`, causing TS error TS2339.
- **Fix:** Added `isDepartedSale?: boolean` to the local interface so the chip render compiles cleanly.
- **Files modified:** src/app/seller/[id]/page.tsx
- **Verification:** `npx tsc --noEmit` — zero errors after fix
- **Committed in:** `830167a7` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing field in local type)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep.

## Issues Encountered

None — TypeScript error caught by verification step and resolved immediately via Rule 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BADGE-01 and BADGE-02 requirements fully satisfied
- Phase 13 Plan 02 complete; Plan 03 (if any) can proceed
- Estate chip styling pattern established for future badge types

---
*Phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field*
*Completed: 2026-06-21*
