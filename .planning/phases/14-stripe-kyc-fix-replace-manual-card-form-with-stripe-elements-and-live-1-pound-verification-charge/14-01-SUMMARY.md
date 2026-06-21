---
phase: 14-stripe-kyc-fix-replace-manual-card-form-with-stripe-elements-and-live-1-pound-verification-charge
plan: "01"
subsystem: backend/dealers
tags: [tdd, stripe, kyc, unit-tests, red-state]
dependency_graph:
  requires: []
  provides: [backend/src/dealers/dealers.service.spec.ts]
  affects: [backend/src/dealers/dealers.service.ts]
tech_stack:
  added: []
  patterns: [NestJS TestingModule, jest.mock with module-level variables, TDD RED phase]
key_files:
  created:
    - backend/src/dealers/dealers.service.spec.ts
  modified: []
decisions:
  - "Stripe mock uses module-level jest.fn() variables (mockPaymentIntentsRetrieve/Create) rather than per-test re-mocking, because dynamic import caches the mock factory result and StripeMock.default is not a jest.Mock in that pattern"
  - "submitKyc tests pass stripePaymentIntentId in the DTO (baseDto) to indicate the Stripe path — Plan 02 will need to handle this DTO field and conditionally call paymentIntents.retrieve"
metrics:
  duration: "~3 minutes"
  completed: 2026-06-21
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 14 Plan 01: KYC Payment Test Stubs Summary

Five failing unit tests for KYC Stripe payment service methods in `dealers.service.spec.ts`, establishing RED state before Plan 02 backend implementation.

## What Was Built

`backend/src/dealers/dealers.service.spec.ts` — two describe blocks with 5 failing test stubs covering `createKycPaymentIntent` (KYC-PAY-01, KYC-PAY-02) and the Stripe verification path of `submitKyc` (KYC-PAY-03, KYC-PAY-04, KYC-PAY-05).

## Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Write 5 failing KYC payment unit test stubs | 97df5b51 | backend/src/dealers/dealers.service.spec.ts |

## Test Results (RED State Confirmed)

```
Tests:  5 failed, 5 total
```

Failure modes per test:
- **KYC-PAY-01** — `TypeError: service.createKycPaymentIntent is not a function`
- **KYC-PAY-02** — `TypeError: service.createKycPaymentIntent is not a function`
- **KYC-PAY-03** — Promise resolved instead of rejected (no Stripe check in submitKyc yet)
- **KYC-PAY-04** — `stripePaymentIntentId` not present in prisma.dealerKyc.create call data
- **KYC-PAY-05** — `paymentReference.status` received "PENDING", expected "APPROVED"

Zero TypeScript errors introduced. Two pre-existing TS errors in `auth.service.ts` and `sellers.service.ts` remain unrelated to this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stripe mock pattern adjusted from plan spec**
- **Found during:** Task 1 — first test run
- **Issue:** The plan's suggested `beforeEach` pattern `(await import('stripe') as any).default.mockImplementation(...)` fails because the jest.mock factory captures the `jest.fn()` return value, not the mock function itself. `StripeMock.mockImplementation is not a function`.
- **Fix:** Declared `mockPaymentIntentsRetrieve` and `mockPaymentIntentsCreate` as module-level `jest.fn()` variables. The `jest.mock` factory captures these in closure. Each `beforeEach` calls `mockReset()` on them. This bypasses the dynamic import caching issue entirely.
- **Files modified:** `backend/src/dealers/dealers.service.spec.ts`
- **Commit:** 97df5b51

## Decisions Made

- Stripe mock uses module-level `jest.fn()` closure variables — the pattern in the plan spec would have failed at runtime due to how Jest caches module mock factories.
- `submitKyc` tests pass `stripePaymentIntentId` via the DTO. Plan 02 must read this field and conditionally call `stripe.paymentIntents.retrieve` — the current implementation ignores it (no Stripe calls in `submitKyc` yet).

## Self-Check: PASSED

- `backend/src/dealers/dealers.service.spec.ts` — FOUND
- Commit `97df5b51` — FOUND
- 5 tests failing (RED state) — CONFIRMED
