# Carmazium Mobile — Production-Readiness Master Plan

**Date:** 2026-07-11
**Scope:** Synthesizes the four existing mobile audit/plan documents in this directory, cross-checks the mobile app against `FEATURE_AUDIT.md` (web) and the **actual shared backend source** (`C:\ca\carmazium\backend\src\`, available on this machine — the two existing mobile docs were written without backend access and explicitly flagged several items as "unverified" as a result), and produces one ordered roadmap covering UI/UX polish, middleware/backend-integration correctness, and production-readiness gating.

This document does not repeat content already well-covered in the four existing docs — it references them by stage number and inserts new findings at the correct point in sequence. Read this document first; it tells you when to read the others.

> **STATUS UPDATE — 2026-07-12.** Between this plan being written (2026-07-11) and the next work session, nearly the entire Section 2 roadmap below (Stages 1–11, i.e. all of `mobile-audit-plan.md` and `mobile-ui-ux-plan.md`) was executed — verified by direct code inspection, not assumption. See the status banners added to `mobile-audit-plan.md` and `mobile-ui-ux-plan.md` for the per-stage breakdown. In short: **only these remain open** as of 2026-07-12:
> - Damage zone-id web-parity verification (`mobile-audit-plan.md` Stage 3, part 1 — the defensive guard is done, the id-matching against web isn't).
> - `SellerAuctionsScreen.tsx`'s schedule-auction modal, still hand-rolled (`mobile-ui-ux-plan.md` Stage 3 straggler).
> - **F2 — DONE as of 2026-07-12.** `PaymentsService.createPaymentSheet` now re-derives `amount` server-side per `type` (`FULL_PAYMENT` → `listing.price`, `LISTING_FEE` → `LISTING_FEES[badgeTier]`, `COMMISSION` → `AUCTION_BUYER_FEE`, `DEPOSIT` → a new `DEPOSIT_AMOUNT = 500` constant matching the web checkout page's own constant) and only logs a mismatch warning if the client's `amount` disagrees — it's never used for the actual charge. Covered by 5 new unit tests. **Newly discovered while fixing this:** `PaymentsService.createCheckoutSession` (the sibling method behind the web's generic `/payments/checkout` Stripe Checkout Session endpoint) has the **identical** unfixed vulnerability — it also trusts a raw client-supplied `amount` for `DEPOSIT`/`FULL_PAYMENT`/`COMMISSION` with zero server-side re-derivation. Out of scope for this fix (F2 was scoped to the mobile-only Payment Sheet endpoint) but it's the same class of bug on the web-facing flow — worth its own follow-up.
> - **F3 — DONE as of 2026-07-12.** `DealerKYCScreen.tsx` now calls `POST /dealers/kyc/checkout` after form submission and opens the returned Stripe Checkout URL in `StripeCheckoutModal`; the `isPending` gate now requires `stripeChargedAt`; the retired manual-bank-transfer fields/copy (`paymentReference`, `paymentScreenshot`) were removed to match the web app's `KycOverlayForm.tsx`, which has already fully retired them. See `CONTEXT.md`'s "Known issues" for the full writeup. **Not yet on-device verified** — do a real £1 payment test before considering this production-ready.
>
> **Stage 0 (F1, F2, F5) status: F1 and F5 are DONE, F2 deliberately deferred.** See the Stage 0 section below for exactly what shipped (`backend/src/payments/dto/create-payment-intent.dto.ts`, `payments.controller.ts`, `payments.service.ts` + a new `payments.service.spec.ts`, plus 3 mobile call sites and the `CLAUDE.md`/`CONTEXT.md` path fix). F2 (re-deriving `amount` server-side instead of trusting the client, for all four payment types) remains open — do it as its own follow-up per the user's explicit choice to scope it out of the F1 fix.

---

## 0. Document inventory — what already exists

| Doc | Covers | Output |
|---|---|---|
| `mobile-audit.md` (2026-07-10) | Performance & data-correctness audit (stale socket auth, unvirtualized lists, hardcoded fake HPI/rating data, damage-zone taxonomy risk) | 10 findings (P1–P7, W1–W10) |
| `mobile-audit-plan.md` (2026-07-10) | Staged execution plan for the above | 5 stages |
| `mobile-ui-ux-audit.md` (2026-07-10) | Pure UI/UX audit (design tokens, modal fragmentation, accessibility, trust chrome, dealer density) | 14 cross-cutting issues (C1–C14) + screen-by-screen findings |
| `mobile-ui-ux-plan.md` (2026-07-10) | Staged execution plan for the above, coordinated against `mobile-audit-plan.md` | 6 stages |

All four are still accurate and don't need re-auditing. What they're missing — because they were written without backend source access — is **feature-parity verification against the actual `/payments`, `/dealers`, `/listings` controllers**, and a cross-check against the web app's feature set in `FEATURE_AUDIT.md`. That's this document's contribution.

---

## 1. NEW — Backend/middleware cross-check findings

These were found by reading `backend/src/payments/`, `backend/src/dealers/`, and comparing mobile's API call sites against them directly — not by re-reading the mobile code in isolation.

### F1 — CONFIRMED CRITICAL: mobile's classified-listing payment call is rejected by the backend on every request

**Files:** `src/screens/sell/SellCarFlowScreen.tsx:813-816`, `src/lib/paymentsApi.ts`, `backend/src/payments/dto/create-payment-intent.dto.ts:44-48`, `backend/src/payments/payments.controller.ts:49-61`, `backend/src/main.ts:120-127`

`mobile-audit-plan.md` Stage 5 and `CONTEXT.md`'s "Known issues" section both flag this as **"could not verify — no backend access from this machine"**. It can now be verified, and it's worse than suspected — it isn't a trust question, it's a hard-broken call:

- Mobile's `triggerListingFeePayment()` calls `createPaymentSheet({ listingId, amount, type: 'LISTING_FEE', currency: 'gbp' })` → `POST /payments/intent`.
- The backend's `CreatePaymentSheetDto.type` is validated with `@IsOptional() @IsString() @IsIn(['DEPOSIT', 'FULL_PAYMENT', 'COMMISSION'])` — **`'LISTING_FEE'` is not a member of that list.**
- `main.ts:120-127` registers a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. `@IsIn` runs regardless of whitelist settings (whitelist/forbidNonWhitelisted governs unknown *properties*, not invalid *values* of a declared property) — an out-of-enum value fails validation and the request 400s before it reaches `PaymentsService.createPaymentSheet`.

**Consequence:** every attempt to publish a BASIC/STANDARD/PREMIUM classified listing from the mobile app hits `catch (payErr)` → `Alert.alert('Payment Failed', payErr.message)` (`SellCarFlowScreen.tsx:996-998`). This is not a rare edge case — it is the **only** path a seller has to pay a listing fee on mobile, and it fails 100% of the time against the current backend. Given classified listings can't publish without a completed `LISTING_FEE` transaction (`FEATURE_AUDIT.md` §Listings: "Publish (Payment Gate)"), **mobile sellers currently cannot publish a paid-tier classified listing at all.** (The `FREE`/`AUCTION` badge tier bypasses this and is unaffected — auction listings publish fine, which is likely why this hasn't been noticed: it only breaks the classified/paid path.)

**Fix — pick one, coordinate with backend owner (this is a `backend/` change, not mobile-only):**
- (a) Add `'LISTING_FEE'` and `'BOOST'`/`'HPI_REPORT'` (mobile's `PaymentSheetType` already declares these — check if boost/HPI purchases from mobile share the same gap) to `CreatePaymentSheetDto`'s `@IsIn(...)` list in `backend/src/payments/dto/create-payment-intent.dto.ts:47`, and handle `type === 'LISTING_FEE'` in `PaymentsService.createPaymentSheet`'s Stripe metadata / webhook the same way `createListingSession` (the web Checkout Session equivalent) does at `payments.service.ts:449-462` (set `badgeTier`, `isFeatured`, `featuredUntil` on webhook completion) — currently `createPaymentSheet`'s webhook branch only special-cases `FULL_PAYMENT`/`COMMISSION` (`payments.service.ts:423, 472`), not `LISTING_FEE`, so even fixing the DTO alone isn't sufficient — the webhook needs a matching branch or the listing will never flip to `ACTIVE`.
- (b) Or point mobile at the existing web-equivalent flow instead of Payment Sheet for this one transaction type — `POST /payments/listing-checkout` already re-derives the amount server-side from `badgeTier` (see F2) and is fully implemented; mobile would need `expo-web-browser`'s `openAuthSessionAsync` (already used elsewhere in the app per `CONTEXT.md` item 4) instead of the native Payment Sheet for this specific step.

Either way: **this must be fixed and verified with a real on-device payment before this app goes to production** — it's not a nice-to-have, sellers cannot complete their core monetized action today.

**Test to confirm before starting the fix:** run the existing app against the live backend, start Sell flow, pick BASIC/STANDARD/PREMIUM, reach the payment step, and confirm the 400. This is a 2-minute check that turns "confirmed by code reading" into "confirmed live" before you spend a session on it.

### F2 — Security/integrity gap: `/payments/intent` trusts the client-supplied `amount` for every transaction type, not just listing fee

**Files:** `backend/src/payments/payments.service.ts:245-330`, `backend/src/payments/dto/create-payment-intent.dto.ts:38-42`

`mobile-audit-plan.md` W8 flagged this narrowly for `LISTING_FEE` and marked it "could not verify." Reading the actual service method resolves it, and broadens it: `createPaymentSheet(listingId, userId, amount, type, currency)` takes `amount` as a raw parameter and passes it straight to `stripe.paymentIntents.create({ amount: Math.round(amount * 100), ... })` (`:304-305`) with **no cross-check against `listing.price`, `auction.buyItNowPrice`/`winningBidAmount`, or the £125 auction buyer fee constant** — it only checks the listing exists (`:252-257`). This applies to all three currently-valid types (`DEPOSIT`, `FULL_PAYMENT`, `COMMISSION`), not just the broken `LISTING_FEE` case in F1.

By contrast, the web's Stripe Checkout Session equivalent (`createListingSession`, `:190-236`) derives `amount` server-side from `badgeTier` via `this.LISTING_FEES[badgeTier]` — the client never gets to name its own price for that flow. `createPaymentSheet` (the mobile-only Payment Sheet path) has no equivalent guard for any of its three transaction types.

**Real-world impact:** a buyer with a modified/rooted client could request a Payment Sheet for `FULL_PAYMENT` on a £30,000 listing with `amount: 1`, pay £1, and — depending on what the webhook/completion handler does with a successful `PaymentIntent` for `FULL_PAYMENT` — potentially trigger whatever "paid in full" side effects exist (mark `PurchaseStatus`, notify seller, etc.) for a fraction of the real price. This needs a `backend/` fix (re-derive `amount` server-side from the listing/auction record based on `type`, ignore/validate the client's number) before mobile payments should be trusted in production. Flag to whoever owns `backend/` — this is outside mobile's ability to fix unilaterally since the DTO/service both need to change.

**Recommended fix:** in `createPaymentSheet`, branch on `type` and compute `amount` server-side: `FULL_PAYMENT` → `listing.price`; `DEPOSIT` → the fixed £500 deposit constant (check what the web's deposit flow uses — likely already a constant in `payments.service.ts`); `COMMISSION` → `AUCTION_BUYER_FEE` (£125, referenced elsewhere in the same file). Stop accepting `amount` from the client entirely for this endpoint, the same way `createListingSession` doesn't.

### F3 — Feature-parity gap: dealer KYC application fee is not implemented on mobile

**Files:** `src/screens/main/DealerKYCScreen.tsx:270-313`, `backend/src/dealers/dealers.service.ts:96-152`, `backend/src/dealers/dealers.controller.ts:180-196`

`FEATURE_AUDIT.md` documents a **new-since-last-revision** requirement: dealer KYC now requires a paid application fee via `POST /dealers/kyc/checkout` → Stripe → `stripeChargedAt` set on the `DealerKyc` record by webhook (`payments.service.ts:591-597`), tracked separately from form submission itself (Flow 3, Section 2 Dealers Module).

Mobile's `DealerKYCScreen.tsx` `handleSubmit()` (`:271-313`) posts the 16-field form directly to `POST /dealers/kyc` and never calls the checkout endpoint. This isn't hard-blocked server-side — `dealers.service.ts:96` (`submitKyc`) persists the form regardless of payment state (confirmed by reading the method: it only checks `alreadyStripeVerified` for informational purposes, `:132`, and doesn't reject the submission if false) — so the mobile flow doesn't error out. But `stripeChargedAt` will never get set for a dealer who only used the mobile app, which (per the web flow's existence) is presumably a precondition for admin approval to actually complete. **A dealer who signs up and submits KYC purely through mobile may never get approved**, with no error message telling them why.

Also worth noting: the KYC form (both web and mobile) still carries legacy `paymentReference`/`paymentScreenshot` fields (`dealers.service.ts:149-150`) alongside the newer Stripe flow — suggesting a manual bank-transfer fallback predates the Stripe checkout. Confirm with whoever owns the KYC/payments backend whether that fallback is still honored, since it may mean mobile isn't broken so much as using the old path exclusively.

**Fix:** add a `POST /dealers/kyc/checkout` call (Stripe Checkout Session, so use `expo-web-browser`'s `openAuthSessionAsync` per the app's established in-app-browser pattern — see `CONTEXT.md` item 4) either before or immediately after the mobile KYC form submission, matching wherever the web app places it in its flow. Confirm the fee amount server-side (`payments.service.ts` — search for the KYC fee constant near `createKycCheckoutSession`).

### F4 — Positive finding, do not regress: mobile already gates auction bidding correctly, unlike web

**Files:** `src/screens/vehicle/AuctionDetailScreen.tsx:428-437, 1420-1426`

`FEATURE_AUDIT.md` Issue 1 (unresolved, frozen on the web side per `WEB_BACKEND_FIX_PLAN.md`) says the web's live-auction page "renders a bid form to any logged-in user with no role gating," producing a confusing 403 for non-dealers. Mobile does not have this bug — `AuctionDetailScreen.tsx` checks `role === 'DEALER'` and `currentUser?.isVerified` client-side before showing the bid UI, with copy explaining why bidding is unavailable (`"Only verified dealers can bid in auctions."` / `"Verify your dealership to place bids."`). No action needed — just noting this so a future contributor doesn't "fix" mobile to match web's behavior, and so whoever eventually resolves Issue 1 on the web side knows mobile's client-side gate can be a reference implementation.

### F5 — Doc hygiene: `CLAUDE.md` and `CONTEXT.md` point at the wrong web-app path for this machine

**Files:** `CLAUDE.md` ("Web app is the source of truth" section), `CONTEXT.md:7`

Both say the web app lives at `D:\carmazium\src\`, sibling to `carmazium app/`. On this machine (the one this plan was written on), the actual repo root is `C:\ca\carmazium\`, and the web frontend is at `C:\ca\carmazium\src\` (confirmed: `backend/`, `src/`, and `carmazium app/` are all siblings directly under `C:\ca\carmazium\`). This is almost certainly a leftover from whatever machine `CONTEXT.md` was originally written on (it explicitly says "as of 2026-07-06," and separately documents a "build machine" vs. "dev machine" split with different drive letters). The stale path is why `mobile-audit-plan.md` Stage 1 and `CONTEXT.md`'s own "Known issues" note both say "couldn't verify — web repo isn't present on this machine" for questions this document just answered by reading `C:\ca\carmazium\backend\src\` directly.

**Fix:** one-line edit to both files, replace `D:\carmazium\src\` → `C:\ca\carmazium\src\` (or better, `..\..\src` / a relative reference, so it survives future machine changes). Do this now — it's a 2-minute fix that stops every future audit session from re-hitting the same dead end.

**Status: DONE** (2026-07-12).

---

### F6 — `PaymentsService.createCheckoutSession` (web's `/payments/checkout`) has the same client-trusted-amount gap as F2, unfixed

**Files:** `backend/src/payments/payments.service.ts` (`createCheckoutSession`, ~line 47)

Discovered while fixing F2 in the sibling `createPaymentSheet` method. `createCheckoutSession` — the method behind the web app's generic `/payments/checkout` Stripe Checkout Session endpoint, used for `DEPOSIT`/`FULL_PAYMENT`/`COMMISSION` — takes `amount` as a raw parameter and uses it directly for the Stripe Checkout Session's `unit_amount` with **no re-derivation from `listing.price`, the fixed deposit amount, or the auction buyer fee**, exactly the bug F2 fixed in `createPaymentSheet`. The web's own `checkout/page.tsx` computes `DEPOSIT_AMOUNT = 500` and `fullPrice`/`AUCTION_BUYER_FEE` client-side and sends them as `amount` — same trust assumption.

**Fix:** apply the identical pattern from F2's fix (re-derive `amount` server-side per `type`, using the same `LISTING_FEES`/`AUCTION_BUYER_FEE`/`DEPOSIT_AMOUNT` constants already added to the class) to `createCheckoutSession`. This is a clean, well-scoped follow-up — same file, same constants, same shape of fix, just the other one of the two `amount`-accepting methods in this service.

**Status: OPEN** — not yet started.

---

## 2. Master staged roadmap

This merges `mobile-audit-plan.md`'s 5 stages, `mobile-ui-ux-plan.md`'s 6 stages, and F1–F5 above into one sequence. Rationale for placement follows each stage. As before: one focused session per stage, paste the referenced prompt verbatim (for stages from the existing docs) or the new prompt below (for Stage 0).

### Stage 0 — NEW, do this first: fix the mobile payment middleware bugs (F1, F2) + doc path fix (F5)

**Why absolute first:** F1 is a confirmed, currently-live bug blocking the core seller monetization flow (classified listing publish) on mobile. Nothing else in either existing plan matters if sellers can't complete the one paid action the app exists to support. F2 is a payment-integrity gap in the same code path — fix both together since they're the same function. F5 is a 2-minute doc fix that unblocks every subsequent stage's ability to diff against the web repo, do it in the same sitting.

**Prompt to paste (note: this stage touches `backend/`, not just mobile — get backend sign-off before merging, it's shared infrastructure):**

> Read `carmazium app/carmazium app/mobile-production-readiness-plan.md` findings F1, F2, F5 for full context. Three fixes:
>
> 1. **Fix the doc paths (F5).** In `carmazium app/carmazium app/CLAUDE.md` and `CONTEXT.md`, replace every `D:\carmazium\src\` reference with the correct path for the current machine's repo layout (web frontend is a sibling of `backend/` and `carmazium app/` at the repo root — confirm the exact path before editing, it may differ machine-to-machine, so prefer a relative reference like `../../src` over a hardcoded drive letter if these docs are meant to be machine-portable).
>
> 2. **Fix `/payments/intent` rejecting `type: 'LISTING_FEE'` (F1).** In `backend/src/payments/dto/create-payment-intent.dto.ts`, add `'LISTING_FEE'` to `CreatePaymentSheetDto`'s `@IsIn([...])` list (confirm with mobile's `PaymentSheetType` in `src/lib/paymentsApi.ts` whether `'BOOST'`/`'HPI_REPORT'` also need adding — check if those purchases go through this endpoint on mobile too, or only through `/payments/hpi-checkout`/`/featured-boost/:id` respectively, in which case leave them out). Then, in `backend/src/payments/payments.service.ts`'s webhook handler, add a `type === 'LISTING_FEE'` branch that mirrors what `createListingSession`'s webhook branch does at `:449-462` (read `badgeTier` from the PaymentIntent's metadata — you'll need to add it to the metadata object in `createPaymentSheet`, `:309-314`, since it's currently missing there — set the listing to `ACTIVE`, `badgeTier`, `isFeatured`/`featuredUntil` for PREMIUM). Do not change `createListingSession` or the web checkout flow.
>
> 3. **Re-derive `amount` server-side instead of trusting the client (F2).** In `PaymentsService.createPaymentSheet`, stop accepting `amount` as a trusted input for `type` values where a real backend value exists: for `FULL_PAYMENT`, use `listing.price`; for `LISTING_FEE`, use `this.LISTING_FEES[badgeTier]` (same constant `createListingSession` uses — you'll need the listing's `badgeTier` or the tier requested in the DTO, whichever the mobile call site can supply); for `COMMISSION`, use the existing auction-buyer-fee constant (grep the file for how `apply-auction-fee` computes it). Keep `DEPOSIT` as-is only if you confirm there's a fixed deposit amount elsewhere in the codebase (check `checkout.controller`/`.service` on the web side for what `/checkout?mode=deposit` sends) — if deposit amount is genuinely listing-dependent (e.g. a percentage), derive it the same way. The DTO's `amount` field can stay for backward compatibility but should be ignored/logged-as-mismatch server-side rather than trusted, OR removed from the DTO entirely if no caller needs to specify it. Do not change the Stripe Checkout Session flows (`/payments/checkout`, `/payments/listing-checkout`, `/payments/hpi-checkout`) — they already do this correctly; this fix is scoped to `createPaymentSheet` only.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean on mobile; backend's existing test suite (`payments.service.spec.ts` if it exists, else write a minimal one) passes.
> - On-device test: publish a BASIC listing from mobile, complete the £1 Payment Sheet payment, confirm the listing reaches `ACTIVE` status (not just that the Stripe charge succeeds — confirm the webhook actually flips the listing).
> - Repeat for STANDARD and PREMIUM tiers; confirm PREMIUM sets `isFeatured: true`.
> - Attempt (in a staging/test Stripe mode only, never against production) to call `/payments/intent` with `type: 'FULL_PAYMENT'` and a deliberately wrong `amount` — confirm the created PaymentIntent's amount matches the listing's real price, not the client-supplied number.
> - `CLAUDE.md`/`CONTEXT.md` no longer reference a path that doesn't exist on the current machine.

---

### Stage 1 — Wire real vehicle data + resolve the KYC-fee gap (`mobile-audit-plan.md` Stage 1, W1/W2, + F3)

**Why second:** buyers see fabricated "Clear HPI / 1 owner / Mar 2026" on every listing — a trust/legal risk once real money is changing hands (and by Stage 0, it now can). Run `mobile-audit-plan.md`'s Stage 1 prompt verbatim (still accurate — re-read it there, not reproduced here). While in this session, also address F3 (dealer KYC fee) since it's a similarly-shaped "wire mobile to a backend capability that already exists" task and touches an adjacent screen — but keep it a **separate commit/PR** from the vehicle-data work, they're unrelated data domains.

**Additional prompt to paste for F3 (separate from the Stage 1 prompt in `mobile-audit-plan.md`):**

> Read `carmazium app/carmazium app/mobile-production-readiness-plan.md` finding F3. Add the dealer KYC application-fee checkout step to `src/screens/main/DealerKYCScreen.tsx`. Check `backend/src/dealers/dealers.controller.ts`'s `createKycCheckoutSession` endpoint (`POST /dealers/kyc/checkout`) and its return shape, then use `expo-web-browser`'s `openAuthSessionAsync` (the same in-app-browser pattern already used elsewhere per `CONTEXT.md` item 4 — do not use `Linking.openURL`, that caused the black-screen bug documented there) to complete the Stripe Checkout redirect. Confirm with the web app (now correctly located per F5's doc fix) exactly where in its KYC flow the fee checkout happens — before form submission, after, or gating a "Submit" button — and match that sequencing on mobile. Acceptance: a dealer who completes KYC purely via mobile ends up with `stripeChargedAt` set on their `DealerKyc` record (verify via `GET /dealers/kyc` after payment).

---

### Stage 2 — Fix stale-token socket reconnection (`mobile-audit-plan.md` Stage 2 — unchanged, self-contained, do whenever)

---

### Stage 3 — Trust chrome cleanup (`mobile-ui-ux-plan.md` Stage 1 — unchanged, depends on Stage 1 above per its own coordination note)

---

### Stage 4 — Harden the damage taxonomy (`mobile-audit-plan.md` Stage 3 — unchanged)

---

### Stage 5 — Enforce design tokens (`mobile-ui-ux-plan.md` Stage 2 — unchanged, foundation for later UI stages)

---

### Stage 6 — Finish the `BottomSheet` migration (`mobile-ui-ux-plan.md` Stage 3 — unchanged)

---

### Stage 7 — Form UX: inline errors, hardware back, save-and-exit (`mobile-ui-ux-plan.md` Stage 4 — unchanged)

---

### Stage 8 — Virtualization + memoization sweep (`mobile-audit-plan.md` Stage 4 — unchanged, large diff, do after correctness work per its own rationale)

---

### Stage 9 — Accessibility + icon-button consolidation (`mobile-ui-ux-plan.md` Stage 5 — unchanged)

---

### Stage 10 — Cleanup pass (`mobile-audit-plan.md` Stage 5 — unchanged; note item #2 in that stage, "verify server trust of client-supplied listing-fee amount," is now **fully resolved by Stage 0 above** — skip re-investigating it, just confirm Stage 0 shipped)

---

### Stage 11 — Dealer visual-density preset + drop `AlertsScreen` duplicate (`mobile-ui-ux-plan.md` Stage 6 — unchanged, last by design)

---

## 3. Production-readiness checklist (after Stage 11)

Combining both existing docs' "after" sections with new items from this cross-check:

1. **Rotate the secrets flagged in `FEATURE_AUDIT.md` Issue 18**, if not already done — `backend/env.txt` was committed with a live Stripe secret key, Supabase service-role key, DB credentials, OpenAI key, and session secret before removal in commit `7bfd43b8`. This is shared infrastructure the mobile app also depends on (same backend, same Stripe account) — a mobile-specific production launch should not proceed on unrotated keys. Confirm with whoever owns `backend/` deployment.
2. Run the manual test matrix in `CONTEXT.md` on a fresh build (not dev-client) — **and explicitly include a full paid classified-listing publish, now that Stage 0 makes this possible to test meaningfully.**
3. Release-build test on Android (`npx expo prebuild --clean --platform android` then `expo run:android --variant release`).
4. Enable a real crash reporter (Sentry/Bugsnag) — several findings across all docs reference "log to whatever crash-reporter is wired," and there isn't one yet.
5. Re-run `grep -RE '#[0-9a-fA-F]{3,8}' src/screens src/components` (per `mobile-ui-ux-plan.md` Stage 2's acceptance criteria) to confirm the token-enforcement ESLint rule is actually catching regressions, not just that the initial codemod ran once.
6. Confirm the F1/F2 backend fix (Stage 0) has been reviewed and merged by whoever owns `backend/` — this plan's mobile stages assume it's live; testing Stage 1's real-vehicle-data work against a backend that still rejects listing-fee payments will produce confusing, unrelated failures.

---

## 4. What this document deliberately does not cover

- Admin, Finance Partner, Insurance Partner, Contractor dashboards — out of scope, same as `FEATURE_AUDIT.md`'s own scope decision (internal/partner-only surfaces).
- A full re-audit of mobile's API coverage against every backend controller — spot-checked broadly (auctions, bids, offers, delivery requests, dealer staff/leads, Stripe Connect, address verification, watchlist, chat, sellers/reviews) and found **thorough parity** beyond the three gaps in F1/F2/F3. The existing two mobile audits already cover UI/UX and performance/correctness exhaustively; this document's job was specifically to check the mobile ↔ backend contract, which they couldn't do without source access.
- Product decisions flagged as needing design/business input in either existing plan's "not staged" section (dealer bulk actions, onboarding role-picker, filterable analytics date ranges) — unchanged, still deferred.
