# Carmazium Mobile — Production-Readiness Master Plan

**Date:** 2026-07-11
**Scope:** Synthesizes the four existing mobile audit/plan documents in this directory, cross-checks the mobile app against `FEATURE_AUDIT.md` (web) and the **actual shared backend source** (`C:\ca\carmazium\backend\src\`, available on this machine — the two existing mobile docs were written without backend access and explicitly flagged several items as "unverified" as a result), and produces one ordered roadmap covering UI/UX polish, middleware/backend-integration correctness, and production-readiness gating.

This document does not repeat content already well-covered in the four existing docs — it references them by stage number and inserts new findings at the correct point in sequence. Read this document first; it tells you when to read the others.

> **STATUS UPDATE — 2026-07-12 (superseded twice, now current).** Between this plan being written (2026-07-11) and the next work session, nearly the entire Section 2 roadmap below (Stages 1–11, i.e. all of `mobile-audit-plan.md` and `mobile-ui-ux-plan.md`) was executed — verified by direct code inspection, not assumption. See the status banners added to `mobile-audit-plan.md` and `mobile-ui-ux-plan.md` for the per-stage breakdown.
>
> **F1–F6 status, all findings in Section 1 below:**
> - **F1 — DONE.** `/payments/intent` accepts `type: 'LISTING_FEE'`; webhook activates the listing at the right tier.
> - **F2 — DONE.** `createPaymentSheet` re-derives `amount` server-side for all four payment types instead of trusting the client.
> - **F3 — DONE.** `DealerKYCScreen.tsx` now drives the £1 verification-fee Stripe checkout; retired manual-bank-transfer fields removed. **Not yet on-device verified** — do a real £1 payment test before calling this production-ready.
> - **F4 — no action needed** (positive finding — mobile already gates auction bidding correctly).
> - **F5 — DONE.** `CLAUDE.md`/`CONTEXT.md` no longer reference the stale `D:\carmazium\src` path.
> - **F6 — DONE.** `createCheckoutSession` (the web-facing sibling of the F2 fix) now re-derives `amount` server-side too — both `amount`-accepting methods in `PaymentsService` are hardened.
>
> **`SellerAuctionsScreen.tsx`'s schedule-auction modal — DONE as of 2026-07-12.** Migrated the 2-step create-auction wizard (~220 lines) from a hand-rolled `presentationStyle="fullScreen"` `<Modal>` to the shared `<BottomSheet>`. Notes for anyone touching this next: no `title` prop is passed — the modal needs its own two-icon header (conditional back-chevron on step 2, step-dependent title text, close button) plus a step-indicator row, which don't fit `BottomSheet`'s single-row `title` convention, so both are rendered as the first children instead. `maxHeightPercent={95}` approximates the original full-screen feel while keeping the shared rounded-sheet chrome. The screen's own `KeyboardAvoidingView`/`StatusBar`/top-inset-spacer (needed for the old fullscreen presentation) were removed — `avoidKeyboard` on `BottomSheet` now handles the keyboard, and the sheet is a transparent overlay over the still-visible screen behind it, not a separate native fullscreen window. `Modal` and `KeyboardAvoidingView` are now unused imports in this file and were removed. `npx tsc --noEmit` and `eslint` both clean. **Not on-device verified** — the FlatList (step 1) and ScrollView (step 2) rely on Yoga resolving `flex: 1` against the parent's `maxHeight` correctly, which is standard RN behavior but should be confirmed on a real device before shipping, especially that the listing-picker FlatList actually scrolls/virtualizes within the sheet bounds.
>
> **Damage zone-id web-parity verification — DONE as of 2026-07-12.** All 33 ids in `src/components/damage/damageZones.ts` diffed programmatically (extracted both id lists with `grep -oP`, ran `diff`) against the web repo's authoritative `ALL_ZONES` array (`src/components/listing/ThreeDVehicleViewer.tsx`). **14 of 33 were wrong** — corrected:
> `headlight-ns/-os`→`ns-headlight`/`os-headlight`, `front-wing-ns/-os`→`nsf-wing`/`osf-wing`, `windscreen-rear`→`rear-windshield`, `sill-ns/-os`→`ns-sill`/`os-sill`, `rear-qtr-ns/-os`→`nsr-quarter`/`osr-quarter`, `rear-light-ns/-os`→`ns-rear-light`/`os-rear-light`, `drivers-seat`→`driver-seat`, `passengers-seat`→`passenger-seat`, `rear-seats`→`rear-seat`.
> The web's own naming isn't internally consistent (NS/OS is a prefix for some parts, part of a 3-letter side+position code for others), which is why the file's previous author guessed wrong on these 14 despite applying their guessing pattern consistently. Confirmed via repo-wide search that no other file hardcodes any of the 14 old (wrong) id strings, so the fix is fully contained to `damageZones.ts` — `DamageMapViewer.tsx`/`ThreeDVehicleViewer.tsx`(mobile)/`SellCarFlowScreen.tsx` all consume zones generically via `DAMAGE_ZONES_3D`, never by hardcoded id. `tsc`/`eslint` clean. **Real-world data-migration risk is low but not verified**: if any live listing already saved a damage record with one of the 14 wrong ids before this fix, that record's `part` string won't match any current zone and will be silently skipped by `DamageMapViewer.tsx`'s existing defensive guard (not a crash, just a dropped pin) — the file's own history suggests this is unlikely (only 3 of ~90 sampled live listings had any damage records, and none matched these particular ids), but wasn't independently re-checked this session.
>
> **`VehicleDetailScreen.tsx`'s remaining `<Modal>` usage — VERIFIED, no migration needed (2026-07-12).** The original plan's concern ("HPI/thumbnail/offer modals") turned out already resolved: the file has 4 `<BottomSheet>` usages (the offer modal and others) plus `<StripeCheckoutModal>` for the HPI report checkout — all correctly migrated already, presumably by the same prior session that did the bulk of Stages 1–11. Exactly one raw `<Modal>` remains (confirmed via `grep -c`): the fullscreen pinch-to-zoom photo viewer (`fullscreenVisible`, ~line 1550) — a gesture-driven (`GestureDetector`), full-bleed image lightbox with fade animation. This is correctly excluded from the BottomSheet migration, same category as `GlobalAIChatBot`/`ImportListingModal`/`StripeCheckoutModal` — arguably a clearer exclusion than those, since pinch-to-zoom needs the full screen and can't function inside a bottom-anchored, `maxHeightPercent`-bounded sheet at all. Its close button is already an `IconButton` (44pt tap target + `accessibilityLabel="Close"` enforced by that shared component). No code change made — this was a verification task, not a fix.
>
> **Only these remain open** as of 2026-07-12:
> - On-device verification of the F1/F3 payment flows and the `SellerAuctionsScreen` BottomSheet migration (can't be done from this environment — no adb/emulator, and payment flows would mean live Stripe/DB writes).

> **F7–F9 added 2026-07-15**, from user-reported gaps while using the app (not a re-audit of already-covered ground — see each finding for exactly what was checked).
> - **F7 — DONE.** Seller/dealer phone now surfaced on both `SellerProfileScreen.tsx` and `VehicleDetailScreen.tsx` via the gated `/sellers/{id}/phone` endpoint.
> - **F8 — DONE**, scoped to buyer-visibility only. Buyer screens now render the real (read-only) `ThreeDVehicleViewer` instead of the flat `DamageMapViewer`, which was deleted as dead code. The related per-body-type GLB asset gap is unfixed (asset-production task, not code).
> - **F9 — DONE.** Product decided mobile should have the prominent auctions CTA regardless of web's currently-disabled hero button. `HomeScreen.tsx` now has an `auctionCta` card above `sellCta`, shown whenever there's a live auction.
> - None of F7/F8/F9 has been verified on a real device — no adb/emulator in this environment (same limitation as F1/F3).

> **F10–F25 added 2026-07-15**, from a full-surface parity sweep (four parallel passes: buyer, seller, dealer, cross-cutting), each verified by reading both web and mobile source directly rather than assuming from doc silence.
> - **F10 — DONE.** Fuel-type filter now translates UI labels to backend enum values via a `FUEL_MAP` in `SearchScreen.tsx` (mirrors web), and offers all 14 fuel types instead of 5.
> - **F11 — DONE.** `constants/bodyTypes.ts` (the single source of truth for Home/Search/Sell) now uses the 13 real `BodyType` enum values — this also fixes a listing-creation bug this finding didn't originally scope (picking "Saloon"/"Pickup" at Sell time would 400 the same way). A second latent bug (3 icon names not in `BrandIcon.tsx`'s lookup table, silently rendering as a generic help-circle glyph) was found and fixed in the same pass.
> - **F12–F25 — MISSING or cosmetic-but-misleading, not yet fixed.** See each finding below. Highlights: dealer CRM is a flat list, not web's Kanban board (F16); Notification Settings has 15 controls the backend never reads (F23); the buyer-facing delivery fee estimate uses a formula that doesn't match what the backend actually charges (F24).
> - Neither F10 nor F11 has been on-device verified yet (no adb/emulator in this environment).

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

**Status: DONE** (2026-07-12). `createCheckoutSession` now re-derives `amount` server-side identically to `createPaymentSheet` (F2): `FULL_PAYMENT` → `listing.price`, `COMMISSION` → `AUCTION_BUYER_FEE`, `DEPOSIT` → `DEPOSIT_AMOUNT`. (No `LISTING_FEE` case needed here — that type never reaches this method; `CreateCheckoutSessionDto` only allows `DEPOSIT`/`FULL_PAYMENT`/`COMMISSION`, and the web's listing-fee flow goes through the separate `createListingSession`, which already derived its amount server-side from `badgeTier` before this fix.) Covered by 3 new unit tests (12 total in `payments.service.spec.ts`, all passing). Both `amount`-accepting methods in `PaymentsService` now trust nothing from the client — this closes out the payments-integrity gap across the whole service.

---

### F7 — CONFIRMED: mobile never surfaces the seller/dealer's phone number anywhere a buyer can see it

**Files:** `src/screens/seller/SellerProfileScreen.tsx` (full file read), `src/screens/vehicle/VehicleDetailScreen.tsx` (grepped for `phone`/`contact`/`Call` — zero matches)

User-reported: "the profile does not have the number being shown." Confirmed against the web source of truth:

- Web's public seller profile (`src/app/seller/[id]/page.tsx:13,290`) renders `<SellerContactPhone sellerId={user.id} />`, a client island that calls `GET /sellers/{id}/phone` (`src/components/seller/SellerContactPhone.tsx`) and shows a real `tel:` link via `BlurredPhone` only for logged-in viewers, or a blurred "Log in to view" placeholder otherwise. Mobile's `SellerProfileScreen.tsx` — the direct equivalent screen (fetches `/sellers/{id}`, `/sellers/{id}/listings`, `/sellers/{id}/reviews`) — has no phone UI at all and never calls `/sellers/{id}/phone`. Read the full file to confirm: hero card, stats grid, listings, reviews — no contact affordance of any kind.
- Separately, web's listing detail page (`src/app/vehicle/[id]/page.tsx:800-805,1372-1374`) also renders a direct `tel:` link for `listing.seller.dealerProfile.phone` when the seller is a dealer with a listing-level phone. Mobile's `VehicleDetailScreen.tsx` has no equivalent — grepped for `phone`/`contact`/`Call` across the whole file, zero matches tied to seller contact.

Net effect: a buyer on mobile has **no path at all** to see a seller's or dealer's phone number, gated or otherwise — not on the profile screen, not on the listing detail screen. On web there are two independent paths (gated seller-profile number, direct dealer-listing number) and mobile implements neither.

**Fix:** add a phone section to `SellerProfileScreen.tsx`'s hero card that calls `GET /sellers/{id}/phone` and renders the real number (if `phoneAvailable`) or a "Log in to view" prompt (if not), mirroring `SellerContactPhone`/`BlurredPhone`'s gating logic — use `Linking.openURL(\`tel:${phone}\`)` for the tap action. Separately, on `VehicleDetailScreen.tsx`, render `listing.seller?.dealerProfile?.phone` as a tappable `tel:` row when present, matching the web listing-detail behavior.

**Status: DONE** (2026-07-15). Both screens now call `GET /sellers/{id}/phone` (the same gated endpoint `SellerContactPhone` uses on web) and render a real `tel:` row when `phoneAvailable && phone`. Simplification from the original fix note: rather than reading `listing.seller.dealerProfile.phone` off the nav-param `CarListing` (which the mapper strips down to `seller: {id}` and which mobile never re-fetches fresh anyway — `VehicleDetailScreen` receives its `listing` via `route.params`, not a live `GET /listings/:id` call), `VehicleDetailScreen.tsx` calls the same `/sellers/{id}/phone` endpoint as the profile screen, keyed on `listing.seller.id`. One consequence worth flagging: `RootNavigator.tsx` only mounts the `Main` stack (which contains both these screens) once `isAuthenticated && hasCompletedOnboarding` — unlike web, mobile has no anonymous-browsing mode at all. So the backend's `viewerId`-gated "blurred / log in to view" branch is effectively unreachable on mobile today; every viewer who can see this screen is already authenticated, and will just see the real number whenever `phoneAvailable` is true. Implemented the null-phone case defensively anyway (renders nothing rather than a broken `tel:` link) in case a seller has no phone on file. **Not yet on-device verified** — same environment limitation as F1/F3 (no adb/emulator on this machine).

---

### F8 — CONFIRMED: the interactive 3D damage viewer is never shown to buyers — mobile silently downgrades to a flat 2D silhouette on every buyer-facing screen

**Files:** `src/components/DamageMapViewer.tsx`, `src/screens/vehicle/VehicleDetailScreen.tsx:924-925`, `src/screens/vehicle/AuctionDetailScreen.tsx:146-153`, `src/components/damage/ThreeDVehicleViewer.tsx` (only importer: `src/screens/sell/SellCarFlowScreen.tsx`)

User-reported: "the 3D model only renders in the listing and does not appear on the buyer facing side." Confirmed:

- Web renders the real interactive `ThreeDVehicleViewer` (WebView+Three.js, clickable zones) to buyers in two places: `src/app/buy-cars/[slug]/page.tsx:1027` (listing detail) and (per `mobile-audit.md` P5's own framing) `src/app/auctions/live/[id]/page.tsx` (live auction room).
- Mobile's `ThreeDVehicleViewer.tsx` component exists and works (confirmed fixed in `mobile-audit.md` P5) but its **only** call site anywhere in the app is `SellCarFlowScreen.tsx` — the seller-side listing-creation/damage-marking flow. Both buyer-facing screens (`VehicleDetailScreen.tsx:925`, `AuctionDetailScreen.tsx`) use `DamageMapViewer.tsx` instead — a flat `View`-based silhouette with 2D `%`-positioned dots, not the 3D model at all.
- This is not an accident: `AuctionDetailScreen.tsx:146-151` has an explicit comment recording the decision — *"Mobile uses the simpler DamageMapViewer... same data, same trust signal"* — so a prior session deliberately chose not to give buyers the 3D view. It's a real parity gap against web either way; whether it's "acceptable" is a product call, not something this audit can resolve.
- Related and compounding: even where mobile's `ThreeDVehicleViewer` *is* used (the Sell flow), it only has one GLB asset (`vehicle.glb`) and renders it regardless of the vehicle's actual body type, vs. web's three body-shape models (documented in `CLAUDE.md`, "Getting per-body-type models... is an asset task, not a code task" — this is the user's separately-reported "3D model only shows Sedan" item). If F8 is fixed by wiring the real viewer into buyer screens, the single-Sedan-model limitation becomes buyer-visible too, not just seller-visible during listing creation — worth scoping both together rather than fixing F8 first and hitting this immediately after.

**Fix:** decide (product call) whether buyer screens should get the real `ThreeDVehicleViewer` or whether `DamageMapViewer`'s 2D view is an intentional, permanent mobile-specific simplification. If the former: swap `DamageMapViewer` for `ThreeDVehicleViewer` in `VehicleDetailScreen.tsx` and `AuctionDetailScreen.tsx` (read-only mode — no zone-editing UI, just `markedZones`/`selectedZone` display, same props shape already used in `SellCarFlowScreen.tsx`), and resolve the per-body-type GLB asset gap in the same pass since it'll now be buyer-visible.

**Status: DONE** (2026-07-15), scoped to the buyer-visibility gap only — the per-body-type GLB asset limitation noted above is a separate asset-production task, not re-scoped in. Changes:
- `ThreeDVehicleViewer.tsx` gained a `readOnly?: boolean` prop (default `false`, so `SellCarFlowScreen.tsx`'s editing behavior is unchanged). When `true`: tapping a hotspot only calls `onZoneClick` for selection — the Mark/Hide/Photo action pill never opens, so buyers can't invoke the seller-only image picker or hide toggle. Hint copy changes to "tap a marked zone for details".
- New `src/components/damage/BuyerDamageViewer.tsx` wraps `ThreeDVehicleViewer` in `readOnly` mode plus a tappable damage list below it (part name, type, size, thumbnail if `imageUrl` is present) synced to the same selection state — mirrors web's `buy-cars/[slug]` layout (3D model + damage list, `onZoneClick` just toggles `selectedDamageZone`) rather than reintroducing edit affordances. Handles the `part` (id) → `label` lookup via `DAMAGE_ZONES_3D` since `ThreeDVehicleViewer` identifies zones by `label` internally, not `id` (confirmed by reading `SellCarFlowScreen.tsx`'s own id↔label round-trip, `:707,1214`).
- `VehicleDetailScreen.tsx` and `AuctionDetailScreen.tsx` now render `BuyerDamageViewer` instead of `DamageMapViewer`, passing `bodyTypeLabel={listing.category}`.
- `src/components/DamageMapViewer.tsx` deleted — confirmed orphaned (only those two screens imported it) rather than left as dead code.
- `npx tsc --noEmit` clean (pre-existing, unrelated `jest` type errors in `VehicleCard.test.tsx` aside — not touched this session, not introduced by this fix). **Not yet on-device verified**: WebView/GLB rendering inside a `ScrollView`-hosted card (vs. `SellCarFlowScreen`'s presumably full-screen-ish placement) and the hotspot tap-through behavior should both get a real-device pass before shipping.

---

### F9 — Homepage has no CTA for auctions with visual weight comparable to "Sell your car"; web parity itself is ambiguous here

**Files:** `src/screens/main/HomeScreen.tsx:474-494` (quick chips), `:496-513` (LIVE AUCTIONS section), `:639-652` (`sellCta`), `src/app/HomeClient.tsx:234-254` (web hero Action Hub)

User-reported: "on the homepage there is no Direct button for Auction Now like there is for Sell Car." Confirmed the asymmetry on mobile, with a caveat about what web actually does today:

- Mobile's `sellCta` (`HomeScreen.tsx:639-652`) is a full-width card with title, subtitle, and a colored "START" button — the single most visually prominent action on the home screen besides the hero search. The nearest equivalent for auctions is `"Live Auctions"`, one of five small horizontal filter chips (`:474-494`, icon + label, same visual weight as `"Under £15k"` or `"Electric"`), plus a `"See All"` link in the LIVE AUCTIONS section header (`:500`). Neither is comparable in prominence to `sellCta`.
- Caveat: web's own hero "Action Hub" (`HomeClient.tsx:234-254`) currently has its `"Browse Auctions"` pill button **commented out** (`:235-239`) — only `"Retail Listings"` and `"Sell My Car"` render today. So matching *current* web behavior wouldn't add a prominent auctions CTA either; matching web's *evidently intended but disabled* design would. Worth a quick check with whoever owns the web homepage on whether that button was intentionally killed (e.g. auctions not ready for a hard marketing push) or just left commented out — that answer should drive whether mobile adds this card at all, not just how.

**Fix (if greenlit):** add a second homepage CTA card, same visual treatment as `sellCta`, e.g. "N live auctions right now" / "See what's live" with a "VIEW" button navigating to the `Live` tab — conditionally rendered only when `liveAuctions.length > 0` (falls back to the existing quick-chip entry point when there are none, so the card doesn't promise live auctions that aren't there).

**Status: DONE** (2026-07-15). Greenlit by product — mobile should have the prominent auctions CTA regardless of web's currently-disabled hero button. Added `auctionCta` to `HomeScreen.tsx`, directly above the existing `sellCta`: same card shape/border treatment, an icon-wrap + live-dot on the left (`hammer` icon, matching the existing "Live Auctions" quick-chip's iconography), "`N live auctions right now`" / "Bid live before time runs out", and a filled "VIEW" button navigating to `Tabs → Live`. Rendered only when `liveAuctions.length > 0` per the fix note — the quick chip still covers the zero-live case. `npx tsc --noEmit` clean.

---

## 1B. Full-surface parity sweep (2026-07-15) — F10–F25

Four parallel audit passes, each scoped to one surface (buyer, seller, dealer, cross-cutting), each told to read `FEATURE_AUDIT.md` and all prior mobile audit docs first so nothing already tracked gets re-reported, and to confirm every finding by reading actual mobile source rather than inferring from doc silence. Findings below are de-duplicated across passes (body-type filter was independently found by two passes and is written up once, under F11).

### F10 — CRITICAL, CONFIRMED BROKEN: fuel-type filter returns zero results for any selection

**Files:** `src/screens/main/SearchScreen.tsx:60` (`FUELS` array), `:271` (`buildParams()`), `backend/src/listings/dto/listing-filter.dto.ts:81-85`, `backend/src/listings/listings.service.ts:361`

Web translates UI labels to backend enum values before sending (`src/app/search/page.tsx:31-44`, `FUEL_TYPES`/`FUEL_MAP` — `'Petrol' → 'PETROL'`, `'Plugin Hybrid' → 'PLUGIN_HYBRID'`, 14 types total). Mobile's `SearchScreen.tsx` has no such translation layer: `FUELS = ['Petrol','Diesel','Hybrid','Plug-in Hybrid','Electric']` (5 types, not 14) and `buildParams()` sends `fuelTypes: selectedFuels` — the raw display labels — straight through as the query param. The backend's `fuelTypes` DTO field has no enum validation or case normalization, and `listings.service.ts:361` runs `where.fuelType = { in: fuelTypes }` as a raw Prisma filter — exact-match against the stored enum (`'PETROL'`, not `'Petrol'`). Every fuel chip a buyer taps in the Filters modal therefore returns zero listings, and it isn't even a request error to catch — it's a "successful" empty result, so there's no error surface at all, just an empty list that looks like "no cars match." This is reachable by any buyer trying to filter by fuel type, one of the most common search filters on a car marketplace.

**Fix:** add a label→enum mapping (mirror web's `FUEL_MAP`) in `SearchScreen.tsx` or a shared constants file, translate before sending `fuelTypes`, and expand `FUELS` to cover all 14 backend values (Bi Fuel, Diesel Hybrid, Diesel Plug-in Hybrid, Hydrogen, LPG, Natural Gas, Petrol Hybrid, Petrol Plug-in Hybrid, Unlisted, plus the 5 already present).

**Status: DONE** (2026-07-15). Added `FUEL_MAP` to `SearchScreen.tsx` (mirrors web's mapping exactly, verified against `backend/prisma/schema.prisma`'s `FuelType` enum directly rather than trusting web's copy), expanded `FUELS` to all 14 labels, and translate `selectedFuels` through the map at the one place `buildParams()` sends `fuelTypes`. Left `qf?.params.fuelType` (the `QUICK_FILTERS` fallback) untouched — those already use correct enum casing (`'ELECTRIC'`, `'HYBRID'`), confirmed by reading the array. Also confirmed `route.params?.fuelType` (the nav-param seed for `selectedFuels`, fed by e.g. `HomeScreen.tsx`'s quick-chips row sending `fuelType: 'Electric'`) needed no separate fix — it seeds `selectedFuels` with the same label strings the chip UI already used, so the single translation point in `buildParams()` covers every entry path. `npx tsc --noEmit` clean.

---

### F11 — CONFIRMED BROKEN: body-type filter 400s on "Saloon"/"Pickup"; 5 of 13 web body types missing entirely

**Files:** `src/constants/bodyTypes.ts:16,23`, `src/screens/main/SearchScreen.tsx:54,63-72`, `src/screens/main/HomeScreen.tsx:255`, `backend/src/listings/dto/listing-filter.dto.ts:104-107` (`@IsEnum(BodyType)`, no alias/transform)

Same shape of bug as F10, different field. Mobile's shared body-type constant (`bodyTypes.ts:16,23`) invents `'SALOON'` and `'PICKUP'` — the real backend `BodyType` enum values are `SEDAN`/`PICKUP_TRUCK`. These wrong values are sent from three places: `HomeScreen.tsx:255`'s "Saloon" quick category, and two spots in `SearchScreen.tsx` (`:54` quick chip, `:65` filter chip). Unlike F10, this one fails loudly at the network layer — `@IsEnum` rejects the value and `GET /listings` 400s — but `SearchScreen.tsx:326`'s empty `catch {}` swallows it, so the buyer just sees nothing happen. This is reachable from the Home screen, not just deep in Search filters. Separately: mobile only offers 8 of web's 13 body types (`BODY_TYPE_KEYS`, `src/components/icons/BodyTypeIcons.tsx:177-180`) — missing Crossover, Sports Car, Minivan, Station Wagon, MPV.

**Fix:** change `bodyTypes.ts`'s `SALOON`→`SEDAN`, `PICKUP`→`PICKUP_TRUCK` (check all call sites, including any display-label assumptions), add the 5 missing body types with chips/icons, and add a repo-wide grep for any other hardcoded `'SALOON'`/`'PICKUP'` strings before calling this closed — the same wrong values may be baked into other screens (e.g. listing creation body-type pickers) beyond just Search/Home.

**Status: DONE** (2026-07-15). Fixed `constants/bodyTypes.ts` (the single source of truth — `SellCarFlowScreen.tsx`'s own `BODY_TYPES` is derived from this file via `BODY_TYPE_ICONS.map(...)`, so this one fix also closes a gap this finding didn't originally scope: **sellers/dealers picking "Saloon" or "Pickup" at listing creation would have had their `POST /listings` call 400 too** — `bodyType` is `@IsEnum(BodyType)` server-side, same as the search filter. Confirmed via `backend/src/listings/dto/create-listing.dto.ts:220-223`.) All 13 real enum values now present (added `STATION_WAGON`, `CROSSOVER`, `SPORTS_CAR`, `MINIVAN`, plus the already-declared-but-unused `MPV`/`MINIVAN` icon mapping), and the invented `'OTHER'` entry removed (not a real enum member — same bug, would have 400'd at listing creation the same way). Fixed the two other hardcoded call sites found by grep: `HomeScreen.tsx`'s body-type chip row and `SearchScreen.tsx`'s quick-filter + filter-modal arrays.
>
> **Second bug found and fixed in the same file:** several of the existing icon names (`'car-suv'`, `'car-limousine'`, `'truck'`) aren't in `BrandIcon.tsx`'s `ICON_MAP` (which maps these Ionicons/MCI-style name strings to actual `lucide-react-native` components — this app's "MaterialCommunityIcons" export is really just an alias for the same Lucide-backed `Ionicons` component) and were silently rendering as a generic `HelpCircle` glyph for SUV, Saloon, and Pickup. Rather than ship 4 more body types with the same latent bug, added `'van-utility'` and `'car-pickup'` to `ICON_MAP` (both → `Truck`) and pointed every new/fixed entry at names already confirmed present in the map. `npx tsc --noEmit` clean.

---

### F12 — MISSING: Engine Size (cc) and CO2 Emissions filters absent from mobile Search

**Files:** `src/screens/main/SearchScreen.tsx` (no `minEngine`/`maxEngine`/`maxCo2` anywhere, confirmed via grep), `src/app/search/page.tsx:108-110,763-780` (web), `backend/src/listings/dto/listing-filter.dto.ts:134,141,148`

Web has a working engine-size range filter and a CO2-emissions cap filter with quick-select presets; both are real, validated DTO fields. Mobile otherwise closely mirrors web's filter set (fuel, transmission, condition, ULEZ, Euro standard, BHP range, seller type, doors/seats, an 18-item features list, isImported, distance — all present) but has no UI or param for either of these two.

**Fix:** add both filter sections to `SearchScreen.tsx`'s filter modal, matching web's range-input/preset-chip pattern already used for BHP.

---

### F13 — MISSING: Terms, How It Works, and Services screens are built but unreachable

**Files:** `src/navigation/MainStackNavigator.tsx:190-194` (registers `TermsScreen`/`HowItWorksScreen`/`ServicesScreen`), `src/components/GlobalDrawer.tsx:45-52` (drawer links, none of the three), `src/screens/auth/SignupScreen.tsx:303` ("I agree to the Terms" — plain unlinked text)

All three screens are fully implemented and registered as routes, but a repo-wide search for `navigation.navigate('Terms'|'HowItWorks'|'Services')` returns zero call sites. No drawer entry, no signup-flow link, nothing. A buyer can never actually open Terms of Service, How It Works, or Services content on mobile — the screens exist but are dead code from a reachability standpoint. Same bug class as `FEATURE_AUDIT.md` Issue 12 (`/dashboard/user` unreachable via the web's own role-router).

**Fix:** add drawer entries (or footer links, matching wherever makes sense in the mobile IA) for all three, and link `SignupScreen.tsx:303`'s "Terms" text to `navigation.navigate('Terms')`.

---

### F14 — MISSING: Reviews and Finance marketing hub pages have no mobile equivalent

**Files:** `src/app/reviews/page.tsx`, `src/app/finance/page.tsx` (web) — no `ReviewsScreen`/`FinanceScreen` anywhere in mobile `src/screens/`, no route, no drawer entry

Web's `/reviews` (trust stats + review grid) and `/finance` (finance calculator, lending-partner grid, application form) are full marketing/discovery pages with no mobile counterpart at all. This is distinct from the already-tracked "Finance Calculator: Coming Soon" widget on `VehicleDetailScreen` (that's a per-listing inline widget, correctly labeled incomplete) — this finding is about the top-level Finance hub and Reviews page, which don't exist on mobile in any form, complete or stubbed.

**Fix:** product call on whether these need mobile screens at all (marketing pages are sometimes deliberately web-only) — if yes, port both as new screens; if these are intentionally web-only, note that decision here so it isn't re-flagged.

---

### F15 — MISSING, minor: Live Auctions screen has no search/filter box

**Files:** `src/screens/main/LiveScreen.tsx` (no search/filter control), `src/app/auctions/page.tsx:320-330` (web — live make/model search input)

Web's `/auctions` page has a search input filtering the live/upcoming auction grid by make/model. Mobile's `LiveScreen.tsx` renders both sections with no search or filter at all. Likely low-impact given auction volume is probably smaller than general listings, but a real, unambiguous capability gap.

**Fix:** add a simple make/model text filter above the Live/Upcoming sections, consistent with `SearchScreen.tsx`'s existing search-input pattern.

---

### F16 — MISSING, dealer: CRM is a flat filtered list, not web's Kanban board — a materially smaller feature, not just a UI difference

**Files:** `src/screens/main/DealerLeadsScreen.tsx:37,66-72,340-362,580-587`, `src/app/dashboard/dealer/crm/page.tsx:19-25,374-497` (web)

Web's dealer CRM is a true 6-column drag-and-drop Kanban board (NEW/CONTACTED/QUALIFIED/NEGOTIATING/WON/LOST) giving an at-a-glance pipeline view with drag-to-reassign. Mobile's `DealerLeadsScreen.tsx` has `FilterTab = 'All' | 'Hot' | 'Warm' | 'New'` only — status changes happen one lead at a time via a chip-tap footer inside a detail sheet, and the filter tabs collapse WON and LOST into an untitled "Cold" bucket with **no dedicated filter to view just Won or just Lost leads** (only reachable by scrolling "All"). There is no visual pipeline overview anywhere on mobile — the funnel bar chart elsewhere (`DealerProfileScreen.tsx:465-476`) is read-only aggregate counts, not a working board. All underlying CRUD (status update, notes, staff reassignment, message lead, manual creation) works correctly on mobile — this is specifically about the missing pipeline-visualization/drag-reassign interaction that web markets as the headline feature of "CRM."

**Fix:** product call on whether mobile needs a true Kanban interaction (drag-and-drop is awkward on touch and would need real design work — e.g. long-press-to-reassign via a stage picker instead of drag) or whether a dedicated Won/Lost filter plus a visual (non-interactive) pipeline summary is an acceptable mobile-appropriate substitute. Flagging as the single biggest feature-scope gap found in this sweep — worth a product decision before any code work.

---

### F17 — cosmetic/minor, dealer: drawer's "Dealer auction manager" item falsely claims the feature is "Coming Soon"

**Files:** `src/components/GlobalDrawer.tsx:122-135`, `src/screens/main/DealerInventoryScreen.tsx:319-329` ("PUT ON AUCTION" button, works), `src/screens/main/DealerProfileScreen.tsx:332-348` ("Manage auctions" row, works)

The drawer's "Dealer auction manager" item is wired to show a "Coming Soon" alert, but dealer auction management is fully functional and reachable from two other places (`DealerInventoryScreen`'s put-on-auction button, `DealerProfileScreen`'s "Manage auctions" row — both route to the working, role-agnostic `SellerAuctionsScreen.tsx`). The drawer item is stale, not the feature — it was accurate once but the feature shipped without updating this entry point.

**Fix:** one-line change — repoint the drawer item's `action` to navigate to `SellerAuctions` instead of showing the alert.

---

### F18 — MISSING, dealer: Dealer Finance dashboard has zero mobile implementation

**Files:** `src/app/dashboard/dealer/finance/page.tsx` (web, 219 lines, `GET /finance/my` + `PATCH /finance/:id/status`) — repo-wide grep for `FinanceApplication`/`/finance`/`financeApi` in mobile `src/` returns zero matches

Web's dealer Finance page lets a dealer view and update the status (PENDING/APPROVED/FUNDED/REJECTED) of finance applications where they're the buyer. No mobile screen, API wrapper, or navigation entry exists for this at all — not in the stack navigator, drawer, or dealer profile's "Needs Attention" list.

**Fix:** add a `DealerFinanceScreen.tsx` calling the same two endpoints, matching web's status-badge/metric-card layout, with a drawer/profile entry point.

---

### F19 — MISSING, dealer: no mobile equivalent of the mandatory dealer phone gate

**Files:** `src/app/dashboard/dealer/layout.tsx` (`DealerPhoneGate`, web) — no "Gate"-named component anywhere in mobile `src/`, `dealerProfile.phone` only referenced as an optional field in `SettingsScreen.tsx:80,125,171,596-597`

Web blocks the entire dealer dashboard with a full-screen, non-dismissable modal until a verified dealer sets a contact phone (`PATCH /users/dealer-profile`). Mobile has no equivalent gate, banner, or nag — a verified dealer can use every dealer screen indefinitely without ever being prompted to set a phone. Distinct from F7 (already fixed — that's about buyers *seeing* a number once set); this is about mobile never *enforcing or nudging toward* setting it in the first place. Downstream consequence: phone-less dealer listings will show no contact number to buyers (per F7's own gating logic) with nothing on mobile warning the dealer why.

**Fix:** add a blocking or dismissable-but-recurring prompt (product call on how hard to gate, matching web's severity or intentionally softer for mobile UX) when a verified dealer has no `dealerProfile.phone` set, surfaced on dealer dashboard entry.

---

### F20 — cosmetic, seller: Pricing screen has stale copy from before two recent web commits

**Files:** `src/screens/main/PricingScreen.tsx:85,92,103`, `src/app/pricing/page.tsx` (web, commits `c5528d53`, `83c3f1eb`)

Two things web fixed recently that mobile's `PricingScreen.tsx` still contradicts: (1) Standard tier still says "30-day listing" (`:92,103`) — web bumped this to 60 days in `c5528d53`. (2) Basic tier still says `{ label: 'Analytics', included: false }` (`:85`) — web's `83c3f1eb` corrected this to "included," since `SellerPerformanceScreen.tsx`'s underlying `/listings/performance` call has no tier gating on mobile either (independently confirmed) — the claim was already wrong before web's fix, mobile just never caught up.

**Fix:** two one-line copy changes matching web's current text.

---

### F21 — cosmetic, seller: seller listings screen missing "Listed on <date>"

**Files:** `src/screens/seller/SellerListingsScreen.tsx` (no `createdAt` reference, confirmed via grep), `src/app/dashboard/user/page.tsx` (web, commit `c5528d53` added this to both card and table views)

Web just added a "Listed on {date}" line to each listing row. Mobile's equivalent screen shows title/price/view-count only, no listed date.

**Fix:** add the date, reusing the `getDaysListed()`-style helper pattern already used in `SellerDashboardScreen.tsx:110-114`, or a literal `toLocaleDateString` matching web's format.

---

### F22 — cosmetic, minor, seller: no 7d/30d period toggle on seller dashboard KPIs

**Files:** `src/screens/seller/SellerDashboardScreen.tsx` (calls `/dashboard/seller`/`/listings/stats` with no `period` param), `backend/src/dashboard/dashboard.service.ts:14` (`period: '7d' | '30d' = '30d'` default)

Web's `/dashboard/seller` has a `PeriodToggle` switching the KPI row between 7-day and 30-day views. Mobile always gets the backend's `30d` default silently, with no way to switch. Not incorrect data, just missing a control web offers.

**Fix:** low-priority — add a toggle if/when other seller-dashboard polish work happens; not worth a dedicated pass on its own.

---

### F23 — MISSING/inert, cross-cutting: Notification Settings screen is fully built but every control is disconnected from actual notification delivery

**Files:** `src/screens/main/NotificationSettingsScreen.tsx` (~15 controls, `:96-107` PATCHes `preferences.notifications.*` successfully), `backend/src/notifications/notifications.service.ts:26-59` (`NotificationsService.create` — only reads `preferences.expoPushToken`)

The settings screen correctly saves per-event-type mute toggles, push/email/SMS delivery-channel choices, digest frequency, and quiet hours with start/end time. But the only place a notification actually gets sent (`NotificationsService.create`) reads *only* `expoPushToken` from `preferences` — it never checks `muteAll`, `outbid`, `quietHours`, `sms`, `freq`, or any other field the settings screen writes. Every notification fires unconditionally to every user regardless of configuration. Compounding this: no SMS provider (Twilio or otherwise) exists anywhere in `backend/src/`, so the "SMS" toggle promises a channel that can never work even if the backend did read it. This is a `backend/` fix, not mobile-only — the UI is already correct, it's writing to a preferences object nothing downstream consults.

**Fix:** in `NotificationsService.create`, branch on the relevant `preferences.notifications.*` fields before sending (mute check, quiet-hours window check at minimum) — coordinate with whoever owns `backend/`, this is shared infrastructure. Either implement SMS delivery or remove the SMS toggle from the settings UI until there's a provider to back it.

---

### F24 — MISLEADING, medium-high severity, cross-cutting: buyer-facing delivery fee estimate doesn't match what the backend actually charges

**Files:** `src/lib/deliveryApi.ts:39` (`calcDeliveryFeeExVat`), `src/screens/vehicle/VehicleDetailScreen.tsx:164,169,1117`, `backend/src/delivery/delivery.service.ts:132-134`

Mobile's `calcDeliveryFeeExVat` implements a hardcoded tiered formula (£30 flat ≤10mi, £30+(d−10)×£2 for 11–30mi, £70+(d−30)×£1.50 beyond) with a comment claiming "server uses the same tiered logic." It doesn't: the actual backend computes `estimatedCostGbp = roadDistanceMiles × listing.deliveryPricePerMile` — a per-listing, seller-configurable rate applied to Google Maps road distance — defaulting to **£0** if the seller never set a rate. Mobile also uses client-side haversine (straight-line) distance rather than road distance. This fabricated estimate is shown to buyers twice before they submit a delivery request (`:169` live estimate, `:1117` final display) and can differ substantially from the real figure the backend returns in the actual `DeliveryRequest`.

**Fix:** either fetch the real estimate from the backend (check if `delivery.service.ts` exposes a quote/estimate endpoint separate from request creation — if not, this may need a new lightweight `GET` endpoint) or, at minimum, label mobile's number clearly as a rough estimate and reconcile it against the real number once the request is created, rather than presenting a fabricated formula as if it were the server's own logic.

---

### F25 — medium severity, cross-cutting: auction buyer-fee payment has no server-confirmation step, unlike mobile's own HPI/KYC flows

**Files:** `src/screens/vehicle/AuctionCompleteScreen.tsx:211-227`, `src/screens/vehicle/VehicleDetailScreen.tsx:314-360` (HPI checkout, polls 5× with backoff), `src/screens/main/DealerKYCScreen.tsx:371-388` (KYC checkout, same pattern), `backend/src/payments/payments.controller.ts:108-116` (`POST /payments/apply-auction-fee`, an explicit "webhook fallback" endpoint)

Mobile already has an established, correct pattern for Stripe-redirect-then-confirm flows: HPI checkout and dealer KYC checkout both poll the relevant `GET` endpoint several times with backoff before declaring success, specifically to handle webhook delay. `AuctionCompleteScreen.tsx` doesn't follow its own app's pattern — it sets `setPaid(true)` (`:227`) immediately once `presentPaymentSheet()` returns without error, never polls `/auctions/:id`/`/listings/:id` for `buyerFeePaid`, and never calls the backend's purpose-built fallback endpoint. If the webhook is delayed, the UI shows a paid/success screen while the server may still show unpaid, silently blocking downstream gates (chat unlock, handover flow) with no retry surfaced.

**Fix:** apply the same poll-with-backoff pattern already used for HPI/KYC to `AuctionCompleteScreen.tsx`, and call `/payments/apply-auction-fee` as the explicit fallback if polling doesn't confirm within the retry budget — the backend already built this endpoint for exactly this purpose.

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

## 2B. Staged roadmap — F12–F25 (added 2026-07-15)

F10/F11 (the two broken filters) are already fixed above. This continues the numbering for the rest of the 2026-07-15 sweep.

**Cross-cutting constraint for every stage below:** none of this work may reintroduce the patterns `mobile-audit.md` P1–P7 already flagged and Stage 8 above already cleaned up — no `ScrollView` + `.map()` for anything that can grow (use `FlatList`), no unmemoized row/card components, no inline closures passed as `onPress`/`renderItem` where a stable `useCallback` is cheap to provide. This matters concretely for Stage 14 (the CRM board) and Stage 12 (more filter chips) below — both add new lists.

### Stage 12 — Mechanical, low-risk fixes: F12, F13, F15, F17, F20, F21, F22

**Why grouped:** all seven are small, well-scoped, and need no product decision — pure "make mobile say/do what web already does." Bundling them into one stage/session is more efficient than seven separate ones.

- **F12** — add Engine Size (cc) and CO2 Emissions range filters to `SearchScreen.tsx`'s filter modal, same range-input/preset-chip pattern already used for BHP.
- **F13** — wire up navigation to `TermsScreen`/`HowItWorksScreen`/`ServicesScreen` (drawer entries + link `SignupScreen.tsx`'s "Terms" text) — they're already built, just unreachable.
- **F15** — add a make/model search input above `LiveScreen.tsx`'s Live/Upcoming sections, reusing `SearchScreen.tsx`'s existing search-input pattern.
- **F17** — one-line fix: repoint `GlobalDrawer.tsx`'s "Dealer auction manager" item from the "Coming Soon" alert to `navigation.navigate('SellerAuctions')`.
- **F20** — two copy fixes in `PricingScreen.tsx`: Standard tier "30-day" → "60-day"; Basic tier `Analytics: included: false` → `true`.
- **F21** — add "Listed on `<date>`" to `SellerListingsScreen.tsx`'s listing rows, reusing the `getDaysListed()`-style helper already in `SellerDashboardScreen.tsx`.
- **F22** — low priority, only do if touching `SellerDashboardScreen.tsx` for something else anyway: add a 7d/30d period toggle matching web's `PeriodToggle`.

**Acceptance:** `npx tsc --noEmit` clean; each of the 7 items independently spot-checked against the corresponding web page/behavior described in its finding above.

**Status: DONE** (2026-07-15). All 7 items shipped:
- **F13** — added `Services`/`HowItWorks`/`Terms` drawer entries. `Terms` needed a second registration inside `AuthNavigator.tsx` (not just `MainStackNavigator.tsx`) — `RootNavigator` renders Auth/Main as mutually exclusive stacks, so a pre-signup user couldn't reach the Main-stack copy at all; `SignupScreen.tsx`'s "Terms" text now navigates there via the newly-typed `AuthStackParamList['Terms']`. `TermsScreen.tsx` itself needed no changes — it only calls `navigation.goBack()`, which works regardless of which stack mounted it.
- **F15** — added a make/model search bar to `LiveScreen.tsx`, filtering both Live and Upcoming sections client-side (no backend auction-search param exists, matches web's own approach). Empty states now distinguish "no auctions at all" from "no results for this search."
- **F17** — repointed the drawer item to `navigation.navigate('SellerAuctions')`.
- **F20** — both copy fixes applied, text now matches web exactly.
- **F21** — added `createdAt` to `SellerListingsScreen.tsx`'s local `ApiListing` type and render a "Listed on `<date>`" line using the same `toLocaleDateString('en-GB')` format as web.
- **F22** — added a 7D/30D toggle to `SellerDashboardScreen.tsx`'s header, wired to `/dashboard/seller?period=`. Note: `/listings/stats` (the other endpoint this screen calls) has no `period` param — it's lifetime totals — so only the offers/saved-count figures sourced from `/dashboard/seller` respond to the toggle, matching what the backend actually supports.
- **F12** — added Engine Size (cc) min/max and CO₂ (g/km) max + preset-chip filters to `SearchScreen.tsx`, plus the `minEngine`/`maxEngine`/`maxCo2` params to `listingsApi.ts`'s `searchListings()`. Wired into the active-filter count and "Clear All" reset alongside the existing BHP filter it mirrors.

`npx tsc --noEmit` clean across all 7. Not on-device verified (no adb/emulator in this environment).

---

### Stage 13 — F25: auction buyer-fee payment needs the same server-confirmation pattern as HPI/KYC

**Why here, ahead of the bigger items:** this is payment-adjacent (not a new charge, but a confirmation gap that can silently block the post-auction handover/chat flow), mobile-only (no backend change — `/payments/apply-auction-fee` already exists for exactly this), and small — same shape of fix as the F1/F2/F6 payment-integrity work that was correctly prioritized first in Stage 0.

In `AuctionCompleteScreen.tsx`, replace the immediate `setPaid(true)` after `presentPaymentSheet()` with the same poll-with-backoff pattern already used in `VehicleDetailScreen.tsx`'s HPI checkout (`:314-360`) and `DealerKYCScreen.tsx`'s KYC checkout (`:371-388`): poll `/auctions/:id` or `/listings/:id` for `buyerFeePaid` a handful of times with backoff, and if it hasn't flipped by the end of the retry budget, call `/payments/apply-auction-fee` as the explicit fallback before declaring success or surfacing a retry to the user.

**Acceptance:** code review confirms the same poll shape as the other two flows; **cannot be on-device verified from this environment** (would mean a live Stripe charge) — flag for a real-device pass alongside the other unverified payment flows already listed in Section 3.

**Status: DONE** (2026-07-15), with a correction to this plan's original assumption. `/payments/apply-auction-fee` (`payments.service.ts:747-776`) calls `stripe.checkout.sessions.retrieve(sessionId)` — it's specifically the fallback for the **hosted Checkout Session** flow (web's `/payments/checkout`), not the **native Payment Sheet** flow `AuctionCompleteScreen.tsx` actually uses (`createPaymentSheet` → PaymentIntent, no `sessionId` anywhere in that flow). Calling it from this screen would have been a no-op at best, a confusing 400 at worst. Checked the webhook instead: `payments.service.ts:564,616-629` has a separate `payment_intent.succeeded` case that correctly sets `Auction.buyerFeePaid` for `type === 'COMMISSION'` — so the webhook path is already correct, mobile just wasn't waiting for it. Fix applied: after `presentPaymentSheet()` returns with no error (Stripe has genuinely charged the card at this point), poll `GET /auctions/:id` up to 5× with a 1500ms backoff for `buyerFeePaid` — same shape as the HPI/KYC flows, confirmed by reading both. If it doesn't confirm in that budget, the screen still shows success (the charge is real, telling the user otherwise would be false) but shows an honest "still confirming with our system" banner instead of silently implying chat/handover are unlocked. No backend change needed — the existing `GET /auctions/:id` (public, no auth guard) already returns `buyerFeePaid` as a plain scalar field. `npx tsc --noEmit` clean. **Not on-device verified** — same live-Stripe-charge limitation as F1/F3.

---

### Stage 14 — F16: dealer CRM — board view + real Won/Lost visibility, deliberately *not* drag-and-drop

**Decision (made per direction to prioritize long-term stability and performance over literal web parity):** mobile will **not** implement physical drag-and-drop reordering. Reasoning:

- Drag-and-drop across a horizontally-scrolling multi-column layout is a well-documented source of gesture-conflict bugs on React Native (the drag gesture and the column `ScrollView`'s own pan gesture compete for the same touch stream) and a known perf sink on mid/low-tier Android — exactly the device tier `mobile-ui-ux-audit.md`'s density/perf findings are already worried about.
- The actual user-facing gap identified in F16 is **visibility** (no pipeline overview, Won/Lost buried in "All") and **reassignment friction** (one lead at a time via a nested sheet) — not specifically the physical act of dragging. Both are addressable without a drag gesture.
- This keeps the implementation inside patterns already proven stable in this codebase (`FlatList`, `BottomSheet` action sheets) rather than introducing a new gesture paradigm this app has never used.

**What to build instead:**
1. A horizontally-scrollable board: outer horizontal `FlatList` of 6 stage columns (NEW/CONTACTED/QUALIFIED/NEGOTIATING/WON/LOST), each column an inner vertical `FlatList` of memoized lead cards (`React.memo`, stable `renderItem` via `useCallback` — required by the cross-cutting constraint above, and especially important here since this is a brand-new list, not a retrofit).
2. Stage reassignment via a tap target on each card (small "move" icon or long-press) opening the same `STATUS_OPTIONS` action sheet `DealerLeadsScreen.tsx` already has — no new interaction pattern, just triggered from the board instead of only from the detail sheet.
3. Fix the Won/Lost visibility gap regardless of the above: `DealerLeadsScreen.tsx`'s existing flat-list view keeps its `FilterTab`, but split the current catch-all "Cold" grouping into explicit Won/Lost filter tabs — this alone closes the "can't find Won leads without scrolling All" complaint and should ship even if the board view slips.
4. Existing CRUD (status update, notes, staff reassignment, message lead, manual creation — already confirmed working) is reused as-is; this stage is purely the board UI + the Won/Lost filter fix.

**Acceptance:** `npx tsc --noEmit` clean; manual check that switching a lead's stage from the board updates the same backend state the existing detail-sheet flow does (no new endpoint, just a second UI entry point to the same `PATCH`); the Won/Lost filter split ships independently checkable.

**Status: DONE** (2026-07-15). Both parts shipped in `DealerLeadsScreen.tsx`:
- **Won/Lost filter split** — `FilterTab` gained `'Won'`/`'Lost'`, `FILTERS` and `filteredLeads` updated accordingly. Ships independently of the board — list view alone now lets a dealer find Won/Lost leads without scrolling "All."
- **Board view** — a `viewMode` toggle (list/board icon pair) next to the existing add-lead button. Board is a horizontal `FlatList` of `BOARD_STAGES` (NEW/CONTACTED/QUALIFIED/NEGOTIATING/WON/LOST — NEW added since leads do sit there even though it's not a `STATUS_OPTIONS` manual-reassignment target), each column an inner vertical `FlatList` of memoized `BoardCard` rows grouped via a `useMemo` (`leadsByStage`) so the grouping only recomputes when `leads` actually changes, not on every render. No drag gesture anywhere — tapping a card's move icon opens a `BottomSheet` listing the same `STATUS_OPTIONS` the list-view detail screen's status footer already uses, reusing `handleUpdateLeadStatus` (the exact same `PATCH /dealers/leads/:id` call, just a second UI entry point to it — no new endpoint). Board is a pure client-side transform of the already-fetched `leads` state; no separate fetch, so it can't drift out of sync with list view. Filter tabs are hidden in board mode (the board already shows every stage at once) but unaffected in list mode. `npx tsc --noEmit` clean. **Not on-device verified** — horizontal-outer/vertical-inner nested `FlatList` scroll behavior (perpendicular axes, should be conflict-free per standard RN board patterns) should get a real-device pass before shipping, along with general density/readability of 240px-wide columns on smaller screens.

---

### Stage 15 — F19: dealer phone gate — soft nudge, not a hard block

**Decision (same stability/long-term framing as Stage 14):** web blocks the *entire* dealer dashboard with a non-dismissable modal until a phone is set. A hard, unskippable full-screen block is a heavier interruption pattern than most mobile apps use for a non-blocking data-completeness nudge, and risks feeling broken/buggy if it fires at an awkward moment (e.g. mid-notification-tap deep link into a specific screen). Proposed default: a dismissible-but-recurring banner/card at the top of the dealer dashboard (`DealerProfileScreen.tsx`) when `dealerProfile.phone` is unset, reappearing each session until resolved — real pressure without a mobile-inappropriate blocking modal. This is a judgment call, not a certainty; revisit if product wants the harder web-equivalent block instead.

**Acceptance:** banner appears/disappears correctly based on `dealerProfile.phone` presence; dismissal doesn't set any "seen" flag that suppresses it permanently (it should return next session, per "recurring").

**Status: DONE** (2026-07-15). `DealerProfileScreen.tsx` fetches `GET /users/me` on mount (the same endpoint `SettingsScreen.tsx` already uses for `dealerProfile.phone` — confirmed by reading its fetch, since `authStore`'s lightweight `User` type doesn't carry this field) and shows a dismissible warning-toned banner ("Add a contact phone" / tap → `Settings`) whenever `dealerProfile.phone` is empty. Dismissal is local component state only — no `AsyncStorage`/persisted flag — so it reappears on the next screen mount (next session), per the "recurring" design. `npx tsc --noEmit` clean.

---

### Stage 16 — F14: Reviews and Finance marketing hub pages

**Decision:** port both as mobile screens rather than leaving them web-only — a buyer/dealer using only the mobile app should be able to read reviews and explore finance options, both of which plausibly influence a purchase decision, without needing to switch to a browser. Build as mobile-native screens (not literal ports) — `ReviewsScreen.tsx` (trust stats + review list, reusing existing review-fetching logic already proven in `SellerProfileScreen.tsx`/`AuctionCompleteScreen.tsx`) and `FinanceScreen.tsx` (calculator + lending-partner info; note mobile already has a "Coming Soon"-labeled inline finance calculator on `VehicleDetailScreen.tsx` — decide whether this new screen supersedes that inline widget or the two coexist, don't build two competing finance calculators).

**Acceptance:** both screens reachable from the drawer; `npx tsc --noEmit` clean.

---

### Stage 17 — F23 + F24: backend-touching cross-cutting fixes (coordinate with whoever owns `backend/`)

**Why grouped:** both are "mobile shows/promises something the backend doesn't actually back up" bugs, both need a `backend/` change, neither is mobile-only like Stage 13.

- **F23** — in `backend/src/notifications/notifications.service.ts`'s `NotificationsService.create`, read and honor `preferences.notifications.*` (mute-all, per-event mutes, quiet hours at minimum) before sending — currently only `expoPushToken` is read, so every saved preference is inert. Either implement real SMS delivery (a provider needs to be chosen and wired) or remove the SMS toggle from `NotificationSettingsScreen.tsx` until there's a backend to support it — don't leave a control that can never work.
- **F24** — replace `deliveryApi.ts`'s fabricated tiered formula with the real backend figure. Check whether `backend/src/delivery/delivery.service.ts` exposes a quote/estimate endpoint separate from request creation; if not, this likely needs a small new `GET` endpoint before mobile can show a real number pre-submission. Until that exists, at minimum re-label mobile's current number as an approximate estimate rather than presenting a fabricated formula as if it were the server's own logic.

**Acceptance:** F23 — a muted event type no longer generates a notification (test via a real event, e.g. an outbid notification with `outbid: false`); F24 — the pre-submission estimate and the real `DeliveryRequest.estimatedCostGbp` match (or mobile's UI is honestly labeled as approximate if a live-quote endpoint isn't feasible this pass).

---

## Phase 3 (future, not started) — UI/UX consistency & transition-animation pass

Explicitly deferred — noted here so it's on the roadmap, not detailed or started in this session. Once Stages 12–17 land, the next phase is a dedicated pass on interaction polish: consistent, subtle screen-transition and micro-interaction animations across the app (this codebase already depends on `react-native-reanimated`/`react-native-gesture-handler` for the damage viewer and pinch-to-zoom, so the tooling is already in place — this phase is about applying it more broadly, not introducing a new animation dependency), plus finishing the design-token consistency work `mobile-ui-ux-plan.md` Stage 2 started. Scope this properly (its own audit of current transition inconsistencies) when the time comes rather than bolting animation work onto the functional fixes above — mixing "make it correct" and "make it feel polished" work in the same PRs makes both harder to review and to roll back independently.

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
