# Phase 14: Stripe KYC Fix - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the manual "Payment Verification" step in the dealer KYC form (which currently asks for a bank payment reference code + screenshot upload) with a Stripe Elements card form that charges a live £1 verification fee. The charge is atomic with form submission; a successful charge auto-approves the payment section for admin review. No other KYC fields or flows change.

</domain>

<decisions>
## Implementation Decisions

### £1 Charge Fate
- **Keep, never refund** — the £1 is platform income; it is never refunded regardless of KYC outcome (approved or rejected)
- **Charged once per dealer lifetime** — if a dealer's KYC is rejected and they resubmit, they are NOT charged again; the system records the prior charge and skips the payment step
- **Framed as "Verification Fee"** — copy on the form says "£1.00 verification fee (non-refundable)" before card entry; no ambiguity about refundability

### Submit Button Behaviour
- **Single atomic action** — clicking "Submit" triggers the Stripe charge AND form submission simultaneously; there is no separate "Pay" button before submission
- **Payment failure blocks everything** — if the £1 charge fails, the entire submission is blocked; no partial save of form data; dealer corrects card and resubmits all fields

### Stripe Card Form Placement
- **Replaces the "Payment Verification" section** in the existing multi-section KYC form (which currently holds `paymentReference` + `paymentScreenshot` fields); same visual position in the form layout
- **Inline Stripe CardElement** — always visible in the payment section from the moment the form loads; not collapsed, not behind a button
- **Amount shown above inputs** — "£1.00 verification fee" displayed above the Stripe CardElement so dealer knows what's being charged before entering card details
- **On resubmission (already paid)** — payment section replaced with a green tick + "Verification fee paid — £1 charged on [date]"; card form not rendered; dealer cannot be charged again

### Failed Payment Handling
- **Inline Stripe error messages** — card decline errors surface inline within the payment section (Stripe's built-in error text); no modal, no redirect
- **Unlimited retries per session** — no rate limit on payment attempts; dealer can fix card details and try again as many times as needed
- **Entire submission blocked** — payment failure = nothing saved; dealer must correct card and re-click Submit

### Backend: PaymentIntent Lifecycle
- **PaymentIntent created on form load** — when the dealer navigates to the KYC form (or the payment section becomes visible), backend creates a PaymentIntent and returns `client_secret` to the frontend; Stripe Elements uses this to process the charge on Submit
- **Store Stripe metadata on KYC record** — two new fields added to `DealerKycData` schema: `stripePaymentIntentId String?` and `stripeChargedAt DateTime?`; populated after a confirmed successful charge
- **Legacy submissions untouched** — existing KYC records with `paymentReference` text keep their data as-is; no migration; admin sees the old text for old submissions and Stripe data for new submissions

### Admin Review Flow
- **Auto-approved payment section** — a successful £1 charge means the payment section is automatically marked approved; admin does NOT need to manually verify payment (that was the whole point of replacing the manual flow)
- **Admin sees: PaymentIntent ID + charge date** — in the KYC review panel, the "Payment Verification" section shows a green "Payment Verified" badge + `pi_xxx` ID + charge date; admin can use the PI ID to look up the charge in Stripe dashboard if needed
- **Two admin notifications** — admin receives: (1) push/in-app notification when the £1 is successfully charged ("Dealer X has paid the verification fee"), and (2) the existing KYC submission notification when the full form is submitted

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/dealerApi.ts` — `getDealerKyc()` and `submitDealerKyc()` already exist; need new `createKycPaymentIntent()` function (returns `clientSecret`) and update `submitDealerKyc()` to accept `stripePaymentIntentId`
- `src/app/checkout/page.tsx` — existing Stripe integration on the platform; confirms `@stripe/react-stripe-js` and `@stripe/stripe-js` packages are already installed
- `src/app/dashboard/admin/dealer-verification/page.tsx` — admin KYC review panel; `FIELDS` array at line 50-51 includes `paymentReference` and `paymentScreenshot` — these need to be replaced/handled for new vs legacy submissions
- `DealerKycData` interface (`src/lib/dealerApi.ts:3-30`) — `paymentReference: string` and `paymentScreenshot?: string` are the fields being replaced with `stripePaymentIntentId?: string` and `stripeChargedAt?: string`

### Established Patterns
- Stripe CardElement pattern: `loadStripe()` → `Elements` provider → `CardElement` component — already used on checkout page; same approach applies here
- KYC form multi-section layout: categories array drives the form tabs (Corporate Details / Commercial & Contact / Addresses / Payment Verification) — "Payment Verification" section is the target for the Stripe swap
- Backend push notifications: already used in offers and auction flows; admin notification for KYC events follows same pattern
- `stripeConnectOnboardingComplete` already on seller/dealer profiles — confirms Stripe is the established payment infrastructure

### Integration Points
- Backend: new `POST /dealers/kyc/payment-intent` endpoint → creates Stripe PaymentIntent for £1, returns `client_secret`; must be idempotent (return existing PI if dealer already has one that hasn't been confirmed)
- Backend: `POST /dealers/kyc` (existing submit endpoint) → needs to receive `stripePaymentIntentId`, verify the PaymentIntent status via Stripe API (`payment_intents.retrieve`), then save `stripePaymentIntentId` + `stripeChargedAt` on the record
- DB migration: add `stripePaymentIntentId String?` and `stripeChargedAt DateTime?` to `DealerKyc` model in Prisma schema; `paymentReference` and `paymentScreenshot` columns kept (no drop — legacy data)
- Admin panel: conditional rendering — if `stripePaymentIntentId` is set, show the Stripe badge; if `paymentReference` is set (legacy), show the old reference text; both can coexist on different records

</code_context>

<specifics>
## Specific Ideas

- Payment section copy: "Verify your identity with a £1 card charge. This fee is non-refundable and covers the cost of your KYC review."
- Already-paid state: green checkmark icon + "Verification fee paid · £1 charged on 21 Jun 2026" in muted text
- Admin badge: emerald `ShieldCheck` icon + "Stripe Verified · pi_3xxx · 21 Jun 2026" — consistent with the existing KYC verified badge style

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase 14 scope

</deferred>

---

*Phase: 14-stripe-kyc-fix*
*Context gathered: 2026-06-21*
