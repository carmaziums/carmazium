---
phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field
verified: 2026-06-21T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 13: Listing Form Enhancements — Departed Sale Verification Report

**Phase Goal:** Upgrade the departed/estate sale section in the listing wizard to a structured relationship dropdown, propagate an Estate chip to all web listing card contexts and the mobile VehicleCard/HorizontalVehicleCard, and extend the listing detail badge to show 'Listed by [relationship]' inline.
**Verified:** 2026-06-21
**Status:** passed
**Human checkpoint (13-04):** Approved by user — human_verification items counted as passed.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Checkbox label is "This is a departed/estate sale" | VERIFIED | `ListingWizard.tsx:1966` — exact string present |
| 2  | Helper text always visible (not gated on checkbox) | VERIFIED | `ListingWizard.tsx:1969-1971` — `<p>` rendered outside `isDepartedSale &&` block |
| 3  | Dropdown with 7 preset options replaces free-text | VERIFIED | `RELATIONSHIP_OPTIONS` at line 134-142; `SelectField` rendered at line 1974-1981 |
| 4  | 'Other' reveals freetext with correct placeholder | VERIFIED | `ListingWizard.tsx:1985-1993` — conditional on `departedRelSelect === 'Other'` |
| 5  | Step 1 validation blocks when isDepartedSale=true and no relationship | VERIFIED | `validateStep` case 1 guard at lines 513-517 — trims and returns false on empty |
| 6  | CarCard shows grey Estate chip in card body (not image corner) | VERIFIED | `CarCard.tsx:242-249` — after badgeTier block, before Specs Tags; never in image corner |
| 7  | All web CarCard/ListingCard call sites pass isDepartedSale | VERIFIED | `search/page.tsx:1134,1168`; `HomeClient.tsx:302`; `seller/[id]/page.tsx:459` |
| 8  | Detail page shows "Deceased Estate · Listed by [relationship]" inline | VERIFIED | `buy-cars/[slug]/page.tsx:588-595` — conditional span with `· Listed by` prefix |
| 9  | Mobile VehicleCard and HorizontalVehicleCard show grey ESTATE badge | VERIFIED | `VehicleCard.tsx:99-103` (imageBadgeRow); `HorizontalVehicleCard.tsx:91-95` (imageContainer) |

**Score: 9/9 truths verified**

---

### Required Artifacts

| Artifact | Provides | Status | Key Evidence |
|----------|----------|--------|-------------|
| `src/components/listing/ListingWizard.tsx` | RELATIONSHIP_OPTIONS, dropdown, freetext, validation guard | VERIFIED | `RELATIONSHIP_OPTIONS` at line 134; guard at lines 513-517; full UI block at lines 1950-1995 |
| `src/components/features/CarCard.tsx` | isDepartedSale prop + Estate chip in card body | VERIFIED | Prop in interface at line 35; chip at lines 242-249 |
| `src/app/search/page.tsx` | isDepartedSale threaded at both CarCard render sites | VERIFIED | Lines 1134 and 1168 |
| `src/app/HomeClient.tsx` | isDepartedSale threaded at CarCard site | VERIFIED | Line 302 |
| `src/app/seller/[id]/page.tsx` | isDepartedSale in local Listing type; Estate chip in ListingCard | VERIFIED | Type at line 57; chip at line 459 |
| `src/app/buy-cars/[slug]/page.tsx` | "Listed by [relationship]" inline with Deceased Estate badge | VERIFIED | Lines 588-595 |
| `carmazium app/carmazium app/src/lib/listingsApi.ts` | isDepartedSale on ApiListing; mapped in mapApiListingToCarListing | VERIFIED | Interface field at line 36; mapping at line 161 |
| `carmazium app/carmazium app/src/data/listings.ts` | isDepartedSale on CarListing | VERIFIED | Field at line 42 |
| `carmazium app/carmazium app/src/components/VehicleCard.tsx` | estateBadge in imageBadgeRow | VERIFIED | Lines 99-103; styles at line 228 |
| `carmazium app/carmazium app/src/components/HorizontalVehicleCard.tsx` | estateBadge in imageContainer | VERIFIED | Lines 91-95; styles at line 175 |

---

### Key Link Verification

