---
phase: "14"
plan: "02"
subsystem: backend
tags: [stripe, kyc, payment-intent, nestjs, prisma, tdd]
dependency_graph:
  requires: ["14-01"]
  provides: ["14-03", "14-04"]
  affects: ["backend/src/dealers", "backend/prisma"]
tech_stack:
  added: ["ConfigService injection in DealersService", "require('stripe') pattern for jest.mock compatibility"]
  patterns: ["PI verification before KYC save", "auto-approve documentStatuses on Stripe verify", "admin in-app notification on payment"]
key_files:
  created:
    - backend/prisma/migrations/20260621_add_kyc_stripe_fields/migration.sql
  modified:
    - backend/prisma/schema.prisma
    - backend/src/dealers/dto/create-kyc.dto.ts
    - backend/src/dealers/dealers.service.ts
    - backend/src/dealers/dealers.controller.ts
    - backend/src/dealers/dealers.service.spec.ts
decisions:
  - "Used require('stripe') instead of dynamic import() in getStripe() for jest.mock compatibility with ts-jest; payments.service pattern (dynamic import) not usable in test environment"
  - "paymentReference removed from requiredFields Set so Stripe-flow submissions (which omit it) don't write empty string to DB"
  - "notifyAdminsOfKycPayment sends SYSTEM type notification (KYC_PAYMENT_RECEIVED type not in notification enum)"
  - "ConfigModule is global (isGlobal:true in app.module.ts) so no change needed in DealersModule"
metrics:
  duration: "~30 minutes"
  completed: "2026-06-21T11:41:58Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
  files_created: 1
---

# Phase 14 Plan 02: Backend KYC Stripe Payment Intent & PI Verification Summary

**One-liner:** Prisma migration adds `stripePaymentIntentId`/`stripeChargedAt` to DealerKyc; new `POST /dealers/kyc/payment-intent` endpoint creates/retrieves £1 PaymentIntents; `submitKyc()` verifies PI status before saving and auto-approves payment documentStatuses when Stripe-verified — all 5 TDD tests GREEN.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Prisma schema migration — add Stripe fields | 4c7892c2 | schema.prisma, migrations/20260621_add_kyc_stripe_fields/migration.sql |
| 2 | DTO update, createKycPaymentIntent, new route, updated submitKyc | 74efe174 | dealers.service.ts, dealers.controller.ts, create-kyc.dto.ts, dealers.service.spec.ts |

## What Was Built

### Task 1 — Schema Migration
- `paymentReference String` → `String?` (nullable for Stripe-flow; legacy records unaffected)
- `stripePaymentIntentId String?` added to `DealerKyc`
- `stripeChargedAt DateTime?` added to `DealerKyc`
- Manual migration SQL file created at `backend/prisma/migrations/20260621_add_kyc_stripe_fields/migration.sql`
- Prisma client regenerated (`npx prisma generate`)
- `npx prisma validate` — schema valid

### Task 2 — Backend Implementation

**DTO (`create-kyc.dto.ts`):**
- `paymentReference` changed from `@IsNotEmpty()` + required to `@IsOptional()` + optional
- `stripePaymentIntentId?: string` field added

**DealersService (`dealers.service.ts`):**
- `ConfigService` injected in constructor for `STRIPE_SECRET_KEY` access
- `getStripe()` private method added — uses `require('stripe')` for jest.mock compatibility
- `createKycPaymentIntent(userId)` added:
  - Returns `{ alreadyPaid: true, chargedAt }` if KYC already has `stripeChargedAt`
  - Returns existing PI `client_secret` if PI status is `requires_payment_method`/`requires_confirmation`
  - Creates new £1 GBP PaymentIntent with `KYC_VERIFICATION` metadata
  - Stores PI id on existing KYC record; returns `client_secret`
- `submitKyc()` updated:
  - Stripe PI verification block before field processing: retrieves PI, throws `BadRequestException` if not `succeeded`
  - `paymentReference` removed from `requiredFields` Set (nullable in schema)
  - Auto-approves `paymentReference`/`paymentScreenshot` in `documentStatuses` when Stripe-verified
  - Saves `stripePaymentIntentId` + `stripeChargedAt: new Date()` to KYC record
  - Fires `notifyAdminsOfKycPayment()` before existing email alert
