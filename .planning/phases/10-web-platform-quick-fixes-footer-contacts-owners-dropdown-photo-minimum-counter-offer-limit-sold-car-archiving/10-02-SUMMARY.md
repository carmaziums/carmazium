---
phase: 10-web-platform-quick-fixes-footer-contacts-owners-dropdown-photo-minimum-counter-offer-limit-sold-car-archiving
plan: "02"
subsystem: web-frontend
tags: [listing-wizard, photo-upload, owners, deceased-estate, image-upload, listing-detail]
dependency_graph:
  requires: ["10-01"]
  provides: ["OWNERS-01", "OWNERS-02", "OWNERS-03", "OWNERS-04", "PHOTO-01", "PHOTO-02", "PHOTO-03", "PHOTO-05", "PHOTO-06"]
  affects: ["src/components/listing/ListingWizard.tsx", "src/components/listing/ImageUpload.tsx", "src/app/buy-cars/[slug]/page.tsx", "src/lib/listingApi.ts"]
tech_stack:
  added: []
  patterns: ["IIFE-rendered JSX for progress bar", "conditional field reveal on checkbox", "editId bypass for photo minimum"]
key_files:
  created: []
  modified:
    - src/components/listing/ListingWizard.tsx
    - src/components/listing/ImageUpload.tsx
    - src/app/buy-cars/[slug]/page.tsx
    - src/lib/listingApi.ts
decisions:
  - "owners required in step 1 baseValid alongside existing vrm/make/model/year/mileage/fuelType/transmission/title/location checks"
  - "photo minimum (10) skipped when editId present — seller editing published listing is unrestricted"
  - "photo counter uses IIFE pattern inside step 2 JSX — renders only within wizard, never on inventory cards"
  - "Deceased Estate badge uses muted purple (purple-500/10 background) — tasteful, not alarming"
  - "owners display normalised: '1 Owner', '2 Owners', '3 Owners', '4 Owners', '5+ Owners' in detail page"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-06-21"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
requirements:
  - OWNERS-01
  - OWNERS-02
  - OWNERS-03
  - OWNERS-04
  - PHOTO-01
  - PHOTO-02
  - PHOTO-03
  - PHOTO-05
  - PHOTO-06
---

# Phase 10 Plan 02: Owners Dropdown, Departed Sale, Photo Minimum + Counter Summary

**One-liner:** 5-option owners dropdown with deceased estate checkbox, 10-photo minimum enforcement with amber/green progress bar, and buyer-facing Deceased Estate badge + owners count in specs table.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Owners dropdown (5 options) + deceased estate checkbox | 2bca2cb2 | ListingWizard.tsx, listingApi.ts |
| 2 | Photo minimum enforcement + progress bar | 00be7164 | ListingWizard.tsx, ImageUpload.tsx |
| 3 | Listing detail — owners in specs table + Deceased Estate badge | 3cfea38d | buy-cars/[slug]/page.tsx, listingApi.ts |

## What Was Built

### Task 1 — Owners Dropdown + Departed Sale

**ListingWizard.tsx**
- FormData interface extended with `isDepartedSale: boolean` (default `false`) and `departedRelationship: string` (default `""`)
- 3-button owners group (1/2/3+) replaced with 5-option flex row: 1 Owner / 2 Owners / 3 Owners / 4 Owners / 5+ Owners
- Owners field added to step 1 `baseValid` — step is invalid until an owner option is selected
- Deceased estate checkbox renders below owners; conditionally reveals a relationship text input when checked
- Both `isDepartedSale` and `departedRelationship` included in the POST payload

**listingApi.ts**
- `CreateListingRequest` extended with `isDepartedSale?: boolean` and `departedRelationship?: string`
- `Listing` interface extended with `isDepartedSale?: boolean | null` and `departedRelationship?: string | null`

### Task 2 — Photo Minimum Enforcement

**ImageUpload.tsx**
- Default `maxImages` raised from 30 to 100 (fixes 31st photo block)

**ListingWizard.tsx**
- Step 2 `validateStep`: `case 2: return editId ? formData.images.length > 0 : formData.images.length >= 10`
- Photo counter + progress bar added above `<ImageUpload>` in step 2 (IIFE pattern for inline calculation)
- Amber styling when below 10; green when 10 or more
- Edit mode shows neutral `X/100 photos` label without "required to publish" wording

### Task 3 — Listing Detail Page

**buy-cars/[slug]/page.tsx**
- Deceased Estate badge (purple-500/10) added to the badges row when `listing.isDepartedSale === true`
- Previous Owners row added to the Overview section of the Specifications table
- Display format: '1 Owner', '2 Owners', '3 Owners', '4 Owners', '5+ Owners'

## Deviations from Plan

None — plan executed exactly as written.

Note: `maxImages={100}` was already present in the `<ImageUpload>` JSX call in step 2 (from a previous edit), so only the default prop in `ImageUpload.tsx` needed updating. No double-application issue.

## Self-Check

### Files Exist
- src/components/listing/ListingWizard.tsx — FOUND
- src/components/listing/ImageUpload.tsx — FOUND
- src/app/buy-cars/[slug]/page.tsx — FOUND
- src/lib/listingApi.ts — FOUND

### Commits Exist
- 2bca2cb2 — FOUND
- 00be7164 — FOUND
- 3cfea38d — FOUND

### TypeScript
- `npx tsc --noEmit` — Exit 0 (no errors)

## Self-Check: PASSED