| From | To | Via | Status | Detail |
|------|----|-----|--------|--------|
| `validateStep case 1` | `formData.departedRelationship` | `isDepartedSale` guard + `.trim()` + `return false` | WIRED | Lines 513-517: guard fires before `return baseValid && declarationsValid` |
| `handleRelSelectChange` | `formData.departedRelationship` | `set('departedRelationship', v)` / sentinel | WIRED | Lines 489-497 |
| `handleRelOtherChange` | `formData.departedRelationship` | `set('departedRelationship', v)` | WIRED | Lines 499-502 |
| `search/page.tsx` | `CarCard isDepartedSale prop` | `listing.isDepartedSale ?? false` at both render sites | WIRED | Lines 1134 and 1168 |
| `buy-cars/[slug]/page.tsx` | `listing.departedRelationship` | inline conditional span after Deceased Estate text | WIRED | Lines 591-593 |
| `ApiListing.isDepartedSale` | `CarListing.isDepartedSale` | `mapApiListingToCarListing` return object | WIRED | `listingsApi.ts:161` — `isDepartedSale: l.isDepartedSale ?? false` |
| `CarListing.isDepartedSale` | `VehicleCard estateBadge` | `listing.isDepartedSale &&` in imageBadgeRow | WIRED | `VehicleCard.tsx:99` |
| `CarListing.isDepartedSale` | `HorizontalVehicleCard estateBadge` | `listing.isDepartedSale &&` in imageContainer | WIRED | `HorizontalVehicleCard.tsx:91` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FORM-01 | 13-01 | Dropdown renders with all 7 options in specified order | SATISFIED | `RELATIONSHIP_OPTIONS` constant lines 134-142; SelectField render at line 1974 |
| FORM-02 | 13-01 | 'Other' option triggers conditional freetext input | SATISFIED | `departedRelSelect === 'Other'` conditional at line 1985 |
| FORM-03 | 13-01 | Step 1 cannot advance when isDepartedSale=true and relationship is unresolved | SATISFIED | Guard in `validateStep` at lines 513-517 |
| FORM-04 | 13-01 | Inline red border + error message on failed validation attempt | SATISFIED | `error={hasAttemptedNext && !formData.departedRelationship}` on SelectField (line 1977); error `<p>` at line 1982-1984 |
| BADGE-01 | 13-02 | Grey Estate chip visible on CarCard (all web contexts) when isDepartedSale=true | SATISFIED | CarCard chip at lines 242-249; threaded at all 4 call sites |
| BADGE-02 | 13-02 | "Listed by [relationship]" shown inline with Deceased Estate badge on detail page | SATISFIED | Conditional span at `buy-cars/[slug]/page.tsx:591-593` |
| MOBILE-01 | 13-03 | Grey ESTATE chip visible on VehicleCard and HorizontalVehicleCard for departed listings | SATISFIED | Both components verified; full type chain (ApiListing → CarListing) confirmed |

**Note on REQUIREMENTS.md:** The IDs FORM-01 through FORM-04, BADGE-01, BADGE-02, and MOBILE-01 are phase-local identifiers defined in the plan frontmatter. They do not appear in `.planning/REQUIREMENTS.md`, which tracks only the mobile-app v1.0/v1.1 requirements (INFRA-*, PUSH-*, BUYER-*, etc.). This is expected — Phase 13 introduced its own local requirement namespace. No orphaned entries found in REQUIREMENTS.md for Phase 13.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, empty implementations, or stub returns found in modified files.

---

### Human Verification

Checkpoint 13-04 was approved by the user. The following items were verified by the human:

- Listing wizard: checkbox label, helper text visibility before checkbox tick, dropdown with 7 options in order, 'Other' freetext appearance, step 1 blocking when unresolved
- Web grids: grey Estate chip on CarCard in search, home, and seller profile contexts; chip not in image corner
- Listing detail page: "Deceased Estate · Listed by [relationship]" inline; graceful omission when relationship is empty
- Mobile: grey ESTATE badge on VehicleCard and HorizontalVehicleCard

All items confirmed as passed per human approval.

---

## Gaps Summary

No gaps. All 9 truths verified, all 10 artifacts pass all three levels (exists, substantive, wired), all 8 key links confirmed wired, all 7 requirement IDs satisfied. Human checkpoint approved. Phase 13 goal fully achieved.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
