# Phase 14: Stripe KYC Fix - Research

**Researched:** 2026-06-21
**Domain:** Stripe Elements (CardElement), PaymentIntent API, NestJS backend extension, React KYC form
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**£1 Charge Fate**
- Keep, never refund — the £1 is platform income; it is never refunded regardless of KYC outcome
- Charged once per dealer lifetime — if a dealer's KYC is rejected and they resubmit, they are NOT charged again; system records the prior charge and skips the payment step
- Framed as "Verification Fee" — copy says "£1.00 verification fee (non-refundable)" before card entry

**Submit Button Behaviour**
- Single atomic action — clicking "Submit" triggers the Stripe charge AND form submission simultaneously; no separate "Pay" button
- Payment failure blocks everything — if the £1 charge fails, entire submission is blocked; no partial save; dealer corrects card and resubmits

**Stripe Card Form Placement**
- Replaces the "Payment Verification" section in the existing 3-step multi-section KYC form (step 3: "Bank Transfer")
- Inline Stripe CardElement — always visible in the payment section from the moment the form loads
- Amount shown above inputs — "£1.00 verification fee" displayed above the Stripe CardElement
- On resubmission (already paid) — payment section replaced with a green tick + "Verification fee paid — £1 charged on [date]"; card form not rendered

**Failed Payment Handling**
- Inline Stripe error messages — card decline errors surface inline within the payment section
- Unlimited retries per session — no rate limit on payment attempts
- Entire submission blocked — payment failure = nothing saved

