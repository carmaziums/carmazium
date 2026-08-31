# CarMazium Parity — Progress Log

Append-only session log. Read this first at the start of every session.

## Phase 1 — Audit (branch `parity/audit`, docs-only, no source changes)

| Pass | Session date | Status | Rows written |
|---|---|---|---|
| AUTH | 2026-08-31 | Audited | 36 (AUTH-001..036) |
| BUY | 2026-08-31 | Audited | 32 (BUY-001..032) |
| SELL | 2026-08-31 | Audited | 32 (SELL-001..032) |
| AUCTION | — | Not started | — |
| DASH | — | Not started | — |
| CROSS | — | Not started | — |

## Phase 2 — Implementation (branch `parity/<flow-name>`, one flow per session)

| Flow | Matrix rows | Session date | Status |
|---|---|---|---|

## Session log

### 2026-08-31 — Scaffold
Created `docs/parity/` with the three persistent artifacts. Mapped the three apps
and their entry points:

- Web: `src/` — Next.js 16 App Router, entry `src/app/layout.tsx`
- API: `backend/src/` — NestJS + Prisma, entry `backend/src/main.ts`
- Mobile: `carmazium app/carmazium app/` — Expo 54 + React Navigation 7,
  entry `App.tsx` -> `src/navigation/RootNavigator.tsx`

**Next session should pick up:** Pass 1 — AUTH.  _(done — see below)_

### 2026-08-31 — Pass 1: AUTH

**Method.** Read the web + backend implementation first to establish the contract, then read
mobile and diffed against it. Every citation written into the matrix was re-read directly
before being recorded.

**Scope covered.**
- Web: `src/app/auth/{login,signup,callback,forgot-password,reset-password,onboarding,accept-invite,partners}/page.tsx`, `src/context/AuthContext.tsx`, `src/lib/{supabase,apiClient}.ts`, `src/app/dashboard/page.tsx`, `src/app/dashboard/admin/page.tsx`, `src/components/dashboard/DeleteAccountSection.tsx`
- Backend: `backend/src/auth/{auth.controller,auth.service}.ts`, `backend/src/auth/guards/*`, `backend/src/users/{users.controller,users.service}.ts`, `backend/prisma/schema.prisma` (UserRole), `backend/src/main.ts` (session + pipe config)
- Mobile: `App.tsx`, `src/navigation/*`, `src/store/authStore.ts`, `src/lib/{supabase,apiClient}.ts`, `src/screens/auth/*`, `src/screens/onboarding/OnboardingScreen.tsx`, `src/screens/main/AcceptInviteScreen.tsx`, `app.json`

**Result: 36 rows, AUTH-001 through AUTH-036.**

| Status | Count |
|---|---|
| MISSING | 9 |
| PARTIAL | 8 |
| DIVERGENT | 8 |
| PRESENT | 11 |

P0 rows: AUTH-005 (no role selection at signup), AUTH-013 (no global `onAuthStateChange`),
AUTH-014 (401 never navigates), AUTH-019 (callback handles 2 of 7 branches),
AUTH-020 (no React Navigation linking config), AUTH-026 (7 backend roles collapsed to 3).

**The structural finding.** AUTH-020 is the root of several other rows. Mobile has no
`linking` config on `NavigationContainer` (`App.tsx:254-262`) — all deep-link handling is
an ad-hoc `expo-linking` listener that only matches Supabase auth tokens
(`App.tsx:193-234`). This is why the invite flow needs a paste-the-link workaround
(AUTH-030) and why the OAuth return leg could not be traced end to end (AUTH-003).
Any later pass needing an inbound URL to reach a screen will hit the same wall.

**Not traced — stated explicitly rather than assumed.**
- `ChatContext` was not read; it is referenced in `apiClient.ts` comments as an
  `AUTH_REDIRECT` / `NO_SESSION` caller, so the claim in AUTH-014 is scoped to
  "no handler in `App.tsx`, `RootNavigator.tsx`, or `authStore.ts`" — not "none anywhere".
- The OAuth return leg (AUTH-003) is not traced past `Linking.openURL`.
- Web role gating: the central gates were read, not all files matching the role grep.
- Per-screen contents of the 9 dealer-gated screens (AUTH-028) — gating shape only.
- `screens/main/{Finance,Services}Screen.tsx` (AUTH-029) — named but not read.
- AUTH-023, AUTH-035 and OQ-3 describe interactions I reasoned about from code but did
  **not** run. They are marked as needing device verification and are not asserted as bugs.

**Open questions raised: OQ-1 through OQ-8.** OQ-1 (canonical signup role behaviour) and
OQ-5 (are ADMIN/partner roles in scope for mobile at all) gate the largest chunk of Phase 2
scope — answering those two first will settle roughly a third of these rows.

**Docs-only commit. No source files were modified.**

