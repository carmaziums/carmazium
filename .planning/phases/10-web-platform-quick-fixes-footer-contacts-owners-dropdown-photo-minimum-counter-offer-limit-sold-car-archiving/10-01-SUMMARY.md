---
phase: "10"
plan: "01"
subsystem: backend
tags: [prisma, schema, offers, counter-offer, photo-minimum, notifications]
dependency_graph:
  requires: []
  provides: [counter-tracking-schema, photo-min-guard, buyer-re-counter, expiry-check, limit-notifications]
  affects: [offers.service, listings.service, prisma-client]
tech_stack:
  added: []
  patterns: [prisma-db-push-remote, counter-attempt-tracking, expiry-auto-reject]
key_files:
  created:
    - backend/prisma/migrations/phase10_counter_tracking_departed_sale.sql
  modified:
    - backend/prisma/schema.prisma
    - backend/src/listings/dto/create-listing.dto.ts
    - backend/src/offers/offers.service.ts
    - backend/src/offers/offers.controller.ts
    - backend/src/offers/offers.service.spec.ts
decisions:
  - "Used npx prisma generate (no migrate dev) since DATABASE_URL is remote Supabase and not locally reachable; manual SQL migration file created for deployment"
  - "Notification type OFFER_COUNTERED reused for limit-reached events (actionType: COUNTER_LIMIT_REACHED) — no new enum value added per plan instructions"
  - "counterAttemptsBuyer exhaustion check uses gte: 5 with status IN [ACCEPTED, REJECTED] — seller-decided means negotiation is closed"
metrics:
  duration_seconds: 818
  completed_date: "2026-06-20"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 6
---

# Phase 10 Plan 01: Backend Schema + Service Logic Summary

**One-liner:** Prisma schema extended with 6 new fields (departed sale + counter tracking), enforcing 10-photo publish minimum, buyer re-counter path, 48h expiry auto-reject, 5-attempt counter limit with push+in-app notifications to both parties.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Prisma schema migration | 0edfed5a | schema.prisma, migrations/phase10_counter_tracking_departed_sale.sql |
| 2 | Update DTOs | 20cd6e85 | src/listings/dto/create-listing.dto.ts |
| 3 | Service logic | 5a792c61 | listings.service.ts, offers.service.ts, offers.controller.ts, offers.service.spec.ts |

## What Was Built

### schema.prisma
- `Listing` model: `isDepartedSale Boolean?`, `departedRelationship String?`
- `Offer` model: `counterAttemptsBuyer Int @default(0)`, `counterAttemptsSeller Int @default(0)`, `counterExpiresAt DateTime?`, `lastCounteredBy String?`
- Manual migration SQL created at `backend/prisma/migrations/phase10_counter_tracking_departed_sale.sql` (remote Supabase cannot be reached locally)
- `npx prisma generate` regenerated client successfully

### create-listing.dto.ts
- `isDepartedSale?: boolean` with `@IsOptional() @IsBoolean()`
- `departedRelationship?: string` with `@IsOptional() @IsString() @MaxLength(200)`
- `update-listing.dto.ts` inherits both via `PartialType` — no changes needed

### listings.service.ts — publishListing()
- Photo minimum guard added: throws `400 BadRequestException` if `listing.images.length < 10`

### offers.service.ts
- **respondToOffer()**: expiry check (COUNTERED offers past `counterExpiresAt` are auto-rejected); `counterAttemptsSeller >= 5` guard throws 400; increments `counterAttemptsSeller`, sets `lastCounteredBy: 'SELLER'`, sets `counterExpiresAt = now + 48h`; sends limit-reached notifications to buyer and seller when 5th counter is reached
- **respondToCounterOffer()**: now accepts `counterAmount?: number` 4th param; expiry check added; new COUNTERED branch lets buyer re-counter (increments `counterAttemptsBuyer`, sets `buyerCounterAmount`, `counterAmount` in sync, `lastCounteredBy: 'BUYER'`, `counterExpiresAt`); limit-reached notifications when buyer hits 5th counter; seller notified of re-counter
- **makeOffer()**: new exhaustion block — if buyer has prior offer with `counterAttemptsBuyer >= 5` AND status ACCEPTED/REJECTED, throws 400

### offers.controller.ts
- `respondToCounterOffer()` now passes `dto.counterAmount` to the service

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing missing EmailService mock in offers.service.spec.ts**
- **Found during:** Task 3 verification (jest run)
- **Issue:** `OffersService` constructor requires `EmailService` but the spec's `Test.createTestingModule` providers list did not include it — spec was written before EmailService was injected into OffersService. All 6 tests failed at module compilation.
- **Fix:** Added `EmailService` import and mock provider; added `$transaction: jest.fn((fn) => fn(prisma))` mock to prisma for buyer re-counter path
- **Files modified:** backend/src/offers/offers.service.spec.ts
- **Commit:** 5a792c61 (included in Task 3 commit)

**2. [Rule 3 - Blocking] Remote DB not reachable locally for prisma migrate dev**
- **Found during:** Task 1 execution
- **Issue:** `DATABASE_URL` points to `db.bwtnzmevjlowwronylxm.supabase.co` — `npx prisma db push` returned `P1001: Can't reach database server`
- **Fix:** Ran `npx prisma generate` only (no migration applied locally); created manual SQL migration file for deployment
- **Impact:** Migration must be applied to Supabase via the dashboard SQL editor or CI/CD pipeline using the file at `backend/prisma/migrations/phase10_counter_tracking_departed_sale.sql`

## Verification

- `npx prisma validate` — PASS
- `npx prisma generate` — PASS (client regenerated)
- `npx tsc --noEmit` — Only 2 pre-existing errors in auth.service.ts + sellers.service.ts (out of scope); zero new errors in modified files
- `npx jest offers.service.spec` — 6/6 PASS

## Self-Check: PASSED

Files confirmed:
- backend/prisma/schema.prisma — contains isDepartedSale, departedRelationship, counterAttemptsBuyer, counterAttemptsSeller, counterExpiresAt, lastCounteredBy
- backend/prisma/migrations/phase10_counter_tracking_departed_sale.sql — created
- backend/src/listings/dto/create-listing.dto.ts — contains isDepartedSale and departedRelationship
- backend/src/offers/offers.service.ts — contains counterAttemptsBuyer/Seller logic, buyer re-counter branch, expiry check, exhaustion block, limit-reached notifications
- backend/src/offers/offers.controller.ts — passes dto.counterAmount

Commits confirmed: 0edfed5a, 20cd6e85, 5a792c61
