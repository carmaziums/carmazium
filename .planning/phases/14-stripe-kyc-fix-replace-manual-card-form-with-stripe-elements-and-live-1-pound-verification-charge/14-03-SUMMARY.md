---
phase: "14"
plan: "03"
subsystem: frontend
tags: [stripe, kyc, react-stripe-js, card-elements, atomic-submit, admin-panel]
dependency_graph:
  requires: ["14-02"]
  provides: ["14-04"]
  affects: ["src/lib/dealerApi.ts", "src/components/dashboard/KycOverlayForm.tsx", "src/app/dashboard/admin/dealer-verification/page.tsx"]
tech_stack:
  added: ["@stripe/react-stripe-js", "loadStripe module-level init", "Elements/CardElement/useStripe/useElements hooks"]
  patterns: ["confirmPaymentRef ref pattern (inner CardForm exposes charge fn to outer handleSubmit)", "lazy PaymentIntent fetch on step change", "already-paid state from existing KYC record"]
key_files:
  created: []
  modified:
    - src/lib/dealerApi.ts
    - src/components/dashboard/KycOverlayForm.tsx
    - src/app/dashboard/admin/dealer-verification/page.tsx
decisions:
  - "Used confirmPaymentRef (useRef) pattern to bridge inner CardForm's useStripe/useElements hooks into outer handleSubmit; avoids invalid hook call outside Elements provider"
  - "PaymentIntent fetched lazily only when dealer reaches step 3 (not on mount) to avoid unnecessary Stripe API calls"
  - "confirmCardPayment called with undefined (not clientSecret string) because clientSecret is bound to Elements options prop"
  - "Admin panel: legacy records still show paymentReference + paymentScreenshot fields; only Stripe-verified records (stripePaymentIntentId set) see the badge"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-21T12:02:59Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
  files_created: 0
---

# Phase 14 Plan 03: Frontend KYC Stripe CardElement + Admin Badge Summary

**One-liner:** `@stripe/react-stripe-js` installed; KycOverlayForm step 3 replaced with inline Stripe CardElement that atomically charges £1 before KYC submit; admin panel shows auto-approved Stripe badge for new records while preserving legacy bank-transfer field rendering — zero TypeScript errors, Next.js build passes.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install @stripe/react-stripe-js + update dealerApi.ts | b5450238 | src/lib/dealerApi.ts, package.json |
| 2 | Replace KycOverlayForm.tsx step 3 with Stripe CardElement + atomic submit | cbc16402 | src/components/dashboard/KycOverlayForm.tsx |
| 3 | Admin panel — conditional Stripe badge for new records | c184c974 | src/app/dashboard/admin/dealer-verification/page.tsx |

## What Was Built

### Task 1 — dealerApi.ts + Package Install

**Package:**
- `@stripe/react-stripe-js` installed (1 package added); `@stripe/stripe-js` was already present at ^9.0.1