**Next session should pick up:** Pass 2 — BUY.  _(done — see below)_

### 2026-08-31 — Pass 2: BUY

**Method.** Read web + backend first to establish the contract, then mobile, then diffed.
Every citation recorded in the matrix was re-read directly before being written.

**Scope covered.**
- Web: `src/app/search/page.tsx`, `src/app/buy-cars/[slug]/{page,VehicleDetailsPageClient}.tsx`, `src/app/vehicle/[id]/{page,VehicleDetailPageClient}.tsx`, `src/app/compare/page.tsx`, `src/app/checkout/{page,success/page,cancel/page}.tsx`, `src/app/auctions/page.tsx`, `src/app/HomeClient.tsx`, `src/lib/listingApi.ts`, `src/components/features/CarCard.tsx`
- Backend: `listings`, `watchlist`, `offers`, `transactions`, `payments`, `delivery`, `hpi` controllers + DTOs; `schema.prisma` (`Listing`, `ListingType`, `ListingStatus`, `Offer`, `Transaction`, `WatchlistItem`, `TransmissionType`)
- Mobile: `screens/main/{Search,Home,Compare,Saved,Watchlist,PurchaseFlow}Screen.tsx`, `screens/vehicle/VehicleDetailScreen.tsx`, `screens/buyer/{BuyerOffers,BuyerPurchaseHistory}Screen.tsx`, `lib/{listingsApi,watchlistApi,paymentsApi}.ts`, `store/watchlistStore.ts`

**Result: 32 rows, BUY-001 through BUY-032.**

| Status | Count |
|---|---|
| MISSING | 2 |
| PARTIAL | 9 |
| DIVERGENT | 8 |
| PRESENT | 10 |
| NEEDS_VERIFICATION | 3 |

**The headline correction to expectations.** Mobile browse/search is *not* materially behind
web. `buildParams` sends 31 of the backend's 38 filter params (`SearchScreen.tsx:280-328`),
and the four omitted are two deprecated aliases, one dead param, and `markedForExport`.
Mobile also *beats* web in three places: debounced search (BUY-003), buyer counter-offers on
the canonical path (BUY-024), and focus-based refresh (BUY-026). Prioritise the specific
value-level defects below over any general "port the search screen" effort.

**P0 rows — all three are correctness defects, not missing features.**
- **BUY-022** — mobile's offer floor is an absolute `price - 15000` (`VehicleDetailScreen.tsx:317`)
  where the backend enforces proportional `floor(price * 0.7)` (`offers.service.ts:53-64`) and
  web mirrors it correctly. Diverges in both directions depending on vehicle price.
- **BUY-006** — mobile sends `SEMI_AUTO`, not a member of `TransmissionType`
  (`schema.prisma:49-56`); the DTO lacks a per-item `@IsEnum` so it reaches Prisma unchecked.
  `CVT` is missing from mobile entirely. Outcome unrun — see OQ-12.
- **BUY-017** — mobile's `handleCardPress` opens every search result in the retail detail
  screen regardless of type (`SearchScreen.tsx:223-226`), so auction results from a
  `listingType=AUCTION` search land on the wrong screen.

**Dead code found.** `WatchlistScreen.tsx` is registered (`MainStackNavigator.tsx:321`) but
`grep -rn "navigate('Watchlist'" src/` returns 0 matches — unreachable, duplicating
`SavedScreen` (BUY-021).

**Not traced — stated rather than assumed.**
- `VehicleDetailScreen.tsx` is 3570 lines; only the sections cited in BUY-013 were read.
  BUY-015 (video embeds) and BUY-016 (damage / 3D viewer) are `NEEDS_VERIFICATION` because I
  could not confirm presence *or* absence — they are explicitly **not** recorded as gaps.
- `HorizontalVehicleCard.tsx` read only to L90 of 286, so BUY-017 cannot fully exclude an
  internal redirect — though `handleCardPress` itself has no type branch.
- `PaymentsService` internals: all payments responses are `any` in the controller, so
  Transaction status transitions (BUY-030) are traced only as far as the controller.
- Web's retail-checkout deadness (BUY-029) rests on a grep, not proof — a runtime-built URL
  could evade it.
- `AuctionDetailScreen.tsx` deliberately deferred to Pass 4 (BUY-018).

**Open questions raised: OQ-9 through OQ-12.** OQ-11 (which web detail page is the porting
source of truth) should be answered before any Phase 2 detail-screen work — the legacy route
contains simulated bidding UI that must not be ported.

**Docs-only commit. No source files were modified.**

**Next session should pick up:** Pass 3 — SELL.  _(done — see below)_

### 2026-08-31 — Pass 3: SELL

**Method.** Read web + backend first to establish the contract, then mobile, then diffed.
Every citation recorded in the matrix was re-read directly before being written.