- `notifyAdminsOfKycPayment()` private method: sends `SYSTEM` type in-app notification to all admins

**DealersController (`dealers.controller.ts`):**
- `POST /dealers/kyc/payment-intent` route added BEFORE `POST /kyc` (NestJS top-down route matching)
- Returns `StandardResponse<{ clientSecret?: string; alreadyPaid: boolean; chargedAt?: Date }>`

**Test spec (`dealers.service.spec.ts`):**
- `ConfigService` added to both `TestingModule` providers with `{ get: jest.fn().mockReturnValue('sk_test_mock') }`
- `ConfigService` import added

## Test Results

```
PASS src/dealers/dealers.service.spec.ts (16.4s)
  DealersService — KYC: createKycPaymentIntent
    ✓ KYC-PAY-01: returns { alreadyPaid: true, chargedAt } when stripeChargedAt is already set
    ✓ KYC-PAY-02: returns { clientSecret, alreadyPaid: false } when existing PI needs payment method
  DealersService — KYC: submitKyc Stripe verification
    ✓ KYC-PAY-03: throws BadRequestException when Stripe PI status is not succeeded
    ✓ KYC-PAY-04: saves stripePaymentIntentId and stripeChargedAt when PI status is succeeded
    ✓ KYC-PAY-05: auto-approves paymentReference and paymentScreenshot in documentStatuses when Stripe-verified

Tests: 5 passed, 5 total
```

Full suite: 33 tests passed; 7 pre-existing failures in `listings.service.spec.ts` (unchanged DI error pre-dating this plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dynamic import() not intercepted by jest.mock in ts-jest**
- **Found during:** Task 2 (first test run — 4 of 5 tests failing with "Stripe is not a constructor")
- **Issue:** `await import('stripe')` inside `getStripe()` bypasses `jest.mock('stripe', ...)` in ts-jest; the Stripe constructor wasn't the mock
- **Fix:** Changed `getStripe()` to use `require('stripe')` (synchronous CommonJS require is reliably intercepted by jest.mock)
- **Files modified:** `backend/src/dealers/dealers.service.ts`
- **Commit:** 74efe174

**2. [Rule 2 - Missing] ConfigService not provided in test modules**
- **Found during:** Task 2 (test module compilation — DealersService now requires ConfigService in constructor)
- **Fix:** Added `{ provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('sk_test_mock') } }` to both `TestingModule` `providers` arrays; added `ConfigService` import
- **Files modified:** `backend/src/dealers/dealers.service.spec.ts`
- **Commit:** 74efe174

## Success Criteria Verification

- [x] DealerKyc schema has `stripePaymentIntentId String?` and `stripeChargedAt DateTime?`
- [x] `paymentReference` is `String?` (nullable) in schema and optional in DTO
- [x] `POST /dealers/kyc/payment-intent` endpoint registered (before `POST /kyc`)
- [x] `submitKyc()` verifies PI status via Stripe before saving; throws `BadRequestException` on non-succeeded PI
- [x] Auto-approves `paymentReference`/`paymentScreenshot` documentStatuses when Stripe-verified
- [x] Fires in-app admin notification when £1 charge is confirmed
- [x] All 5 unit tests GREEN (KYC-PAY-01 through KYC-PAY-05)
- [x] Full backend test suite: 0 new failures introduced (listings.service.spec.ts failures pre-existing)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| backend/src/dealers/dealers.service.ts | FOUND |
| backend/src/dealers/dealers.controller.ts | FOUND |
| backend/src/dealers/dto/create-kyc.dto.ts | FOUND |
| backend/prisma/migrations/20260621_add_kyc_stripe_fields/migration.sql | FOUND |
| 14-02-SUMMARY.md | FOUND |
| Commit 4c7892c2 (schema migration) | FOUND |
| Commit 74efe174 (service/controller/DTO/spec) | FOUND |
