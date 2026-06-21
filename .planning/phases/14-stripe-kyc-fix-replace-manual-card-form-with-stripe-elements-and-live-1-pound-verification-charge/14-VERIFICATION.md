---
phase: 14-stripe-kyc-fix-replace-manual-card-form-with-stripe-elements-and-live-1-pound-verification-charge
verified: 2026-06-21T13:00:00Z
status: human_needed
score: 10/10 automated must-haves verified
re_verification: false
human_verification:
  - test: "Declined card (4000000000000002) shows inline error and blocks KYC submission"
    expected: "Card error message appears below card form; KYC is not submitted; form stays on step 3"
    why_human: "Requires real Stripe Elements interaction in a browser — cannot grep for runtime card-decline behaviour"
  - test: "Successful charge (4242 4242 4242 4242) completes KYC submission and £1 appears in Stripe dashboard"
    expected: "Success message displayed; KYC record saved with stripePaymentIntentId; £1 GBP payment visible in Stripe"
    why_human: "End-to-end payment confirmation requires live Stripe test environment and Stripe dashboard inspection"
  - test: "Re-visiting the KYC form as the same dealer shows green tick (already-paid state), not the card form"
    expected: "Step 3 shows CheckCircle + 'Verification fee paid · £1 charged on [date]'; no CardElement visible"
    why_human: "Requires a dealer account that has already been charged — depends on live DB state from test above"
  - test: "Admin panel shows Stripe Verified badge for new-flow records"
    expected: "Payment Verification section shows ShieldCheck + 'Stripe Verified · Auto-Approved' + PaymentIntent ID; no approve/reject buttons for that section"
    why_human: "Requires admin login and a real KYC submission with stripePaymentIntentId — live data dependent"
  - test: "Legacy KYC records still show paymentReference and paymentScreenshot fields in admin"
    expected: "Old records without stripePaymentIntentId render the normal catFields.map bank transfer fields — no regression"
    why_human: "Requires existing legacy KYC records in the DB to observe conditional rendering branch"
---

# Phase 14: Stripe KYC Fix Verification Report

