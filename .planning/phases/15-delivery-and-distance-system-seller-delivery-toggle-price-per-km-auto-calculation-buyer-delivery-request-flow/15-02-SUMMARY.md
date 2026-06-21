---
phase: 15-delivery-and-distance-system-seller-delivery-toggle-price-per-km-auto-calculation-buyer-delivery-request-flow
plan: "02"
subsystem: api

tags: [nestjs, prisma, delivery, google-maps, cron, rest-api, notifications]

requires:
  - phase: 15-01
    provides: 9 failing TDD RED stubs for DeliveryService (DEL-01..DEL-08) and DeliveryExpiryService (DEL-09); skeleton service files; DeliveryStatus enum in schema.prisma

provides:
  - Full delivery NestJS module with DeliveryService (7 methods), DeliveryController (7 REST endpoints), DeliveryExpiryService (daily 3AM cron)
  - DeliveryRequest Prisma model + DeliveryStatus enum + 3 new Listing delivery fields (deliveryAvailable, deliveryPricePerMile, deliveryMaxMiles)
  - Google Maps Distance Matrix API integration for server-side road distance calculation
  - deliveryAvailable filter wired into listings findAll query via ListingFilterDto
  - All 9 delivery unit tests GREEN (DEL-01..DEL-09)

affects:
  - 15-03 (seller wizard UI consumes deliveryAvailable/deliveryPricePerMile/deliveryMaxMiles Listing fields)
  - 15-04 (buyer offers page UI consumes GET /delivery-requests/my and POST /delivery-requests)
  - 15-05 (search page consumes GET /listings?deliveryAvailable=true filter)

tech-stack:
  added: []
  patterns:
    - "Google Maps Distance Matrix API called server-side from NestJS HttpService — API key never reaches browser"
    - "Lazy expiry check on acceptDeliveryRequest action + daily 3AM @Cron safety-net sweep (dual-mode expiry following offers.service.ts pattern)"
    - "Delivery notifications via NotificationsService.create() for all 4 lifecycle events (requested, accepted, declined, expired)"
    - "deliveryAddress stored as JSON blob {street, city, postcode} — no new address table"
    - "offerId FK captures most-recent offer as audit trail — not used as gate beyond prerequisite check"

key-files:
  created:
    - backend/src/delivery/delivery.service.ts
    - backend/src/delivery/delivery-expiry.service.ts
    - backend/src/delivery/delivery.controller.ts
    - backend/src/delivery/delivery.module.ts
    - backend/src/delivery/dto/create-delivery-request.dto.ts
    - backend/src/delivery/dto/respond-delivery-request.dto.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/tasks/tasks.module.ts
    - backend/src/app.module.ts
    - backend/src/listings/dto/listing-filter.dto.ts
    - backend/src/listings/listings.service.ts
    - backend/src/delivery/delivery.service.spec.ts
    - backend/src/delivery/delivery-expiry.service.spec.ts

key-decisions:
  - "Test files updated from plain `new DeliveryService()` (skeleton pattern) to NestJS TestingModule DI pattern to work with real injectable service — consistent with offers.service.spec.ts pattern"
  - "deliveryAvailable WHERE clause uses filterDto.deliveryAvailable directly (not destructured) since the destructuring block did not include it and adding it would be more disruptive"
  - "prisma migrate dev skipped (Supabase direct connection port 5432 unreachable from local dev machine; only reachable from Fly.io network) — schema applied on next fly deploy via prisma generate pre-build step"
  - "listings.service.spec.ts pre-existing failure (ConfigService not mocked) documented as out-of-scope per deviation rules — 7 failures existed before this plan"

patterns-established:
  - "Delivery module follows offers module structure: module → controller → service → DTOs, all exported from DeliveryModule"
  - "DeliveryExpiryService registered in TasksModule with DeliveryModule import (same pattern as FeaturedBoostExpiryService)"

requirements-completed:
  - DEL-01
  - DEL-02
  - DEL-03
  - DEL-04
  - DEL-05
  - DEL-06
  - DEL-07
  - DEL-08
  - DEL-09

duration: 45min
completed: 2026-06-21
---

# Phase 15 Plan 02: Delivery Module Backend Summary

**NestJS delivery module with 7 REST endpoints, Google Maps road-distance calculation, 48h expiry cron, and deliveryAvailable search filter — all 9 TDD tests GREEN**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-21T14:15:00Z
- **Completed:** 2026-06-21T15:00:00Z
- **Tasks:** 2 (Prisma schema + full delivery module)
- **Files modified:** 13