**DealerKycData interface:**
- `paymentReference: string` changed to `paymentReference?: string` (optional — new Stripe flow doesn't send it)
- `stripePaymentIntentId?: string` added
- `stripeChargedAt?: string` added

**New function `createKycPaymentIntent()`:**
- Calls `POST /dealers/kyc/payment-intent`
- Returns `{ clientSecret?, alreadyPaid, chargedAt? }`
- Exported alongside existing getDealerKyc/submitDealerKyc

### Task 2 — KycOverlayForm.tsx

**Imports added:**
- `loadStripe` from `@stripe/stripe-js`
- `Elements`, `CardElement`, `useStripe`, `useElements` from `@stripe/react-stripe-js`
- `createKycPaymentIntent` from `@/lib/dealerApi`
- `CheckCircle` from `lucide-react` (for already-paid state)

**Module-level initialization:**
- `const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)` outside component

**New state variables:**
- `clientSecret`, `alreadyPaid`, `paidAt`, `stripeLoading`, `stripePaymentIntentId`, `cardError`
- `confirmPaymentRef` (useRef) — bridge between inner CardForm hooks and outer handleSubmit

**Inner `CardForm` component (defined inside KycOverlayForm):**
- `useStripe()` + `useElements()` hooks (valid only inside Elements provider)
- Sets `confirmPaymentRef.current` to async charge function on hook updates
- `confirmCardPayment(undefined, { payment_method: { card: CardElement } })` — undefined because clientSecret already bound to Elements
- Renders `<CardElement>` with dark theme styling (color #e2e8f0, invalid #f87171)

**useEffect (step 3 lazy load):**
- Fetches PaymentIntent only when `activeStep === 3 && !alreadyPaid && !clientSecret`
- Sets `alreadyPaid/paidAt` if already charged; sets `clientSecret` otherwise

**validateStep(3) updated:**
- Removed `paymentReference.trim()` check
- New check: `!alreadyPaid && !clientSecret` → "Payment not ready" error

**handleSubmit rewritten:**
- Step 1: If not already paid, calls `confirmPaymentRef.current()` — declined card returns null, blocks submission
- Step 2: Submits KYC payload with `stripePaymentIntentId` field included

**loadKyc useEffect updated:**
- Removed `paymentReference` + `paymentScreenshot` population
- Added: if `kyc.stripeChargedAt` → sets `alreadyPaid`, `paidAt`, `stripePaymentIntentId`

**Step 3 JSX replaced:**
- **Already-paid**: green CheckCircle, "Verification fee paid", formatted charge date
- **Loading**: Loader2 spinner, "Preparing payment form..."
- **Card form**: £1.00 fee card + `<Elements><CardForm/></Elements>` + card error display
- **Error fallback**: "Failed to load payment form. Please refresh the page."

**Step 3 progress label:** "Bank Transfer" → "Payment Verification"

**formData state:** removed `paymentReference: ""`

**fileUrls state:** removed `paymentScreenshot: ""`

### Task 3 — Admin Panel (dealer-verification/page.tsx)

**toggleExpand decisions loop:**
- Added `isPaymentFieldStripeVerified` check: if `dealerKyc.stripePaymentIntentId` and field is `paymentReference` or `paymentScreenshot` → auto-APPROVED with note "Stripe verified"
- Legacy path unchanged (REJECTED preserved, everything else APPROVED)

**renderFieldsGrouped():**
- Added early return for `cat === 'Payment Verification' && item.stripePaymentIntentId`
- Returns Stripe Verified badge: `ShieldCheck` icon + "Stripe Verified · Auto-Approved" label + PaymentIntent ID in monospace + charge date
- Legacy records fall through to normal `catFields.map` rendering (bank transfer fields unchanged)

## Test Results

```
npx tsc --noEmit → 0 errors (zero output)
npm run build → ✓ Compiled successfully in 60s; ✓ Generating static pages (83/83)
```

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria Verification

- [x] `@stripe/react-stripe-js` installed and importable
- [x] `createKycPaymentIntent()` exported from dealerApi.ts
- [x] `DealerKycData` has `stripePaymentIntentId?`, `stripeChargedAt?`, `paymentReference?` (optional)
- [x] KycOverlayForm.tsx step 3 shows Stripe CardElement (card input, not bank transfer instructions)
- [x] Already-paid dealers see green tick on step 3 instead of card form
- [x] Admin panel shows Stripe badge for new-flow records; legacy fields for old records
- [x] Zero TypeScript errors
- [x] `npm run build` succeeds

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/dealerApi.ts | FOUND |
| src/components/dashboard/KycOverlayForm.tsx | FOUND |
| src/app/dashboard/admin/dealer-verification/page.tsx | FOUND |
| 14-03-SUMMARY.md | FOUND |
| Commit b5450238 (dealerApi.ts + package install) | FOUND |
| Commit cbc16402 (KycOverlayForm.tsx) | FOUND |
| Commit c184c974 (admin panel) | FOUND |
