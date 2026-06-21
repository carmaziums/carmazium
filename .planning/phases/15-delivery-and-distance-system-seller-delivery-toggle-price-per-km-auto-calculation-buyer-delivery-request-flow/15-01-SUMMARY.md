---
phase: 15-delivery-and-distance-system-seller-delivery-toggle-price-per-km-auto-calculation-buyer-delivery-request-flow
plan: "01"
subsystem: testing

tags: [nestjs, jest, tdd, prisma, delivery]

requires:
  - phase: 14-stripe-kyc-fix-replace-manual-card-form-with-stripe-elements-and-live-1-pound-verification-charge
    provides: Backend NestJS test infrastructure and Jest patterns (offers.service.spec.ts scaffold)

provides:
  - 9 failing RED unit test stubs for DeliveryService (DEL-01..DEL-08) and DeliveryExpiryService (DEL-09)
  - Skeleton delivery.service.ts and delivery-expiry.service.ts (methods throw Error not implemented)
  - DeliveryStatus enum added to schema.prisma (PENDING/ACCEPTED/DECLINED/COMPLETED/CANCELLED)

affects:
  - 15-02 (plan 02 must make these 9 tests GREEN by implementing the delivery service)

tech-stack:
  added: []
  patterns:
    - "TDD RED pattern: skeleton classes throw Error('not implemented'); tests assert specific NestJS exception types (BadRequestException/ForbiddenException) so generic Error fails the assertion"
    - "Tests for resolve-path methods (DEL-04, DEL-06, DEL-09) await the call directly — skeleton throws causing test to reject, giving RED"

key-files:
  created:
    - backend/src/delivery/delivery.service.spec.ts
    - backend/src/delivery/delivery-expiry.service.spec.ts
    - backend/src/delivery/delivery.service.ts
    - backend/src/delivery/delivery-expiry.service.ts
  modified:
    - backend/prisma/schema.prisma

key-decisions:
  - "Tests assert specific NestJS exception classes (BadRequestException, ForbiddenException) — skeleton throws plain Error('not implemented') which does not match, giving true RED failures"
  - "DEL-04 and DEL-06 tests await resolution — skeleton throws so these also fail RED"
  - "DeliveryStatus enum added to schema.prisma at this stage so spec files can reference status string literals; no Prisma generate required in tests"

patterns-established:
  - "TDD RED scaffold: skeleton file + spec with 9 failing stubs — consistent with Phase 14 KYC test stubs pattern"

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

duration: 15min
completed: 2026-06-21
---

# Phase 15 Plan 01: Delivery Service TDD RED Stubs Summary

**9 failing Jest unit test stubs for DeliveryService (8) and DeliveryExpiryService (1) establish TDD contract for Phase 15 delivery system — all tests fail RED with skeleton classes throwing Error not implemented**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-21T13:20:00Z
- **Completed:** 2026-06-21T13:35:00Z
- **Tasks:** 1 (single TDD RED task)
- **Files modified:** 5

## Accomplishments
- Created `backend/src/delivery/` directory with skeleton service files and spec files
- 9 unit test stubs confirmed failing RED (`npx jest delivery --no-coverage` → 9 FAILED, exit code 1)
- Zero new TypeScript errors introduced (2 pre-existing errors in auth/sellers remain deferred)
- `DeliveryStatus` enum (PENDING/ACCEPTED/DECLINED/COMPLETED/CANCELLED) added to schema.prisma

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED stubs — 9 failing delivery unit tests** - `145c6b6b` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/src/delivery/delivery.service.spec.ts` - 8 failing stubs (DEL-01..DEL-08): offer guard, duplicate guard, radius guard, distance+cost storage, ForbiddenException non-seller, decline notification, cancel PENDING guard, complete ACCEPTED guard
- `backend/src/delivery/delivery-expiry.service.spec.ts` - 1 failing stub (DEL-09): 48h expiry cron sweep asserts findMany called with PENDING status
- `backend/src/delivery/delivery.service.ts` - Skeleton class; all 5 methods throw Error('not implemented')
- `backend/src/delivery/delivery-expiry.service.ts` - Skeleton class; handleDeliveryExpiry throws Error('not implemented')
- `backend/prisma/schema.prisma` - DeliveryStatus enum added after PurchaseStatus

## Decisions Made
- Tests for "guard" behaviour (DEL-01..03, DEL-05, DEL-07, DEL-08) assert `.rejects.toThrow(BadRequestException)` or `.rejects.toThrow(ForbiddenException)` — skeleton throws plain `Error`, which does NOT match the constructor assertion, causing RED failure
- Tests for "side-effect" behaviour (DEL-04, DEL-06, DEL-09) await the call without `.rejects` — skeleton throws, so the await rejects and test fails RED
- Skeleton files are minimal: just the class and method stubs — no imports, no decorators. Plan 02 will add NestJS DI decorators and real logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Initial attempt used `rejects.toThrow()` (without constructor argument) which caused all 9 tests to PASS (the skeleton's Error throw satisfied the generic matcher). Fixed by using specific NestJS exception classes as the matcher argument and using direct `await` for tests that expect resolution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can now implement `delivery.service.ts` and `delivery-expiry.service.ts` with full NestJS DI, making all 9 tests GREEN
- Google Maps Distance Matrix API key (`GOOGLE_MAPS_API_KEY`) will be required for DEL-03/DEL-04 tests in Plan 02
- Schema migration needed in Plan 02: `DeliveryRequest` model + new `Listing` delivery fields + `deliveryMaxMiles`/`deliveryPricePerMile`

---
*Phase: 15-delivery-and-distance-system*
*Completed: 2026-06-21*