**Phase Goal:** Replace the manual "Payment Verification" step in the dealer KYC form with a Stripe Elements card form that charges a live £1 verification fee. Successful charge auto-approves the payment section for admin review.
**Verified:** 2026-06-21T13:00:00Z
**Status:** human_needed (all automated checks pass; 5 items require runtime/live verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `POST /dealers/kyc/payment-intent` endpoint exists and is wired to `createKycPaymentIntent()` | VERIFIED | `dealers.controller.ts:178` — `@Post('kyc/payment-intent')` calls `this.dealersService.createKycPaymentIntent(user.id)` |
| 2 | `createKycPaymentIntent()` returns `{ alreadyPaid: true, chargedAt }` when KYC already has `stripeChargedAt` | VERIFIED | `dealers.service.ts:292-294` — early return guards; unit test KYC-PAY-01 confirms GREEN |
| 3 | `createKycPaymentIntent()` returns existing PI `client_secret` for `requires_payment_method` status | VERIFIED | `dealers.service.ts:299-305`; unit test KYC-PAY-02 GREEN |
| 4 | `submitKyc()` throws `BadRequestException` when PI status is not `succeeded` | VERIFIED | `dealers.service.ts:133-139`; unit test KYC-PAY-03 GREEN |
| 5 | `stripePaymentIntentId` and `stripeChargedAt` saved to `DealerKyc` on confirmed charge | VERIFIED | `dealers.service.ts:218-221, 262-265` (both update and create paths); unit test KYC-PAY-04 GREEN |
| 6 | Payment fields auto-approved in `documentStatuses` when Stripe-verified | VERIFIED | `dealers.service.ts:206-209, 250-253` (both code paths); unit test KYC-PAY-05 GREEN |
| 7 | DealerKyc schema has `stripePaymentIntentId String?` and `stripeChargedAt DateTime?`; `paymentReference` nullable | VERIFIED | `schema.prisma:410-412`; migration `20260621_add_kyc_stripe_fields` present |
| 8 | `createKycPaymentIntent()` exported from `dealerApi.ts`; `DealerKycData` has Stripe fields | VERIFIED | `dealerApi.ts:50-60`; interface has `stripePaymentIntentId?`, `stripeChargedAt?`, `paymentReference?` at lines 22-24 |
| 9 | KycOverlayForm step 3 replaced with Stripe `CardElement` and atomic charge-then-submit | VERIFIED | `KycOverlayForm.tsx:31,378,924` — `CardElement`, `Elements`, `confirmCardPayment` all present; step label "Payment Verification" at line 733 |
| 10 | Admin panel shows Stripe Verified badge for records with `stripePaymentIntentId`; legacy falls through | VERIFIED | `dealer-verification/page.tsx:510-539` — conditional early return with `ShieldCheck` badge; legacy `catFields.map` path intact |

**Score:** 10/10 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/dealers/dealers.service.spec.ts` | 5 unit test stubs (Plans 01-02) | VERIFIED | File exists; 5 tests covering KYC-PAY-01 through KYC-PAY-05; module-level `mockPaymentIntentsRetrieve/Create` pattern |
| `backend/prisma/schema.prisma` | `stripePaymentIntentId String?`, `stripeChargedAt DateTime?`, `paymentReference String?` | VERIFIED | Lines 408-412 confirm all three fields with correct types |
| `backend/prisma/migrations/20260621_add_kyc_stripe_fields/migration.sql` | Migration file for Stripe fields | VERIFIED | Directory and `migration.sql` file exist |
| `backend/src/dealers/dealers.service.ts` | `createKycPaymentIntent()` + updated `submitKyc()` + `getStripe()` + `notifyAdminsOfKycPayment()` | VERIFIED | All four methods present; `ConfigService` injected in constructor |
| `backend/src/dealers/dealers.controller.ts` | `POST kyc/payment-intent` route before `POST kyc` | VERIFIED | `@Post('kyc/payment-intent')` at line 178, confirmed before `@Post('kyc')` |
| `backend/src/dealers/dto/create-kyc.dto.ts` | `paymentReference` optional; `stripePaymentIntentId?` added | VERIFIED | `paymentReference` is `@IsOptional()` at line 77; `stripePaymentIntentId?` at line 88 |
| `src/lib/dealerApi.ts` | `createKycPaymentIntent()` exported; `DealerKycData` extended | VERIFIED | Function at lines 50-60; interface fields at lines 22-24 |
| `src/components/dashboard/KycOverlayForm.tsx` | `CardElement`, `Elements`, `confirmPaymentRef` pattern, already-paid state | VERIFIED | All imports at lines 30-33; `stripePromise` at line 41; `confirmPaymentRef` at line 268; already-paid UI at line 891 |
| `src/app/dashboard/admin/dealer-verification/page.tsx` | Stripe badge in `renderFieldsGrouped`; Stripe-aware `toggleExpand` | VERIFIED | Conditional at line 510; `ShieldCheck` at line 519; `isPaymentFieldStripeVerified` logic at lines 242-247 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `dealers.controller.ts` | `dealers.service.ts` | `POST /dealers/kyc/payment-intent` → `createKycPaymentIntent()` | WIRED | Line 183: `this.dealersService.createKycPaymentIntent(user.id)` |
| `dealers.service.ts` | Stripe API | `stripe.paymentIntents.retrieve(stripePaymentIntentId)` in `submitKyc()` | WIRED | Line 135: PI retrieved; status checked against `'succeeded'`; `BadRequestException` thrown on failure |
| `dealers.service.ts` | Stripe API | `stripe.paymentIntents.create({ amount: 100, currency: 'gbp' })` in `createKycPaymentIntent()` | WIRED | Lines 309-318: £1 PI created with `KYC_VERIFICATION` metadata and description |
| `KycOverlayForm.tsx` | `dealerApi.ts` | `createKycPaymentIntent()` called on step 3 load | WIRED | Line 339: `createKycPaymentIntent()` in `useEffect` triggered when `activeStep === 3` |
| `KycOverlayForm.tsx` | Stripe Elements | `stripe.confirmCardPayment(undefined, { payment_method: { card: CardElement } })` | WIRED | Line 361: `confirmCardPayment` call inside `confirmPaymentRef.current` closure |
| `KycOverlayForm.tsx` | `dealerApi.ts` | `submitDealerKyc(payload)` with `stripePaymentIntentId` in payload | WIRED | Lines 518-524: payload includes `stripePaymentIntentId: confirmedPiId` before calling `submitDealerKyc` |
| `dealer-verification/page.tsx` | `item.stripePaymentIntentId` | Conditional render in `renderFieldsGrouped` | WIRED | Line 510: `if (cat === 'Payment Verification' && item.stripePaymentIntentId)` returns badge JSX |

---

### Requirements Coverage

**Note:** Requirement IDs KYC-PAY-01 through KYC-PAY-07 appear in `ROADMAP.md` and all four PLAN files but are **not registered in `REQUIREMENTS.md`**. The `REQUIREMENTS.md` file covers mobile app requirements only (KYC-01 through KYC-05 are mobile identity verification, unrelated to this web dealer KYC flow). These KYC-PAY IDs are phase-specific requirements scoped within the roadmap only.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| KYC-PAY-01 | 14-01, 14-02 | `createKycPaymentIntent()` returns `alreadyPaid: true` when `stripeChargedAt` is set | SATISFIED | `dealers.service.ts:292-294`; unit test KYC-PAY-01 GREEN |
| KYC-PAY-02 | 14-01, 14-02 | `createKycPaymentIntent()` returns existing PI `client_secret` when PI status is `requires_payment_method` | SATISFIED | `dealers.service.ts:299-305`; unit test KYC-PAY-02 GREEN |
| KYC-PAY-03 | 14-01, 14-02 | `submitKyc()` throws `BadRequestException` when PI status is not `succeeded` | SATISFIED | `dealers.service.ts:133-139`; unit test KYC-PAY-03 GREEN |
| KYC-PAY-04 | 14-01, 14-02 | `submitKyc()` saves `stripePaymentIntentId` + `stripeChargedAt` on confirmed charge | SATISFIED | `dealers.service.ts:218-221, 262-265`; unit test KYC-PAY-04 GREEN |
| KYC-PAY-05 | 14-01, 14-02 | `submitKyc()` auto-approves `paymentReference`/`paymentScreenshot` in `documentStatuses` when Stripe-verified | SATISFIED | `dealers.service.ts:206-209, 250-253`; unit test KYC-PAY-05 GREEN |
| KYC-PAY-06 | 14-03, 14-04 | Declined card shows inline error and blocks KYC submission | NEEDS HUMAN | Code path exists (`cardError` state + return null from `confirmPaymentRef`); runtime confirmation needed |
| KYC-PAY-07 | 14-03, 14-04 | Already-paid dealer sees green tick state (no card form) on re-visit | NEEDS HUMAN | Code path exists (`alreadyPaid` state loaded from `kyc.stripeChargedAt`); runtime confirmation needed |

**Orphaned KYC-PAY IDs:** KYC-PAY-01 through KYC-PAY-07 are defined only in ROADMAP.md — they have no entries in REQUIREMENTS.md. This is expected given REQUIREMENTS.md tracks mobile app requirements separately. No action needed unless the team wants to add web-dealer requirements to REQUIREMENTS.md.

---

### Anti-Patterns Found

No blockers or warnings found across the modified files.

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| `dealers.service.ts:25-26` | `require('stripe')` instead of `import` | INFO | Intentional — dynamic import bypasses jest.mock in ts-jest; documented in summary as an auto-fixed deviation |
| `dealers.service.ts:222, 266` | `as any` type cast on Prisma data objects | INFO | Necessary because `stripePaymentIntentId`/`stripeChargedAt` are new fields and the generated Prisma client type needs regeneration after `prisma generate` was run — not a stub |
| `KycOverlayForm.tsx:361` | `confirmCardPayment(undefined as any, ...)` | INFO | Intentional — `undefined` is correct per Stripe docs when `clientSecret` is bound to the `Elements` provider options; `as any` suppresses the TypeScript overload mismatch |

---

### Human Verification Required

**Note:** Plan 14-04 was a human-verify checkpoint. The 14-04-SUMMARY.md claims all 5 tests passed on 2026-06-21. Because verification cannot confirm live Stripe interactions programmatically, these items remain flagged for human confirmation during this verification run.

#### 1. Declined Card Blocks Submission (KYC-PAY-06)

**Test:** Navigate to the dealer KYC form, complete steps 1-2, reach step 3. Enter Stripe test card `4000 0000 0000 0002` (always declines), any future expiry, any CVC. Click Submit.
**Expected:** Inline error appears below the card form ("Your card was declined." or similar). Form stays on step 3. KYC record is NOT created in the database.
**Why human:** Stripe Elements decline flow is a live runtime event — cannot be verified by static code analysis.

#### 2. Successful Charge Completes KYC (Happy Path)

**Test:** On step 3, enter Stripe test card `4242 4242 4242 4242`, expiry `12/30`, CVC `123`. Click Submit.
**Expected:** Success message "KYC documents submitted successfully!". Check Stripe dashboard — £1.00 GBP payment with description "Dealer KYC verification fee — Carmazium (non-refundable)" visible.
**Why human:** Requires live Stripe test mode execution and dashboard inspection.

#### 3. Already-Paid Green Tick State (KYC-PAY-07)

**Test:** Log in again as the same dealer account that just completed Test 2. Navigate to the KYC form. Advance to step 3.
**Expected:** Step 3 shows CheckCircle + "Verification fee paid" + formatted charge date. No CardElement visible.
**Why human:** Depends on live DB state from the previous successful submission.

#### 4. Admin Panel Stripe Verified Badge

**Test:** Log in as admin. Go to Admin → Dealer Verification. Open the KYC submission from Test 2.
**Expected:** In "Payment Verification" section: emerald ShieldCheck icon, "Stripe Verified · Auto-Approved" label, PaymentIntent ID in monospace, formatted charge date. No approve/reject controls for that section.
**Why human:** Requires a real KYC record with `stripePaymentIntentId` populated — live database dependent.

#### 5. Legacy Records Unaffected

**Test:** In Admin → Dealer Verification, open an older KYC record that has `paymentReference` but no `stripePaymentIntentId`.
**Expected:** "Payment Verification" section shows the normal bank transfer fields (paymentReference and paymentScreenshot) with their approve/reject controls — not the Stripe badge.
**Why human:** Requires existing legacy records in the database to verify the conditional rendering branch.

---

### Commits Verified

All commits documented in summaries confirmed in git history:

| Commit | Description | Status |
|--------|-------------|--------|
| `97df5b51` | 5 failing KYC payment unit test stubs (RED state) | VERIFIED |
| `4c7892c2` | Prisma schema migration — add Stripe KYC fields | VERIFIED |
| `74efe174` | Service/controller/DTO/spec implementation (5 tests GREEN) | VERIFIED |
| `b5450238` | Install `@stripe/react-stripe-js`; extend `dealerApi.ts` | VERIFIED |
| `cbc16402` | Replace KycOverlayForm step 3 with Stripe CardElement | VERIFIED |
| `c184c974` | Admin panel — conditional Stripe badge | VERIFIED |

---

### Gaps Summary

No gaps found in the automated verification. All 10 must-have truths are verified in the codebase. The `human_needed` status reflects that 5 items (KYC-PAY-06, KYC-PAY-07, and three admin/regression checks) require runtime confirmation with live Stripe test cards and a live database — these are inherently untestable by static analysis.

The 14-04-SUMMARY.md records that a human verification checkpoint was completed on 2026-06-21 with all 5 tests passing. If the team accepts that summary as sufficient evidence, the phase can be considered fully complete.

---

_Verified: 2026-06-21T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
