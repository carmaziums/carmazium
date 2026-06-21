---
phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field
plan: 01
subsystem: ui
tags: [react, form, validation, listing-wizard, typescript]

# Dependency graph
requires:
  - phase: 10-listing-form-enhancements
    provides: isDepartedSale/departedRelationship fields already in FormData and DB schema
provides:
  - RELATIONSHIP_OPTIONS constant (7 preset values: Son/Daughter/Sibling/Spouse/Executor of Will/Solicitor/Other)
  - Dropdown-based departed sale relationship picker with 'Other' freetext escape hatch
  - Step 1 validation guard blocking advance when isDepartedSale=true and relationship unresolved
affects:
  - buyers seeing structured relationship values on listing detail page
  - future phases reading departedRelationship from DB (consistently structured values)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local ephemeral UI state (departedRelSelect/departedRelOther) drives resolved value into formData via set() helper — keeps FormData clean while supporting multi-part UI interactions"
    - "RELATIONSHIP_OPTIONS as const with cast to mutable type for SelectField — avoids widening the options type while keeping the array read-only"

key-files:
  created: []
  modified:
    - src/components/listing/ListingWizard.tsx

key-decisions:
  - "Two local state vars (departedRelSelect, departedRelOther) rather than one — dropdown selection and freetext are independent concerns; resolved value always written to formData.departedRelationship"
  - "Reused existing SelectField component — consistent styled <select> with red border on error"
  - "Validation guard placed before 'return baseValid && declarationsValid' in case 1 — relationship check is independent and fails fast"

patterns-established:
  - "Split ephemeral UI state pattern: local state for multi-part picker, formData only holds resolved value"

requirements-completed: [FORM-01, FORM-02, FORM-03, FORM-04]

# Metrics
duration: 12min
completed: 2026-06-21
---

# Phase 13 Plan 01: Listing Form Enhancements Summary

**Departed sale section upgraded from free-text to 7-option dropdown with 'Other' freetext fallback, updated label/helper text, and step 1 validation guard blocking unresolved relationship**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-21T00:29:51Z
- **Completed:** 2026-06-21T00:41:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `RELATIONSHIP_OPTIONS` constant with 7 options (Son, Daughter, Sibling, Spouse, Executor of Will, Solicitor, Other) in specified order
- Replaced free-text relationship input with `SelectField` dropdown; 'Other' reveals freetext with placeholder "Please specify your relationship"
- Updated checkbox label to "This is a departed/estate sale"; added always-visible helper text about Deceased Estate badge
- Wired `handleRelSelectChange` / `handleRelOtherChange` handlers so resolved value always lands in `formData.departedRelationship`; unchecking the checkbox resets all three fields
- Added `validateStep` case 1 guard: returns false when `isDepartedSale=true` and `departedRelationship` is empty, with red border and inline error message on `hasAttemptedNext`
- TypeScript: zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RELATIONSHIP_OPTIONS constant and local Other state** - `402df44f` (feat)
2. **Task 2: Replace departed section UI and add step 1 validation guard** - `402df44f` (feat — combined with Task 1 in single atomic commit)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/listing/ListingWizard.tsx` — RELATIONSHIP_OPTIONS constant; departedRelSelect/departedRelOther state; handleRelSelectChange/handleRelOtherChange handlers; replaced departed JSX (label + helper text + SelectField dropdown + Other freetext + error message); validateStep case 1 relationship guard

## Decisions Made

- Used two local state vars (departedRelSelect for dropdown, departedRelOther for freetext) to keep separation of concerns clean; both resolve into the single `formData.departedRelationship` field via `set()`
- Reused existing `SelectField` component rather than building a custom dropdown — consistent with form patterns throughout the wizard
- Placed the relationship guard before `return baseValid && declarationsValid` so it fails fast independently of other field validations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 13-01 complete. The departed sale form section now produces consistent, structured relationship values in the DB.
- Ready for Plan 13-02: buyer-facing display of relationship ("Listed by [relationship]") on listing detail page and Estate chip on listing cards.

---
*Phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field*
*Completed: 2026-06-21*
