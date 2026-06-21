---
phase: 15-delivery-and-distance-system-seller-delivery-toggle-price-per-km-auto-calculation-buyer-delivery-request-flow
plan: "03"
subsystem: delivery-api-and-seller-wizard
tags: [delivery, api-client, listing-wizard, typescript, seller-surface]
dependency-graph:
  requires: [15-02]
  provides: [deliveryApi.ts, listingApi.ts-delivery-fields, ListingWizard-delivery-section]
  affects: [15-04, 15-05]
tech-stack:
  added: []
  patterns: [apiClient-wrapper-pattern, typed-api-client, wizard-optional-section]
key-files:
  created:
    - src/lib/deliveryApi.ts
  modified:
    - src/lib/listingApi.ts
    - src/components/listing/ListingWizard.tsx
decisions:
  - deliveryApi.ts uses apiClient wrapper (not raw fetch) — consistent with all other lib/*.ts files
  - Delivery fields in wizard are optional; no step-blocking validation added per plan spec
  - deliveryPricePerMile stored as string in FormData, parsed to float on submit; deliveryMaxMiles parsed to int
  - Delivery section placed after HPI bait section (last element in second Step 1 block) before closing divs
metrics:
  duration: "3 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
requirements:
  - DEL-10
---

# Phase 15 Plan 03: Delivery API Client + Seller Wizard Section Summary

Typed delivery API client with 7 endpoint functions, extended listing types, and seller Delivery Options section in Step 1 of ListingWizard.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create deliveryApi.ts + extend listingApi.ts types | 6d0c66ae | src/lib/deliveryApi.ts (created), src/lib/listingApi.ts |
| 2 | Add Delivery Options section to ListingWizard Step 1 | 11ec268f | src/components/listing/ListingWizard.tsx |

## What Was Built

### src/lib/deliveryApi.ts (new)

Typed API client for the delivery request lifecycle. Exports:
- `DeliveryStatus` — union type: `'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED'`
- `DeliveryAddress` — `{ street, city, postcode }`
- `DeliveryRequest` — full interface with all server fields, optional listing and buyer relations
- `createDeliveryRequest(data)` — POST `/delivery-requests`
- `acceptDeliveryRequest(id)` — PATCH `/delivery-requests/:id/accept`
- `declineDeliveryRequest(id)` — PATCH `/delivery-requests/:id/decline`
- `cancelDeliveryRequest(id)` — PATCH `/delivery-requests/:id/cancel`
- `completeDeliveryRequest(id)` — PATCH `/delivery-requests/:id/complete`
- `getMyDeliveryRequests()` — GET `/delivery-requests/my`
- `getReceivedDeliveryRequests()` — GET `/delivery-requests/received`

### src/lib/listingApi.ts (extended)

- `Listing` interface: added `deliveryAvailable?: boolean | null`, `deliveryPricePerMile?: number | string | null`, `deliveryMaxMiles?: number | null`
- `CreateListingRequest` interface: added `deliveryAvailable?: boolean`, `deliveryPricePerMile?: number | null`, `deliveryMaxMiles?: number | null`
- `ListingFilters` interface: added `deliveryAvailable?: boolean`
- `getListings()`: added `if (filters.deliveryAvailable !== undefined) params.append('deliveryAvailable', String(filters.deliveryAvailable))`

### src/components/listing/ListingWizard.tsx (extended)

- `FormData` interface: 3 new fields (`deliveryAvailable: boolean`, `deliveryPricePerMile: string`, `deliveryMaxMiles: string`)
- `INITIAL_FORM` state: `deliveryAvailable: false, deliveryPricePerMile: '', deliveryMaxMiles: ''`
- Edit mode useEffect: hydrates all 3 fields from existing listing data
- Submit handler: spreads `deliveryAvailable`, `deliveryPricePerMile` (parseFloat or null), `deliveryMaxMiles` (parseInt or null) into payload
- Step 1 JSX: "Delivery Options" section with toggle checkbox; when checked, reveals `£` price-per-mile input and optional max radius input

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- `src/lib/deliveryApi.ts` — exists and exports 7 functions + DeliveryRequest + DeliveryStatus
- `src/lib/listingApi.ts` — Listing, CreateListingRequest, ListingFilters all extended; getListings() has deliveryAvailable param
- `src/components/listing/ListingWizard.tsx` — FormData, INITIAL_FORM, edit hydration, submit payload, JSX section all updated
- TypeScript: zero errors (`npx tsc --noEmit` produces no output)
- Commits: 6d0c66ae (Task 1), 11ec268f (Task 2)

## Self-Check: PASSED
