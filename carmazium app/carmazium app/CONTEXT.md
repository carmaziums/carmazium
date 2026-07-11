# Carmazium Mobile — Project Context

Read this before starting work, especially on a machine you haven't worked from before (like the build machine). See `CLAUDE.md` in this same directory for conventions and rules to follow while coding.

## What this app is

React Native/Expo mobile app for Carmazium — a UK vehicle marketplace with retail listings and live auctions. Buyer, seller, and dealer flows. Same backend as the web app (`https://carmazium-hjoh9w.fly.dev`), which lives at the repo root (`src\`, sibling of `backend\` and this directory — resolve relative to wherever the repo is checked out; this used to say `D:\carmazium\src\`, which was stale on other machines) as a separate Next.js codebase — this mobile app is `<repo-root>\carmazium app\carmazium app\`.

## Where things stand (as of 2026-07-06)

A batch of fixes landed this session, in this order — useful to know the shape of what changed if something looks unfamiliar:

1. **3D vehicle viewer was fake** — it was a flat SVG car silhouette, not an actual 3D model. Rebuilt as a WebView + Three.js viewer loading `src/assets/3d/vehicle.glb`, with orbit-drag rotation, tap-to-mark-damage hotspots, and per-zone hide/photo actions.
2. **EAS Update/OTA pipeline was non-functional** — the build machine only ever ran raw `gradlew.bat`, never `eas build`, so no update channel was ever embedded in the shipped APK, and no channel existed on the EAS backend anyway. Fixed `app.json` (`updates.requestHeaders`, `runtimeVersion.policy: "sdkVersion"`), created a real `production` channel, and published to it.
3. **Listing publish was broken** — the backend rejects unknown DTO fields, and the mobile payload was sending several the web app never does (`declarationAcknowledged`, `priceAsking`, `damageRecords`, `dateOfLastV5CIssued`). Fixed both listing screens that existed at the time.
4. **Payment screen froze on a black screen** — `Linking.openURL` was handing off to the system browser with no way back. Switched to `expo-web-browser`'s `openAuthSessionAsync`, an in-app auth sheet that returns control to the app.
5. **Two separate, drifted listing-creation screens** (`SellCarsScreen.tsx` and `SellCarFlowScreen.tsx`) were independently maintained and had diverged — one had the 3D viewer and no auction support, the other had auction support and a flat 2D damage grid with no 3D model at all, and AI description generation was broken/inconsistent between them. Consolidated to a single canonical flow: `SellCarFlowScreen.tsx` now has everything (3D viewer, auction scheduling, condition field, AI description enrichment, banner presets, departed-sale field, consistent damage-zone naming with web). `SellCarsScreen.tsx` was deleted; all navigation repointed.
6. **`expo-dev-client` added (this step)** — see "Dev workflow" below. This is new; previously the only way to test a code change was a full release rebuild.

If you're picking this up fresh and something references `SellCarsScreen` — it no longer exists. The listing/auction flow is `SellCarFlowScreen.tsx`, reached via the `SellCarFlow` route.

## Dev workflow — two separate paths

### Fast loop (day-to-day iteration) — use this unless you have a reason not to

Requires an Android SDK + emulator/device, which this dev machine (wherever you're reading this from, if it's `D:\carmazium`) does **not** have. The build machine (`C:\ca\carmazium\`) does, since it already runs `gradlew.bat` successfully there.

**One-time** (or whenever a native dependency / `app.json` permission-scheme-plugin change lands):
```cmd
cd "C:\ca\carmazium\carmazium app\carmazium app"
git pull
npm install
npx expo prebuild --clean --platform android
npx expo run:android
```
This builds a debug APK with the dev client baked in and installs+launches it on whatever `adb devices` sees (emulator or a USB-connected device with debugging enabled). It loads `.env` automatically — no manual env vars needed for this path.

**Every day after that:**
```cmd
npm start
```
Open the already-installed app; it reconnects to Metro automatically. Every JS/TSX save hot-reloads instantly.

### Release build (only when actually shipping to real users)

```cmd
cd "C:\ca\carmazium\carmazium app\carmazium app"
git pull
npm install
npx expo prebuild --clean --platform android
cd android
set EXPO_PUBLIC_API_URL=https://carmazium-hjoh9w.fly.dev
set EXPO_PUBLIC_SUPABASE_URL=https://bwtnzmevjlowwronylxm.supabase.co
set EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dG56bWV2amxvd3dyb255bHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNzU0ODYsImV4cCI6MjA2NDY1MTQ4Nn0.afLqKj5aWzeVulSBWbmVypA9Zs2Z3uCUkWgUJn7mE0o
set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SCdEd8rAGPNUbOXb0oOcVdPeNpLV4ktAiej1pc8zMxn2YKAcWZOtymIYBvMbmr6P36uzRVQTjEBQdUZdqmfXbC7004ZlbIrGS
rmdir /s /q app\build\generated
rmdir /s /q app\build\intermediates\assets
rmdir /s /q app\build\intermediates\merged_assets
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers 2 --no-daemon
```
The `prebuild --clean` step is mandatory here too — `android/` is gitignored and never auto-updates from `git pull` alone; skipping prebuild is why bugs used to "persist even after reinstalling" a fresh release APK.

Either path can also publish JS-only fixes (no new native module) via `eas update --branch production --message "..."` instead of a full rebuild — faster, but unsafe if a native dependency changed since the last real build (the running binary won't have it compiled in).

## Starting point checklist — build machine, first time after this update

1. `cd "C:\ca\carmazium\carmazium app\carmazium app" && git pull && npm install`
2. Read this file and `CLAUDE.md` if you haven't already (you're doing that now)
3. Confirm an emulator or device is available: `adb devices` should list at least one
4. Run the one-time dev-client build: `npx expo prebuild --clean --platform android && npx expo run:android`
5. From then on, `npm start` + editing code is the loop — no more rebuild-per-change

## Where to look for more detail

- `FEATURE_AUDIT.md` (repo root) — web feature reference the mobile app is audited against
- `.planning/phases/mobile-app-parity/mobile-CONTEXT.md` — older GSD planning doc covering UI polish scope (animations, skeleton states, etc.) — some of it (e.g. "3D viewer not surfaced") is now stale given item 1 above; treat as historical, not current truth

## Known issues / backend follow-ups (2026-07-12)

- **RESOLVED 2026-07-12 (F3, `mobile-production-readiness-plan.md`):** `DealerKYCScreen.tsx`
  never called the £1 verification-fee Stripe checkout (`POST /dealers/kyc/checkout`) that the
  backend added — it only ever posted the form to `POST /dealers/kyc`, so `stripeChargedAt`
  never got set for any mobile-only dealer, and the screen's "Under Review" gate
  (`isPending`) didn't check for it either, so a dealer who submitted saw "Under Review"
  immediately with no way to actually pay. The mobile form also still had the **retired**
  manual-bank-transfer fields (`paymentReference` text input, `paymentScreenshot` upload, and
  "£1 bank transfer to CARMAZIUM TRADING LTD..." copy) — confirmed retired by checking the
  web app's `KycOverlayForm.tsx` (`src/components/dashboard/KycOverlayForm.tsx`), which has
  zero references to either field and is fully Stripe-checkout-driven. Fix mirrors web exactly:
  removed the two retired fields/copy, added `alreadyPaid`/`paidAt` state driven by
  `existingKyc.stripeChargedAt`, changed `isPending` to require `stripeChargedAt` (not just
  `status === 'PENDING'`) so an unpaid submission falls through to the payment step instead of
  a dead-end "Under Review" banner, and after a successful form submit now calls
  `POST /dealers/kyc/checkout` and opens the returned Stripe Checkout URL in
  `StripeCheckoutModal` (the same in-app WebView pattern already used for the HPI report
  checkout on `VehicleDetailScreen.tsx` — not `Linking.openURL`, which is the black-screen bug
  pattern this app already fixed once before). **Not yet done:** on-device verification of a
  real £1 charge completing and `stripeChargedAt` landing — do this before considering dealer
  KYC production-ready on mobile.

- **RESOLVED 2026-07-12 (Stage 0, `mobile-production-readiness-plan.md` F1):** `/payments/intent`
  was rejecting every `type: 'LISTING_FEE'` request outright — `CreatePaymentSheetDto`'s
  `@IsIn(['DEPOSIT','FULL_PAYMENT','COMMISSION'])` didn't include `'LISTING_FEE'`, and the
  global `ValidationPipe` 400'd the request before it ever reached `PaymentsService`. This
  meant **every mobile attempt to publish a paid-tier (BASIC/STANDARD/PREMIUM) classified
  listing failed** — confirmed by reading `backend/src/payments/` directly (this doc's prior
  version couldn't verify this because it was written without backend source access; that's
  fixed too, see below). Three call sites were affected: `SellCarFlowScreen.tsx` (main sell
  flow), `ImportListingModal.tsx` (import-from-URL), and `SellerAuctionsScreen.tsx`
  (also-list-retail). Fix: added `'LISTING_FEE'` to the DTO's allowed types, added a
  `badgeTier` field (required when `type === 'LISTING_FEE'`) so the `payment_intent.succeeded`
  webhook branch — which didn't exist before this fix — knows which tier to activate the
  listing at (mirrors what the web's `checkout.session.completed` handler already did for its
  own `LISTING_FEE` case). All three mobile call sites now send `badgeTier`. Covered by
  `backend/src/payments/payments.service.spec.ts` (new file — `PaymentsService` had zero test
  coverage before this).
  **Still open, deliberately deferred (F2 in the plan doc):** `/payments/intent` still trusts
  the client-supplied `amount` for `DEPOSIT`/`FULL_PAYMENT`/`COMMISSION`/`LISTING_FEE` — it
  doesn't re-derive the real price server-side the way the web's Stripe Checkout Session flow
  does. This is a payment-integrity gap, not just a listing-fee-tier question — scoped out of
  this fix on purpose to keep it reviewable; do it as its own follow-up.

- **Doc path fix (2026-07-12):** this file and `CLAUDE.md` used to hardcode the web app's
  location as `D:\carmazium\src\`, which doesn't exist on every machine this repo is checked
  out on (confirmed stale on the machine this fix was written on — the actual path was
  `<repo-root>\src\`). Both docs now describe the path relative to the repo root instead of a
  hardcoded drive letter. If you're reading this and the path is wrong again, fix it the same
  way rather than re-hardcoding a machine-specific path.