**Scope covered.**
- Web: `src/app/sell/{page,layout}.tsx`, `src/app/dashboard/{seller,dealer}/add-listing/page.tsx`,
  `src/components/listing/{ListingWizard,ImageUpload}.tsx`, `src/components/dealer/DealerQuickList.tsx`,
  `src/app/dashboard/dealer/{inventory,put-on-auction}/page.tsx`,
  `src/app/dashboard/seller/{listings,auctions}/page.tsx`, `src/lib/{listingApi,dvlaApi}.ts`
- Backend: `listings/dto/*` (full `CreateListingDto`), `listings.service.ts` (create, update,
  publish, updateStatus, recordSale, remove, alsoListRetail, alsoAuction, importFromUrl),
  `featured-boost/`, `dvla/`, `damage/`, `payments.service.ts` (tier pricing), `schema.prisma` enums
- Mobile: `screens/sell/{SellCarFlow,MyListingDashboard}Screen.tsx`,
  `screens/seller/{SellerListings,SellerAuctions,SellerDashboard}Screen.tsx`,
  `lib/{sellWizardStore,listingsApi,paymentsApi,storageHelper}.ts`

**Result: 32 rows, SELL-001 through SELL-032.**

| Status | Count |
|---|---|
| MISSING | 1 |
| PARTIAL | 5 |
| DIVERGENT | 8 |
| PRESENT | 18 |

**Headline: mobile's sell flow is the strongest area of the app so far** — 18 PRESENT rows.
It mirrors `ListingWizard` closely: full legal declarations, the complete auction schedule step,
correct badge tiers, DVLA autofill, the 3D damage mapper, and the HPI upsell. It *beats* web in
four places: image compression before upload (SELL-008), auto-triggered DVLA lookup (SELL-007),
a Withdraw action web lacks entirely (SELL-023), and using the correct `recordSale` endpoint so
`soldPrice` is actually captured (SELL-024).

**But there is one P0 money defect (SELL-005 / SELL-006).**
The backend requires ≥10 photos to publish (`listings.service.ts:941-945`). Web enforces that
before payment; mobile enforces only ≥1, then charges the card and *then* calls publish
(`SellCarFlowScreen.tsx:1528-1545`). Worse, the failure `catch` does not `return`
(`SellCarFlowScreen.tsx:1544-1557`) — so after a failed publish the seller sees "Almost there!"
immediately followed by **"Published! / Your listing is now live."**, and `clearDraft()` runs.
Charged, misinformed, draft gone. Mobile's own `SellerListingsScreen.tsx:331-380` already does
this correctly (publish first, pay only if `requiresPayment`), so the fix has a working local
precedent. Options are in OQ-14 — I want your call before touching a payment path.

**Two standing ambiguities resolved by this pass:**
- **Canonical auction duration: 24 hours, hardcoded** — `endTime = startTime + 24h`
  (`listings.service.ts:1229`), display-only on both clients.
- **DVLA endpoint auth: none** — `POST /dvla/lookup` has no `@UseGuards`
  (`backend/src/dvla/dvla.controller.ts:30`); it is a public endpoint.

**Structural finding — web has two create implementations.** `/sell` and the seller dashboard
render `ListingWizard` (3200 lines); `/dashboard/dealer/add-listing` renders `DealerQuickList`
(969 lines) which has no legal declarations, a 1-photo minimum, a hard DVLA gate, and an auction
option that collects no auction fields and never calls `POST /auctions`. Mobile mirrors
`ListingWizard`. OQ-13 asks you to confirm that is the porting source.

**Not traced — stated rather than assumed.**
- `SellerAuctionsScreen.tsx` (2426 lines) was grep-sampled for endpoints only; its handover-proof
  upload, digest/tags and results modal were **not** read. Deferred to Pass 4.
- `SellerDashboardScreen.tsx` (1141 lines) grep-sampled for navigation/API calls only.
- `POST /auctions` (used by both clients' create-auction forms) is in `auctions.service.ts`,
  which was **not** read — so I cannot confirm its validation mirrors `alsoAuction`'s. Pass 4.
- Web's dealer inventory Publish never visibly calls `POST /listings/:id/publish`; whether the
  publish gates run inside the checkout-session handler was not traced.
- Whether the backend accepts `DealerQuickList`'s auction-typed listing with no auction record
  was not verified (OQ-13).
- `IN_PREP` appears in web's `STATUS_COLORS` (`inventory/page.tsx:52`) but is not in the
  `ListingStatus` enum — probably stale, not resolved.

**Open questions raised: OQ-13 through OQ-16** (16 open in total). OQ-14 is the one that needs an
answer before any Phase 2 work on this flow.

**Docs-only commit. No source files were modified.**

**Next session should pick up:** Pass 4 — AUCTION.