**Backend: PaymentIntent Lifecycle**
- PaymentIntent created on form load — when dealer navigates to the KYC form, backend creates a PaymentIntent and returns `client_secret`; idempotent (return existing PI if dealer already has one that hasn't been confirmed)
- Store Stripe metadata on KYC record — two new fields: `stripePaymentIntentId String?` and `stripeChargedAt DateTime?` on DealerKyc
- Legacy submissions untouched — existing KYC records with `paymentReference` keep their data

**Admin Review Flow**
- Auto-approved payment section — a successful £1 charge means payment section is automatically marked approved
- Admin sees: PaymentIntent ID + charge date in the KYC review panel
- Two admin notifications — (1) push/in-app when £1 is successfully charged ("Dealer X has paid the verification fee"), (2) existing KYC submission notification when full form is submitted

### Claude's Discretion
None specified — all decisions were locked during discussion.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase 14 scope.

</user_constraints>

---

## Summary

Phase 14 replaces the manual "Payment Verification" step in `KycOverlayForm.tsx` (step 3 — which currently shows bank account details + a text reference + screenshot upload) with an inline Stripe `CardElement` that captures and confirms a live £1 charge before form submission. The backend gains a new `POST /dealers/kyc/payment-intent` endpoint and the existing `POST /dealers/kyc` endpoint must verify the PaymentIntent status before saving.

The frontend already has `@stripe/stripe-js` installed but does NOT have `@stripe/react-stripe-js`. That package must be installed. The pattern (loadStripe → Elements → CardElement → confirmCardPayment) is standard Stripe Elements flow and well-documented. The existing `payments.service.ts` already creates PaymentIntents for the React Native payment sheet, so the backend pattern is established. The admin panel's `KYC_FIELDS` array at lines 50-51 needs conditional rendering for new vs legacy records.

**Primary recommendation:** Install `@stripe/react-stripe-js`, add the `createKycPaymentIntent()` function in `dealerApi.ts`, and wire `CardElement` into step 3 of `KycOverlayForm.tsx` with `stripe.confirmCardPayment(clientSecret)` on submit. The backend creates a simple PaymentIntent (no Stripe Customer required — this is a one-off non-saved card charge) and verifies status in the submit handler.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@stripe/react-stripe-js` | `^3.x` | React bindings for Stripe Elements (Elements provider, CardElement, useStripe, useElements hooks) | Official Stripe React integration; required for CardElement in React/Next.js |
| `@stripe/stripe-js` | `^9.0.1` (already installed) | loadStripe() to load the Stripe.js script | Already in package.json |
| `stripe` (backend) | already installed in backend | PaymentIntent creation + verification | Already used in payments.service.ts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prisma migration | existing toolchain | Add two new optional columns to DealerKyc | Standard Prisma workflow already established |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CardElement | PaymentElement | PaymentElement is newer but overly complex for a single non-saved card charge; CardElement is simpler for inline forms |
| CardElement | Stripe Checkout redirect | Checkout would redirect away from the KYC form, breaking atomic submission requirement |
| confirmCardPayment | confirmPayment | confirmPayment is PaymentElement-specific; confirmCardPayment works with CardElement |

**Installation (frontend only — backend stripe package already installed):**
```bash
npm install @stripe/react-stripe-js
```

---

## Architecture Patterns

### Recommended Project Structure for Changes

```
src/
├── lib/
│   └── dealerApi.ts          # Add createKycPaymentIntent() function
├── components/dashboard/
│   └── KycOverlayForm.tsx    # Replace step 3 Payment Verification section
└── app/dashboard/admin/dealer-verification/
    └── page.tsx              # Conditional rendering for new vs legacy payments

backend/src/
├── dealers/
│   ├── dealers.controller.ts  # Add POST /dealers/kyc/payment-intent route
│   ├── dealers.service.ts     # Add createKycPaymentIntent() + update submitKyc()
│   └── dto/
│       └── create-kyc.dto.ts  # Add optional stripePaymentIntentId field
└── prisma/
    └── schema.prisma          # Add stripePaymentIntentId + stripeChargedAt to DealerKyc
```

### Pattern 1: Stripe Elements Setup in Next.js (CardElement approach)

**What:** Wrap the payment section with an `Elements` provider seeded with a PaymentIntent's `client_secret`. Use the `CardElement` component and `confirmCardPayment` hook on submit.

**When to use:** Any inline card capture where you want the charge to happen synchronously during a form submit (no redirect, no modal).

**Example:**
```typescript
// Source: Stripe official docs — Elements + CardElement
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Outer wrapper provides the clientSecret from the PI
function PaymentSection({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardForm />
    </Elements>
  );
}

// Inner form uses the hooks
function CardForm() {
  const stripe = useStripe();
  const elements = useElements();

  const charge = async (): Promise<string | null> => {
    if (!stripe || !elements) return null;
    const { error, paymentIntent } = await stripe.confirmCardPayment(undefined, {
      payment_method: { card: elements.getElement(CardElement)! },
    });
    if (error) throw new Error(error.message);
    if (paymentIntent?.status === 'succeeded') return paymentIntent.id;
    return null;
  };

  return <CardElement />;
}
```

**Key detail:** When the `Elements` component receives a `clientSecret` option, `confirmCardPayment` uses that PI automatically — you do NOT need to pass the `clientSecret` string again as the first argument to `confirmCardPayment`. Pass `undefined` or omit it.

### Pattern 2: Idempotent PaymentIntent Creation (Backend)

**What:** On `GET /dealers/kyc/payment-intent`, check if the dealer's KYC record already has a `stripePaymentIntentId` where the PI status is NOT `succeeded`. If so, return the existing PI's `client_secret`. Only create a new PI if none exists or the existing one is expired/cancelled.

**Example:**
```typescript
// In dealers.service.ts
async createKycPaymentIntent(userId: string) {
  const profile = await this.getOrCreateDealerProfile(userId);
  const kyc = await this.prisma.dealerKyc.findUnique({
    where: { dealerProfileId: profile.id },
  });

  // Already paid — skip
  if (kyc?.stripePaymentIntentId && kyc?.stripeChargedAt) {
    return { alreadyPaid: true, chargedAt: kyc.stripeChargedAt };
  }

  // Check if existing PI is still usable
  if (kyc?.stripePaymentIntentId) {
    const stripe = await this.getStripe(); // reuse lazy getter pattern
    try {
      const pi = await stripe.paymentIntents.retrieve(kyc.stripePaymentIntentId);
      if (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation') {
        return { clientSecret: pi.client_secret, alreadyPaid: false };
      }
    } catch { /* fall through to create new */ }
  }

  // Create new PI
  const stripe = await this.getStripe();
  const pi = await stripe.paymentIntents.create({
    amount: 100, // £1.00 in pence
    currency: 'gbp',
    metadata: { type: 'KYC_VERIFICATION', dealerProfileId: profile.id, userId },
    description: 'Dealer KYC verification fee — Carmazium (non-refundable)',
  });

  return { clientSecret: pi.client_secret, alreadyPaid: false };
}
```

### Pattern 3: Atomic Submit — Charge then Submit

**What:** The KYC submit handler in the frontend calls `stripe.confirmCardPayment()` first. Only if it resolves with `status: 'succeeded'` does it then call `submitDealerKyc()`. If the charge fails, the error is shown inline and submission is blocked.

**Example:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateStep(3)) return;
  setSubmitting(true);
  setErrorMsg('');

  try {
    // Step 1: Charge (if not already paid)
    if (!alreadyPaid) {
      const { error, paymentIntent } = await stripe!.confirmCardPayment(undefined, {
        payment_method: { card: elements!.getElement(CardElement)! },
      });
      if (error) {
        setErrorMsg(error.message ?? 'Card declined. Please check your card details.');
        setSubmitting(false);
        return; // Block submission
      }
      if (paymentIntent?.status !== 'succeeded') {
        setErrorMsg('Payment did not complete. Please try again.');
        setSubmitting(false);
        return;
      }
      confirmedPaymentIntentId = paymentIntent.id;
    }

    // Step 2: Submit KYC (includes paymentIntentId for backend verification)
    const payload = { ...formData, ...fileUrls, stripePaymentIntentId: confirmedPaymentIntentId };
    const response = await submitDealerKyc(payload);
    setKycData(response);
    setSuccessMsg('KYC documents submitted successfully!');
  } catch (err: any) {
    setErrorMsg(err.message || 'Failed to submit KYC data.');
  } finally {
    setSubmitting(false);
  }
};
```

### Pattern 4: Admin Panel Conditional Rendering

**What:** In the `KYC_FIELDS` array in the admin panel, the `paymentReference` and `paymentScreenshot` fields will coexist with a new Stripe badge display. Use conditional rendering: if `item.stripePaymentIntentId` is set, render the Stripe badge instead of the field value for the Payment Verification category.

```typescript
// In renderFieldsGrouped, for the "Payment Verification" category:
if (cat === 'Payment Verification') {
  if (item.stripePaymentIntentId) {
    // New Stripe flow — render auto-approved badge
    return <StripeVerifiedBadge piId={item.stripePaymentIntentId} chargedAt={item.stripeChargedAt} />;
  }
  // Legacy flow — render existing paymentReference + paymentScreenshot fields
}
```

### Anti-Patterns to Avoid

- **Passing `clientSecret` twice:** Do NOT pass the clientSecret as the first arg to `confirmCardPayment` if you already provided it to the `Elements` component via `options={{ clientSecret }}`. It is used automatically.
- **Creating a PI on every page render:** The PI creation must be called once per dealer (idempotent) — not triggered by React re-renders. Use a `useEffect` with proper dependency tracking.
- **Stripe Customer creation for this charge:** Not required. The £1 KYC charge is a one-off non-saved card charge. Do NOT create a Stripe Customer for this (it's not a returning customer payment scenario). The backend PI creation skips the customer/ephemeralKey dance used in the payment sheet.
- **Passing `paymentReference` in the new flow:** Remove it from required fields in `validateStep(3)` when the dealer is using the new Stripe flow.
- **Not verifying PI on backend:** Never trust the frontend to claim the charge succeeded. The `submitKyc()` backend method MUST call `stripe.paymentIntents.retrieve(stripePaymentIntentId)` and verify `status === 'succeeded'` before saving the record.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card number input + validation | Custom `<input type="text">` for PAN, expiry, CVC | `CardElement` from `@stripe/react-stripe-js` | PCI compliance — raw card data must never touch your servers; Stripe Elements tokenizes on Stripe's domain |
| Card decline error parsing | `if (err.code === 'card_declined')` custom switch | `error.message` from `stripe.confirmCardPayment()` | Stripe returns localised, user-friendly decline messages for all codes |
| Idempotency on retries | Custom PI deduplication table | Stripe PI status check + PI `requires_payment_method` re-use | PIs are reusable until succeeded/cancelled; just retrieve and re-confirm |

**Key insight:** Card input in the browser must always go through Stripe.js (PCI DSS compliance). Any custom card field that transmits card data through your server is a PCI scope violation.

---

## Common Pitfalls

### Pitfall 1: `@stripe/react-stripe-js` Not Installed

**What goes wrong:** `CardElement`, `Elements`, `useStripe`, `useElements` — all from `@stripe/react-stripe-js` — are import errors at build time because only `@stripe/stripe-js` is currently installed.

**Why it happens:** The existing checkout page (`src/app/checkout/page.tsx`) uses Stripe Checkout (redirect-based) which only needs `@stripe/stripe-js` for the client. `@stripe/react-stripe-js` is the separate React component package.

**How to avoid:** `npm install @stripe/react-stripe-js` before writing any component code.

**Warning signs:** TypeScript error `Cannot find module '@stripe/react-stripe-js'` at import.

### Pitfall 2: `loadStripe` Called Inside a React Component

**What goes wrong:** Each render recreates the `stripePromise`, which causes the Stripe.js script to reload and the Elements provider to remount — losing card entry state.

**Why it happens:** `loadStripe()` is expensive and asynchronous. It must be called once at module scope, not inside a component or `useEffect`.

**How to avoid:** Define `const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)` at the top level of the module (outside any React component). This is a React-static pattern.

**Warning signs:** Card input clears itself on any state change; console warning about Stripe.js reinitializing.

### Pitfall 3: `confirmCardPayment` Without `clientSecret` in Elements Options

**What goes wrong:** If you pass `clientSecret` as the first argument to `confirmCardPayment` but did NOT set it on the `Elements` component `options`, or vice-versa — the call silently fails or Stripe throws "No such PaymentIntent."

**Why it happens:** When using the newer Elements `options={{ clientSecret }}` pattern, the PI is bound at the provider level and `confirmCardPayment(undefined, ...)` works. When using the older pattern, `confirmCardPayment(clientSecret, ...)` is required. Mixing the two patterns breaks.

**How to avoid:** Choose one pattern and be consistent. Recommended: pass `clientSecret` to `Elements` options and call `confirmCardPayment(undefined, { payment_method: { card: ... }})`.

### Pitfall 4: PaymentIntent Created Before `clientSecret` Is Available

**What goes wrong:** The `Elements` component renders before `clientSecret` state is populated, causing `options.clientSecret` to be `undefined`. Stripe throws a console error and `useStripe()` returns `null`.

**Why it happens:** `createKycPaymentIntent()` is async and the state update from the API call resolves after the first render.

**How to avoid:** Conditionally render the `Elements` wrapper only when `clientSecret` is a non-null string:
```typescript
{clientSecret ? (
  <Elements stripe={stripePromise} options={{ clientSecret }}>
    <CardForm />
  </Elements>
) : (
  <Loader2 className="animate-spin" /> // loading state
)}
```

### Pitfall 5: `paymentReference` Still Required in Backend DTO After Migration

**What goes wrong:** `CreateKycDto` currently has `@IsNotEmpty()` on `paymentReference`. New submissions won't include this field (they use Stripe instead). The backend will reject new submissions with a 400 validation error.

**Why it happens:** class-validator decorators enforce the constraint at the controller level before the service runs.

**How to avoid:** Change `paymentReference` to `@IsOptional() @IsString()` in `CreateKycDto` and add `@IsOptional() @IsString() stripePaymentIntentId?: string`. Also update `requiredFields` set in `dealers.service.ts` to remove `paymentReference`.

### Pitfall 6: Prisma Schema Migration Blocks `paymentReference`

**What goes wrong:** `paymentReference String` in the DealerKyc Prisma model is non-nullable. After migration adds the two new Stripe fields, the DB insert for new KYC submissions must provide a value for `paymentReference` or Prisma throws a not-null constraint violation.

**Why it happens:** Legacy schema has `paymentReference` as required (no `?`).

**How to avoid:** Two options — (a) make `paymentReference` optional in the schema (`paymentReference String?`) to allow new records with no bank reference, or (b) keep it required and default to empty string `''` in the service for new Stripe-flow submissions (as the service already does for required fields). Option (a) is cleaner. Update the schema: `paymentReference String?`.

### Pitfall 7: Admin Panel Crashes on New Records

**What goes wrong:** The admin panel's `renderFieldsGrouped` function iterates `KYC_FIELDS` and calls `item[field.id]` for `paymentReference`. For new Stripe-flow records, this is `null` or an empty string, which renders "Not provided" — acceptable. However, `paymentScreenshot` is `isProof: true`, so `hasValue` is false, and it renders a "No document uploaded" placeholder. This is fine for UX but may confuse admins into trying to reject a field that is intentionally absent.

**How to avoid:** Add conditional rendering for the "Payment Verification" category in `renderFieldsGrouped`: if `item.stripePaymentIntentId` exists, render the Stripe verified badge and skip the `paymentReference` / `paymentScreenshot` fields entirely. The payment section is auto-approved and does not need admin action.

### Pitfall 8: Admin Notification for "Fee Paid" Before KYC Submission

**What goes wrong:** Per the decisions, admin receives TWO notifications: one when the £1 is charged, one when the full form is submitted. The charge notification must fire from the BACKEND (not the frontend) to be reliable — it fires after the submit endpoint verifies the PI status as `succeeded`.

**Why it happens:** The frontend cannot be trusted to fire notifications (user could close the tab between charge and form submission).

**How to avoid:** In `dealers.service.ts submitKyc()`, after verifying the PI is `succeeded` and saving `stripePaymentIntentId` + `stripeChargedAt`, call `notificationsService.create()` for each admin with type `KYC_PAYMENT_RECEIVED` before firing the existing `notifyAdminsOfKycSubmission()` email. The "fee paid" notification and the "form submitted" notification both fire from the same `submitKyc()` call.

---

## Code Examples

Verified patterns from project codebase + Stripe official docs:

### How Existing Backend Creates a PaymentIntent (from payments.service.ts)
```typescript
// Source: backend/src/payments/payments.service.ts — createPaymentSheet()
private async getStripe() {
  const Stripe = (await import('stripe')).default;
  return new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
    apiVersion: '2026-02-25.clover', // project's locked API version
  });
}

const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100), // pence
  currency: 'gbp',
  // No 'customer' needed for the KYC one-off charge
  metadata: { type: 'KYC_VERIFICATION', userId, dealerProfileId: profile.id },
});
// Returns paymentIntent.client_secret to frontend
```

### Verifying a PI Status in Backend Submit Handler
```typescript
// In dealers.service.ts submitKyc() — verify before saving
const stripe = await this.getStripe();
const pi = await stripe.paymentIntents.retrieve(dto.stripePaymentIntentId);
if (pi.status !== 'succeeded') {
  throw new BadRequestException('Stripe payment verification failed — charge has not been confirmed.');
}
// Now safe to save stripePaymentIntentId + stripeChargedAt
```

### Admin Panel Stripe Badge (new records only)
```typescript
// In dealer-verification/page.tsx renderFieldsGrouped, "Payment Verification" category
if (cat === 'Payment Verification' && item.stripePaymentIntentId) {
  return (
    <div key={cat} className="space-y-3">
      <h4 className="text-xs font-black uppercase text-primary tracking-widest border-l-2 border-primary pl-2.5 flex items-center gap-2">
        <Receipt size={12} className="text-primary" />
        Payment Verification
      </h4>
      <div className="p-3 sm:p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
        <div className="flex items-center gap-3">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">
              Stripe Verified · Auto-Approved
            </p>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              {item.stripePaymentIntentId}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Charged {new Date(item.stripeChargedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### DealerApi.ts new function
```typescript
// Source: project pattern from src/lib/dealerApi.ts
export async function createKycPaymentIntent(): Promise<{ clientSecret?: string; alreadyPaid: boolean; chargedAt?: string }> {
  const result = await apiClient<{ data: { clientSecret?: string; alreadyPaid: boolean; chargedAt?: string } }>('/dealers/kyc/payment-intent', {
    method: 'POST',
  });
  return result.data;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual bank transfer + screenshot | Stripe Elements CardElement + PaymentIntent | Phase 14 | Eliminates manual admin verification of payment; reduces friction |
| `paymentReference` + `paymentScreenshot` DB fields | `stripePaymentIntentId` + `stripeChargedAt` (new) | Phase 14 migration | Old fields stay (no drop) for legacy records |
| Admin manually approves "Payment Verification" | Auto-approved on PI confirmation | Phase 14 | Admin only reviews KYC documents, not payment |

**Deprecated/outdated (after this phase):**
- Step 3 bank account details card: removed from the form UI (Apex Clearing UK / Sort Code / Account Number block)
- `paymentReference` text input in step 3: removed
- `paymentScreenshot` `FileUploadField` in step 3: removed
- `paymentReference` as required field in `validateStep(3)`: replaced with card element validation

---

## Integration Points (Summary)

### What Changes and Where

**1. Package install (frontend)**
```bash
npm install @stripe/react-stripe-js
```
`@stripe/stripe-js` is already at `^9.0.1`. `@stripe/react-stripe-js` is the companion React bindings package.

**2. Prisma schema (backend)**
Add to `DealerKyc` model:
```prisma
stripePaymentIntentId      String?   // Populated after confirmed £1 charge
stripeChargedAt            DateTime? // Timestamp of confirmed charge
```
Change `paymentReference String` → `paymentReference String?` (make nullable for new Stripe-flow records).

**3. Backend new endpoint**
`POST /dealers/kyc/payment-intent` in `dealers.controller.ts` + `dealers.service.ts`
- Idempotent: returns existing PI client_secret if still requires_payment_method
- Returns `{ clientSecret, alreadyPaid, chargedAt? }`

**4. Backend existing endpoint update**
`POST /dealers/kyc` in `dealers.service.ts submitKyc()`
- Accept optional `stripePaymentIntentId` in DTO
- If present: verify PI status via `stripe.paymentIntents.retrieve()` is `succeeded`
- Save `stripePaymentIntentId` + `stripeChargedAt: new Date()` to the record
- Fire admin "fee paid" in-app notification (new)
- Fire existing admin "KYC submitted" email notification

**5. Frontend `dealerApi.ts`**
- Add `createKycPaymentIntent()` function
- Update `DealerKycData` interface: add `stripePaymentIntentId?: string` + `stripeChargedAt?: string`
- Update `submitDealerKyc()` to pass `stripePaymentIntentId` in payload

**6. Frontend `KycOverlayForm.tsx`**
- Import `@stripe/react-stripe-js` and `loadStripe`
- In step 3: call `createKycPaymentIntent()` on form load → get `clientSecret`
- Replace entire step 3 payment section with:
  - "£1.00 verification fee (non-refundable)" label above
  - `Elements` provider wrapping `CardElement`
  - Card error display beneath
  - If `alreadyPaid`: green tick + "Verification fee paid · £1 charged on [date]" (no card form)
- Update `validateStep(3)`: remove `paymentReference` check; validate stripe/elements are loaded
- Update `handleSubmit()`: call `stripe.confirmCardPayment()` first; block on failure

**7. Frontend `admin/dealer-verification/page.tsx`**
- Add `stripePaymentIntentId` + `stripeChargedAt` to the KYC item type
- In `renderFieldsGrouped()`: for "Payment Verification" category, if `item.stripePaymentIntentId` exists, render Stripe badge (auto-approved, no approve/reject buttons needed); otherwise render legacy fields
- Update `KYC_FIELDS` processing: exclude payment fields from auto-decision loop when Stripe-verified (they are already auto-approved)

**8. Backend `create-kyc.dto.ts`**
- Change `paymentReference` from `@IsNotEmpty()` to `@IsOptional() @IsString()`
- Add `@IsOptional() @IsString() stripePaymentIntentId?: string`

---

## Open Questions

1. **Admin notification channel for "fee paid"**
   - What we know: `notificationsService.create()` is used in admin.service.ts for KYC review results; `dealers.service.ts` currently only sends email for KYC submission
   - What's unclear: Should the "fee paid" notification also send an email, or just in-app?
   - Recommendation: In-app notification only (consistent with CONTEXT.md: "push/in-app notification"). Email is covered by the subsequent "KYC submitted" email already in place.

2. **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable**
   - What we know: `STRIPE_SECRET_KEY` is used in backend. The checkout page uses the Stripe Checkout redirect (no publishable key needed in frontend). No `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var is currently used in the Next.js frontend.
   - What's unclear: Is the publishable key set in `.env.local` / production env already?
   - Recommendation: Check `.env.local` for `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` before wiring `loadStripe()`. If not present, add it. The backend `payments.service.ts` already returns it from `createPaymentSheet()` — but for the web form, the frontend needs it directly as an env var for `loadStripe()`.

3. **Auto-approve the payment section in `documentStatuses`**
   - What we know: The `submitKyc()` service sets all fields to `PENDING` in `documentStatuses`. After PI verification, payment section should be `APPROVED`.
   - Recommendation: After verifying `pi.status === 'succeeded'`, in `submitKyc()`, set `documentStatuses['paymentReference'] = { status: 'APPROVED', note: '' }` and `documentStatuses['paymentScreenshot'] = { status: 'APPROVED', note: '' }` so that the legacy field keys are marked approved. This prevents admin from seeing them as pending. The Stripe badge rendering will also suppress their display in the new flow.

---

## Validation Architecture

`workflow.nyquist_validation` is not explicitly set to `false` in config.json, so this section is included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (backend NestJS unit tests — established pattern from Phase 12) |
| Config file | `backend/src/dealers/dealers.service.spec.ts` (to be created — Wave 0 gap) |
| Quick run command | `cd backend && npx jest dealers.service --testPathPattern dealers` |
| Full suite command | `cd backend && npx jest` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| KYC-PAY-01 | `createKycPaymentIntent()` returns `alreadyPaid: true` when `stripeChargedAt` is set | unit | `cd backend && npx jest dealers.service -t "already paid"` | Wave 0 |
| KYC-PAY-02 | `createKycPaymentIntent()` returns existing PI client_secret when PI status is `requires_payment_method` | unit | `cd backend && npx jest dealers.service -t "existing PI"` | Wave 0 |
| KYC-PAY-03 | `submitKyc()` throws BadRequestException when PI status is not `succeeded` | unit | `cd backend && npx jest dealers.service -t "PI not succeeded"` | Wave 0 |
| KYC-PAY-04 | `submitKyc()` saves `stripePaymentIntentId` + `stripeChargedAt` on confirmed charge | unit | `cd backend && npx jest dealers.service -t "saves stripe fields"` | Wave 0 |
| KYC-PAY-05 | `submitKyc()` auto-approves payment fields in `documentStatuses` when Stripe-verified | unit | `cd backend && npx jest dealers.service -t "auto approve"` | Wave 0 |
| KYC-PAY-06 | Frontend card decline shows inline error, blocks form submission | manual | n/a — Stripe test cards (4000000000000002) | manual |
| KYC-PAY-07 | Already-paid dealer sees green tick, no card form on step 3 | manual | n/a — visual UI state | manual |

### Sampling Rate

- **Per task commit:** `cd backend && npx jest dealers.service --testPathPattern dealers`
- **Per wave merge:** `cd backend && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/dealers/dealers.service.spec.ts` — covers KYC-PAY-01 through KYC-PAY-05 (mock PrismaService + mock Stripe SDK)
- [ ] Mock pattern: follow `bids.service.spec.ts` established in Phase 12 (mock `PrismaService`, `EmailService`, `NotificationsService` via `jest.mock`)

---

## Sources

### Primary (HIGH confidence)

- Codebase: `backend/src/payments/payments.service.ts` — PaymentIntent creation pattern (`createPaymentSheet`) used as template for KYC PI
- Codebase: `src/components/dashboard/KycOverlayForm.tsx` — full existing step 3 structure confirmed (lines 778-844)
- Codebase: `backend/prisma/schema.prisma` (lines 391-422) — DealerKyc model; confirmed `paymentReference String` (non-nullable), `paymentScreenshot String?`
- Codebase: `backend/src/dealers/dto/create-kyc.dto.ts` — confirmed `paymentReference @IsNotEmpty()` constraint to change
- Codebase: `backend/src/dealers/dealers.service.ts` — confirmed `fieldsList` and `requiredFields` Set that must be updated
- Codebase: `src/app/dashboard/admin/dealer-verification/page.tsx` — confirmed `KYC_FIELDS` at lines 50-51, `renderFieldsGrouped()` function
- Codebase: `package.json` — confirmed `@stripe/stripe-js ^9.0.1` installed; `@stripe/react-stripe-js` NOT installed
- Stripe backend API version: `2026-02-25.clover` (from payments.service.ts line 29)

### Secondary (MEDIUM confidence)

- Stripe Elements + CardElement pattern: standard industry pattern, well-documented in Stripe docs; confirmed by PaymentSheet pattern in mobile app (`09-mobile-production-parity Plan 02`)
- `@stripe/react-stripe-js` package: confirmed companion package to `@stripe/stripe-js`; provides `Elements`, `CardElement`, `useStripe`, `useElements`

### Tertiary (LOW confidence)

- None — all critical claims verified against codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from package.json + existing payments.service.ts + Stripe SDK installed in backend
- Architecture: HIGH — confirmed from reading all affected files in the codebase
- Pitfalls: HIGH — confirmed by reading existing DTO constraints, schema, and frontend form structure
- Admin panel changes: HIGH — read entire admin page; confirmed KYC_FIELDS structure

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (Stripe Elements API is stable; no near-term breaking changes expected)