## Accomplishments
- DeliveryRequest model + DeliveryStatus enum + 3 Listing delivery fields added to schema.prisma; `prisma generate` passes with zero errors
- Full DeliveryService with 7 methods: createDeliveryRequest (with offer-guard, duplicate-guard, radius-guard, Google Maps distance calc), accept/decline/cancel/complete, getMyRequests, getReceivedRequests
- DeliveryExpiryService with @Cron('0 3 * * *') daily sweep cancelling PENDING requests past expiresAt and notifying buyers
- DeliveryController with 7 REST endpoints at /delivery-requests, all behind SessionAuthGuard
- deliveryAvailable filter added to ListingFilterDto and wired into listings.service.ts findAll WHERE clause
- 9/9 delivery unit tests GREEN (DEL-01..DEL-09); zero new TypeScript errors introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema — DeliveryRequest model + Listing delivery fields + back-relations** - `29985e61` (feat)
2. **Task 2: Full delivery module — service, controller, expiry cron, filter wiring** - `01540707` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/prisma/schema.prisma` - DeliveryRequest model, DeliveryStatus enum, 3 Listing delivery fields, back-relations on Offer/User/Listing
- `backend/src/delivery/delivery.service.ts` - Full implementation: getRoadDistanceMiles (Google Maps), createDeliveryRequest (6-step guard chain), accept/decline/cancel/complete, getMyRequests, getReceivedRequests
- `backend/src/delivery/delivery-expiry.service.ts` - @Cron 3AM daily sweep with findMany(PENDING, expiresAt lte now) + per-request update + buyer notification
- `backend/src/delivery/delivery.controller.ts` - 7 REST endpoints: POST /delivery-requests, PATCH /:id/accept|decline|cancel|complete, GET /my, GET /received
- `backend/src/delivery/delivery.module.ts` - Imports PrismaModule, NotificationsModule, EmailModule, ConfigModule, HttpModule
- `backend/src/delivery/dto/create-delivery-request.dto.ts` - CreateDeliveryRequestDto with DeliveryAddressDto nested validation
- `backend/src/delivery/dto/respond-delivery-request.dto.ts` - RespondDeliveryRequestDto (optional message)
- `backend/src/tasks/tasks.module.ts` - DeliveryModule imported, DeliveryExpiryService added to providers
- `backend/src/app.module.ts` - DeliveryModule imported
- `backend/src/listings/dto/listing-filter.dto.ts` - deliveryAvailable boolean with @Transform coercion
- `backend/src/listings/listings.service.ts` - deliveryAvailable WHERE clause in findAll()
- `backend/src/delivery/delivery.service.spec.ts` - Updated to NestJS TestingModule DI pattern; 8 tests GREEN
- `backend/src/delivery/delivery-expiry.service.spec.ts` - Updated to NestJS TestingModule DI pattern; 1 test GREEN

## Decisions Made
- Tests updated from plain constructor `new DeliveryService()` (skeleton pattern from plan 01) to NestJS `Test.createTestingModule` DI pattern with injected mocks — required for real injectable service to work; consistent with `offers.service.spec.ts` established pattern
- `prisma migrate dev` unavailable locally (Supabase direct port 5432 only reachable from Fly.io); schema will apply on next `fly deploy` via the generate step
- `listings.service.spec.ts` pre-existing failure (7 tests failing due to missing ConfigService mock) — confirmed pre-existing by git stash test; logged as out-of-scope, not fixed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test files updated to use NestJS DI pattern**
- **Found during:** Task 2 (delivery module implementation)
- **Issue:** Plan 01 created test stubs using `new DeliveryService()` without constructor arguments. With real NestJS @Injectable service, `this.prisma`, `this.httpService`, etc. are undefined unless injected. Tests would pass but actually test nothing.
- **Fix:** Updated both spec files to use `Test.createTestingModule` with mocked providers, consistent with `offers.service.spec.ts` pattern. Added `listingUnique` mock setup to several tests to cover the new `listing.findUnique` call at the top of `createDeliveryRequest`.
- **Files modified:** `delivery.service.spec.ts`, `delivery-expiry.service.spec.ts`
- **Verification:** `npx jest delivery --no-coverage` → 9/9 PASS
- **Committed in:** `01540707` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test scaffolding)
**Impact on plan:** Required fix for tests to actually exercise real service logic. No scope creep.

## Issues Encountered
- `prisma migrate dev` and `prisma db push` both fail locally — Supabase direct connection (port 5432) is only reachable from within the Fly.io private network. Resolved: `prisma generate` succeeds and verifies schema validity; migration will apply on next deployment.
- `listings.service.spec.ts` 7 pre-existing failures (ConfigService not mocked in test module) — confirmed pre-existing, documented as deferred.

## User Setup Required
- `GOOGLE_MAPS_API_KEY` env var must be set on Fly.io: `fly secrets set GOOGLE_MAPS_API_KEY=<your-key>`. Without it, all `POST /delivery-requests` calls will return 500 `InternalServerErrorException: Delivery distance service not configured.`

## Next Phase Readiness
- Plan 03 (seller wizard delivery options section) can now write to `deliveryAvailable`, `deliveryPricePerMile`, `deliveryMaxMiles` fields on Listing
- Plan 04 (buyer offers page inline delivery UI) can call `GET /delivery-requests/my` and `POST /delivery-requests`
- Plan 05 (search page delivery filter + CarCard badge) can use `GET /listings?deliveryAvailable=true`
- All 7 REST endpoints available at https://carmazium-hjoh9w.fly.dev/delivery-requests after next deploy

---
*Phase: 15-delivery-and-distance-system*
*Completed: 2026-06-21*
