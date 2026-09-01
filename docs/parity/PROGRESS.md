# CarMazium Parity — Progress Log

Append-only session log. Read this first at the start of every session.

## Phase 1 — Audit (branch `parity/audit`, docs-only, no source changes)

| Pass | Session date | Status | Rows written |
|---|---|---|---|
| AUTH | 2026-08-31 | Audited | 36 (AUTH-001..036) |
| BUY | 2026-08-31 | Audited | 32 (BUY-001..032) |
| SELL | 2026-08-31 | Audited | 32 (SELL-001..032) |
| AUCTION | 2026-09-01 | Audited | 39 (AUC-001..039) |
| DASH | 2026-09-01 | Audited | 47 (DASH-001..047) |
| CROSS | 2026-09-01 | Audited | 24 (CROSS-001..024) |

## Phase 2 — Implementation (branch `parity/<flow-name>`, one flow per session)

| Flow | Matrix rows | Session date | Status |
|---|---|---|---|
| 0 — baseline | — | 2026-09-01 | Done — tsc 22 / lint 25 recorded |
| 1 — listing publish payment | SELL-005, SELL-006 (+SELL-033 logged) | 2026-09-01 | NEEDS_VERIFICATION |
| 2a — auction correctness | AUC-029, AUC-030, AUC-012, AUC-022, AUC-004/017 | 2026-09-01 | NEEDS_VERIFICATION |
| 2b — auction truthfulness | AUC-016, AUC-038, AUC-025, BUY-028/OQ-9 | 2026-09-01 | NEEDS_VERIFICATION |
| 3 — search & offer contract | BUY-022, BUY-006, BUY-017, BUY-007, BUY-008 | 2026-09-01 | NEEDS_VERIFICATION (incl. backend change) |
| 7 — dashboard error states | CROSS-023, DASH-047 (+CROSS-025 logged) | 2026-09-01 | NEEDS_VERIFICATION |
| 4a — signup role & onboarding flags | AUTH-005, AUTH-001 | 2026-09-01 | NEEDS_VERIFICATION |
| 4b — session lifecycle | AUTH-013, AUTH-014, AUTH-034, AUTH-035 | 2026-09-01 | NEEDS_VERIFICATION |
| 6 — deep linking & offline | AUTH-020, AUTH-019, AUTH-030, CROSS-015/017 | 2026-09-01 | NEEDS_VERIFICATION (needs prebuild) |
| 5 — account deletion | AUTH-033, DASH-030 | 2026-09-01 | NEEDS_VERIFICATION |
| 8 — chat presence & support | DASH-023, DASH-024 | 2026-09-01 | NEEDS_VERIFICATION |

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

**Next session should pick up:** Pass 4 — AUCTION.  _(done — see below)_

### 2026-09-01 — Pass 4: AUCTION

**Method.** Backend contract first, then web UI, then mobile buyer-side and seller-side (split
because mobile's auction surface is ~7,900 lines). Every citation recorded in the matrix was
re-read directly before being written.

**Scope covered.**
- Backend: `auctions/{auctions.controller,auctions.service,auction.gateway}.ts` + dto,
  `bids/{bids.controller,bids.service}.ts` + dto, `tasks/` lifecycle + unpaid-fee crons,
  `schema.prisma` (`Auction`, `Bid`, `AuctionStatus`, `Sale`)
- Web: `src/app/auctions/live/[id]/page.tsx`, `auctions/won/[id]/page.tsx`, `auctions/page.tsx`,
  `src/app/dashboard/seller/auctions/page.tsx`, `src/lib/auctionApi.ts`,
  `src/components/features/CountdownTimer.tsx`, `src/components/auctions/AuctionResultsModal.tsx`
- Mobile: `screens/vehicle/AuctionDetailScreen.tsx`, `screens/main/{Live,AuctionComplete}Screen.tsx`,
  `screens/buyer/BuyerBidsScreen.tsx`, `screens/seller/SellerAuctionsScreen.tsx` (read in full this
  time — Pass 3 had only grep-sampled it), `lib/auctionApi.ts`

**Result: 39 rows, AUC-001 through AUC-039.**

| Status | Count |
|---|---|
| MISSING | 3 |
| PARTIAL | 6 |
| DIVERGENT | 9 |
| PRESENT | 21 |

**Headline: real-time bidding is at genuine parity.** Both clients connect to the same
`/auctions` socket namespace, handle all six server events, emit only `auction:join`, place bids
over REST, and apply anti-snipe `newEndTime` identically. Mobile is *ahead* on five counts:
min-increment pre-validation (AUC-010), gating the bid console on KYC verification and not just
role (AUC-011), status tabs on the seller list (AUC-026), 70% starting-bid pre-validation
(AUC-032), and a webhook-confirmation poll after fee payment that web lacks (AUC-021).

**One P0 (AUC-029) — mobile carries a bug web already fixed.**
An auction ending below reserve reverts its listing to DRAFT so it can be re-auctioned
(`auctions.service.ts:845-872`). Web's eligibility filter explicitly admits that DRAFT when an
ENDED auction exists for the listing (`dashboard/seller/auctions/page.tsx:212-218`) — and its code
comment states that without it "re-auctioning was silently impossible for every seller". Mobile
still uses the pre-fix `status === 'ACTIVE'` filter (`SellerAuctionsScreen.tsx:631`), so the
reverted listing never matches `presetListingId` and never appears in the picker. The mobile
"Re-auction" button fails for the exact case it exists to serve. The fix is known and documented
in web's comment.

**Three P1s.** AUC-012 — mobile renders competing bidders' full names where web shows initials
only, and is internally inconsistent since socket-delivered bids carry only initials (OQ-18).
AUC-022 — mobile shows a 24h payment deadline from two different computations while the backend
grace period is 72h (OQ-20). AUC-025 — mobile has no Stripe Connect payout warning, so a seller
can complete a handover with no payout destination configured.

**Ambiguity resolved:** canonical auction duration is **24 hours** (`auctions.service.ts:19`),
anti-snipe **3 minutes, repeating, uncapped** (`:20,751-769`), buyer-fee grace **72 hours**
(`:23`). Note `create-auction.dto.ts:10` and `auctions.controller.ts:99` both still say
"startTime + 5 hours" — stale docs, logged as AUC-039.

**Two web-side defects logged so mobile does not copy them:** AUC-008, where
`isAntiSnipeActive()` uses a 10-minute window (`src/lib/auctionApi.ts:268-272`) driving the browse
page's SNIPE badge while the real rule is 3 minutes; and web's missing min-increment and 70%
client validations (AUC-010, AUC-032).

**Not traced — stated rather than assumed.**
- The £125 buyer-fee and £100 seller-bonus *release* endpoints are not in the auctions or bids
  modules; `buyerFeePaid` and `sellerBonusReleased` are read but never written there. They live in
  the payments module and/or an admin module, neither of which was read.
- `adminAssignWinner` (`auctions.service.ts:581-608`) is not wired to any route in
  `auctions.controller.ts`; its caller was not read.
- Whether the backend rejects a duplicate also-list-retail call (AUC-035) was not verified.
- OQ-19 (reserve on the wire) is a reading of `findOne`, not a request I executed.

**Open questions raised: OQ-17 through OQ-20** (20 open in total).

**Docs-only commit. No source files were modified.**

**Next session should pick up:** Pass 5 — DASHBOARDS.  _(done — see below)_

### 2026-09-01 — Pass 5: DASHBOARDS (including Dealer, per request)

**Method.** Backend contracts first, then web buyer/seller, web dealer, mobile buyer/seller, and
mobile dealer — five parallel reads, since the surface is roughly 20k lines. Every citation
recorded in the matrix was re-read directly before being written.

**Scope covered.**
- Backend: `dashboard/`, `notifications/` (+ gateway), `chat/` (+ gateway), `sellers/`, `dealers/`
  controllers and DTOs; `schema.prisma` (`Notification`, `ChatRoom`, `Message`, `DealerProfile`,
  `DealerStaff`, `DealerRole`, `SellerProfile`, `SellerReview`, `Lead`, `LeadStatus`)
- Web: `dashboard/{layout,page}.tsx`, `dashboard/user/page.tsx`, `dashboard/buyer/**`,
  `dashboard/seller/{page,earnings,performance,offers,settings}`, all 13 `dashboard/dealer/**`
  pages incl. `layout.tsx`, `DashboardSidebar.tsx`, `ProfileCompletionGate.tsx`,
  `config/dealerRouteConfig.ts`
- Mobile: `UnifiedDashboardScreen`, `Buyer{Dashboard,PurchaseHistory}Screen`,
  `Seller{Dashboard,Performance,Offers,Profile}Screen`, `EarningsScreen`,
  `Notifications{,Settings}Screen`, `MessagesScreen`, `SettingsScreen`, `PaymentHistoryScreen`,
  `ChatContext`, `notificationsApi`, all 11 `Dealer*Screen`s, `DealerGate`, `GlobalDrawer`

**Result: 47 rows, DASH-001 through DASH-047.**

| Status | Count |
|---|---|
| MISSING | 6 |
| PARTIAL | 8 |
| DIVERGENT | 8 |
| PRESENT | 25 |

**The finding that reframes this pass: web has two dashboards, and users reach only one.**
`/dashboard` sends buyers and sellers to `/dashboard/user`, a tab-driven page, and the sidebar
links nowhere else except `/dashboard/seller/auctions`. But nine fully-built standalone pages
still exist unlinked — and several are **better** than the live tabs (period toggle, auction
bonuses in earnings, delivery requests inside offers, cancel-and-relist, purchase history).
Crucially, **mobile has implemented four features that exist only on those orphaned pages**, so
mobile currently matches the unreachable web app in those places. OQ-21 asks which is canonical;
it decides whether four mobile rows read as "ahead", "correct", or "built against dead code".

**Mobile is strong here — 25 PRESENT — and ahead of web in six places:** the 7d/30d period
toggle on the live path (DASH-005), working notification preferences the backend actually honours
while web's toggles save nothing (DASH-021, OQ-24), the fullest use of `RecordSaleDto` anywhere
(DASH-015), trader address verification with no web UI at all (DASH-031), dealer payouts and bank
details which the web dealer dashboard entirely lacks (DASH-042), and an honest read-only finance
screen instead of web's dead Approve/Reject buttons referencing non-existent statuses (DASH-043).

**Six MISSING rows.** DASH-030 account deletion (re-confirms AUTH-033 — grep across mobile `src/`
returns zero matches; app-store relevant). DASH-003 profile completion gate. DASH-023 chat
presence — the gateway broadcasts `presence:snapshot` and `presence:update` and web consumes both,
mobile handles neither. DASH-024 contact support — `POST /chat/support` exists and web has a
sidebar button; grep for `chat/support` in mobile returns zero. DASH-010 auction bonuses in
earnings. DASH-046 partner/admin dashboards (duplicate of AUTH-029, blocked on OQ-5).

**Dealer dashboard specifically** (added at your request) is at close parity. The open question
from the mapping is answered: **`DealerLeadsScreen` *is* mobile's CRM** — its own comment says the
board mirrors web's CRM stage set, same six stages and endpoints, tap-based rather than
drag-and-drop, plus a List view web lacks (DASH-037). Gaps are narrower than expected: analytics
is missing four breakdowns and CSV export (DASH-036), and the home KPI tiles differ (DASH-035).

**Web-side defects logged so they are not ported:** the dealer earnings "Financial Report" button
has no `onClick` (DASH-044); web's `denied` handover stage is unreachable because `stageFor()`
never returns it (DASH-045); web's notification toggles save nothing (DASH-021).

**Not traced — stated rather than assumed.**
- `dealers.service.ts` bodies for `getStats`/`getAnalytics`/`getLeads`/`inviteStaff` were not read
  in full, so exact response field names for `/dealers/stats` and `/dealers/analytics` are
  unverified, and OQ-23's "roles are not enforced" is scoped to what I read.
- `sellers.service.ts` was not read at all.
- Web components `KycOverlayForm`, `ReceiptsTab`, `MetricCard`, `PeriodToggle`,
  `DeleteAccountSection` were referenced but not opened.
- Mobile `ChatScreen.tsx` and `chatApi.ts` were not read, so typing-indicator rendering and the
  exact `/chat/rooms` client contract are unconfirmed.
- `Notification.type` is a plain `String`, not an enum (`schema.prisma:1072`) — the full set of
  type values in use was not enumerated; it would need a grep of every `notificationsService.create`
  call site across all modules.

**Open questions raised: OQ-21 through OQ-24** (24 open in total). OQ-21 should be answered before
any Phase 2 dashboard work.

**Docs-only commit. No source files were modified.**

**Next session should pick up:** Pass 6 — CROSS-CUTTING.  _(done — Phase 1 complete)_
(silent error handling swallowing failures into zero-value dashboards) was observed across every
screen in this pass and should be folded into that sweep.

### 2026-09-01 — Pass 6: CROSS-CUTTING (final audit pass)

**Method.** A survey sweep rather than deep feature reads: shared primitives read in full, then
grep-based pattern counts across all screens/pages, plus a three-way token comparison against the
design system. Counts below are exact grep hits unless marked as estimates. Every load-bearing
claim was re-verified directly before being written.

**Scope covered.**
- Mobile: `components/{GlobalToastProvider,Toast}.tsx`, `components/ui/*`, `lib/apiClient.ts`,
  `constants/{colors,spacing,typography}.ts`, plus pattern surveys across all 60 screens
- Web: `lib/{apiClient,fetchWithRetry}.ts`, `app/{error,global-error,template,layout}.tsx`,
  plus pattern surveys across 98 pages
- Design system: `CarMazium Design System/{README,SKILL,colors_and_type.css}` + `ui_kits/`,
  `THEME_MIGRATION_TODO.md`, web `globals.css`

**Result: 24 rows, CROSS-001 through CROSS-024.**

| Status | Count |
|---|---|
| MISSING | 1 |
| PARTIAL | 5 |
| DIVERGENT | 4 |
| PRESENT | 12 |
| NEEDS_VERIFICATION | 2 |

**Headline: mobile's design-token discipline is the best part of the codebase, and on brand colour
mobile is right where web is wrong.** The design system's `SKILL.md:47` sets a hard rule that the
primary red is `#FF0037`, "not the old `#ED1C24`". Mobile uses `#FF0037` (`colors.ts:39`); web
still uses `#ed1c24` (`globals.css:6`). Same story for the secondary brand colour. Mobile also has
**zero** hardcoded hex in `src/screens/` and **zero** inline `fontSize`/`fontFamily` literals —
web has no shared skeleton or empty-state component at all, and reaches for native
`alert()`/`confirm()` at 74 call sites across 23 files. Several rows here are web defects recorded
specifically so nobody "fixes" mobile toward web (CROSS-001, CROSS-002, CROSS-008, CROSS-010).

**Where mobile genuinely needs work:**
- **CROSS-023 (P2, highest-value fix)** — dashboards `catch { /* show zeros */ }`, so a failed
  request is indistinguishable from real zero data. A dealer whose analytics call fails sees a
  dashboard reporting zero sales and zero revenue with no error shown. The shared `ErrorBanner`
  already exists in 18 screens, so this is mechanical.
- **CROSS-018 (P1)** — only `SearchScreen` paginates. Seven other lists fetch a fixed page-1 limit
  (20-100) and stop silently; a dealer with 60 leads loses 10 with no indication. Web has the same
  problem on 10 pages, so it is not a mobile regression.
- **CROSS-015 (P1)** — no offline detection on either app, but it bites mobile harder: no
  reachability branch in `apiClient`, a shorter 10s timeout than web's 30s, and no retry wrapper
  where web at least hardened its auth cold-start path with `fetchWithRetry`.
- **CROSS-009 (P2)** — `Alert.alert` at 173 call sites vs `ErrorBanner` in 18 screens, with 13
  screens using both and no rule distinguishing them.

**A Pass 5 row was corrected.** CROSS-021 found `BuyerDashboardScreen.tsx` (624 lines) is
unreachable dead code — zero `navigate()` call sites, absent from the drawer's 33 `stackScreen`
targets. It holds the richer buyer tile set and a period toggle that the live
`UnifiedDashboardScreen` lacks. **DASH-004 has been amended** to say so. Note the subtlety that
made this worth double-checking: `UnifiedDashboardScreen`'s stack route is *also* never navigated
to, yet its component is live because `TabNavigator.tsx:29` renders it directly — route-deadness
and screen-deadness are different things, and a naive grep would have called both dead.

**Also corrected during this pass:** the mobile agent reported `Earnings` as possibly unreachable.
It is not — `GlobalDrawer.tsx` navigates via `navigation.navigate('Main', { screen: item.stackScreen })`
(`GlobalDrawer.tsx:349`), a variable, so `navigate('Earnings')` greps miss it. All 33 drawer
`stackScreen` values are reachable. Any future dead-screen check must account for that indirection.

**Not traced — stated rather than assumed.**
- CROSS-011: I did not grep mobile for a root React error boundary — marked NEEDS_VERIFICATION
  rather than recorded as a gap.
- CROSS-024: mobile `accessibilityLabel` coverage was not audited at all; the web `aria-label`
  ratio is a rough signal that overstates the issue since visible text also satisfies an
  accessible name. Recorded as a known-unaudited area.
- Empty-state adoption on mobile is a component-import count (26 screens), not a per-screen
  confirmation that every list has one.
- The design system's `ui_kits/carmazium-mobile/` has no manifest file, so mobile's documented
  claim that its deeper ground colour `#0A0D14` "comes from the design system's mobile kit"
  (`colors.ts:24-27`) could not be verified against that kit's source.
- Haptics adoption (15 of 60 screens) was counted by import, not by auditing every primary action.

**Open questions raised: OQ-25 through OQ-29** (29 open in total).

**Docs-only commit. No source files were modified.**

## Phase 1 complete

All six audit passes are done: **210 rows** across AUTH (36), BUY (32), SELL (32), AUCTION (39),
DASH (47) and CROSS (24), with 29 open questions. No source file has been modified in Phase 1.

**Next session:** Phase 2 Flow 1 — Listing publish payment path (SELL-005, SELL-006). All 29 open questions answered 2026-09-01; see the Decisions Log in OPEN-QUESTIONS.md and the prioritised plan below.
session on `parity/<flow-name>`, starting only once rows are confirmed and prioritised.

---

## Phase 2 plan — prioritised 2026-09-01

All 29 open questions are answered (see the Decisions Log in `OPEN-QUESTIONS.md`). Six rows are
now **out of scope**: AUTH-027, AUTH-029, AUTH-031, BUY-029, DASH-046 (partner/admin roles,
dead partners portal, off-platform retail checkout).

**Nothing below has been built yet. Phase 1 was docs-only — no mobile source file has been
modified. An APK built from this commit contains the app exactly as it was before the audit.**

Phase 2 rule stands: **one flow per session**, on `parity/<flow-name>`, and I restate the row IDs
in scope and get confirmation before writing code.

### Suggested order

**Flow 1 — Listing publish payment path (P0, money).**
Rows: SELL-005, SELL-006. Enforce ≥10 photos at the mobile Media step, fix the missing `return`
in the failure `catch` (which currently shows a false "Published!" after a failed publish), then
restructure create to publish-first-pay-second as `SellerListingsScreen` already does. Highest
priority because sellers are being charged for listings that do not publish.

**Flow 2 — Auction correctness (P0/P1).**
Rows: AUC-029 (re-auction filter admits the reverted DRAFT — the fix is already written down in
web's own code comment), AUC-012 (initials only), AUC-022 (72h deadline, real value passed from
both entry points), AUC-017 (refetch on socket reconnect).

**Flow 3 — Search and offer contract fixes (P0/P1).**
Rows: BUY-022 (replace the absolute `price - 15000` offer floor with the backend's proportional
70%), BUY-006 (`SEMI_AUTO` → `SEMI_AUTOMATIC`, add `CVT`), BUY-017 (route AUCTION search results
to `LiveAuctionDetailed`), BUY-007/BUY-008 (make list, condition values).

**Flow 4 — Session and auth (P0).**
Rows: AUTH-005 (signup role picker, BUYER + DEALER only), AUTH-013 (global `onAuthStateChange`),
AUTH-014 + OQ-6 (store-level `forceLogout()` on `AUTH_REDIRECT`), AUTH-034 (preserve destination
through re-login), AUTH-035 (cold-start gate), AUTH-003/OQ-3 (separate the onboarding flags).

**Flow 5 — Deep linking (P0, structural).**
Rows: AUTH-020, AUTH-019, AUTH-030, AUTH-003. Add a React Navigation `linking` config. This is
the root cause behind the invite paste-the-link workaround and the untraceable OAuth return leg;
several other rows unblock once it exists.

**Flow 6 — Dashboard error states (P2, one dedicated pass — OQ-26).**
Rows: CROSS-023, DASH-047. Replace `catch { /* show zeros */ }` with the existing shared
`ErrorBanner` plus retry across the dashboard screens, so a failed request stops looking like
genuine zero data.

**Flow 7 — Account and settings gaps (P1).**
Rows: AUTH-033 / DASH-030 (account deletion — app-store relevant), DASH-023 (chat presence),
DASH-024 (contact support), DASH-003 (profile completion gate).

**Flow 8 — Dashboard feature merge (P2, depends on the OQ-21 web merge).**
Rows: DASH-004 + OQ-29 (wire up `BuyerDashboardScreen`, delete `WatchlistScreen`), DASH-010
(auction bonuses in earnings), DASH-005/012 (period toggle, performance metric set).

**Flow 9 — Offline and resilience (P1 — OQ-28).**
Rows: CROSS-015, CROSS-017. NetInfo, offline banner, `OFFLINE` sentinel in `apiClient`. No request
queueing or cached reads without a separate discussion.

**Flow 10 — Pagination (P1 — OQ-27).**
Row: CROSS-018, scoped to dealer inventory, dealer leads and seller listings only. Compare and
dashboard previews stay deliberately capped.

**Small fixes to fold into whichever flow touches that file:**
AUC-016 (the "Adjust Reserve Price" stub that alerts success but makes no API call), AUC-038
(the "Handover confirmed" header contradicting the journey list below it), OQ-9 (remove the £95
`buyerFee` default), AUC-025 (Stripe Connect payout warning), DASH-019/OQ-22 (live notification
list).

### Logged for the web app / backend — not mobile parity work

- Web renders the superseded brand red `#ed1c24`; canonical is `#FF0037` (OQ-25, CROSS-001/002).
- Web's notification preference toggles save nothing (OQ-24, DASH-021).
- Web's password reset enforces 6 characters; canonical is 8 (OQ-2, AUTH-008).
- Web's signup has no terms-acceptance gate; mobile's is correct and stays (OQ-4, AUTH-007).
- `POST /damage/:listingId/save` has no ownership check (OQ-15).
- `reservePrice` is returned to every client by `AuctionsService.findOne` (OQ-19).
- `DealerQuickList` omits all legal declarations and has a broken auction path (OQ-13).
- `/auth/partners` is broken and orphaned; `api-server/` is a stale deployment path (OQ-7, OQ-8).
- Dormant retail-checkout code in both apps should be removed (OQ-10).
- Backend should validate the legal declarations it currently accepts as optional (OQ-16).

---

## Phase 2 — Flow 0: Baseline (2026-09-01)

`docs/parity/IMPLEMENTATION-PLAN.md` written and committed (`d0f25149`). Four planning
decisions recorded there as P-1..P-4: branch base is `main`; the near-term APK is side-loaded
so account deletion (Flow 5) moves to last; offline (CROSS-015/017) folds into Flow 6's
prebuild cycle; the dead "Adjust Reserve Price" button is removed, not wired.

Flow order: **0 → 1 → 2a → 2b → 3 → 4 → 6 → 7 → 5.**

**Verification is always a hand-off.** This machine has no Android SDK — `adb` not found,
`ANDROID_HOME` and `ANDROID_SDK_ROOT` both unset, no `%LOCALAPPDATA%\Android\Sdk`. Every flow
ends with a manual test script for the owner to run on the build machine.

### Quality-gate baseline — no source files modified

Run from `carmazium app/carmazium app/`.

`npx tsc --noEmit` — **exit 2, 22 errors, all in one file:**

```
src/components/__tests__/VehicleCard.test.tsx — 22 errors
  TS2708 Cannot use namespace 'jest' as a value  (x9)
  TS2582 Cannot find name 'describe' / 'it'      (x6)
  TS2304 Cannot find name 'beforeEach' / 'expect' (x7)
```

Cause: `@types/jest` is not installed, so the test file's globals are untyped. **Zero errors in
`src/screens/`, `src/components/` (non-test), `src/lib/`, `src/store/` or `src/navigation/`.**
Every future flow should reproduce exactly these 22 and nothing else; any additional error is
that flow's own.

`npm run lint` — **exit 1, 25 problems (12 errors, 13 warnings), all pre-existing:**

```
errors (12), all no-restricted-syntax token violations:
  src/constants/spacing.ts:48,55,63,72          raw hex (inside Elevation shadow colours)
  src/components/GradeChip.tsx:9-13             raw hex (x5 — the 5 grade colours, matches CROSS-004)
  src/components/AuctionCardBadges.tsx:102      rgba literal with an existing Colors.*Alpha* token
  src/screens/main/DealerFinanceScreen.tsx:72   rgba literal with an existing token
  src/screens/vehicle/VehicleDetailScreen.tsx:3094  rgba literal with an existing token

warnings (13): unused eslint-disable directives for react-hooks/exhaustive-deps across
  DealerInventoryScreen, DealerOnboardingScreen, SearchScreen (x4), SellerAuctionsScreen,
  SellerDashboardScreen and others.
```

Two notes for later flows. The lint baseline is not clean, so "lint passes" is never the bar —
the bar is *these 25 and no more*. And three of the offending files are ones Phase A opens:
`VehicleDetailScreen` (Flow 3), `SellerAuctionsScreen` (Flow 2a), `SearchScreen` (Flow 3). Per
`CLAUDE.md`'s migrate-when-you-touch rule these are fair to clean up in the flow that opens
them, which would shrink the baseline — say so explicitly when it happens rather than letting
the numbers drift silently.

**Next session:** Flow 1 — `parity/listing-publish-payment` (SELL-005, SELL-006).

---

## Phase 2 — Flow 1: Listing publish payment path (2026-09-01)

Branch `parity/listing-publish-payment`, cut from `main` (P-1).
Rows: **SELL-005, SELL-006** → both `NEEDS_VERIFICATION`. One new row logged: **SELL-033**.

**Scope confirmed by the repo owner before any code was written**, including two extensions
beyond the two rows: the auction branch's silent publish failure, and a blocking photo counter
on the Media step rather than a bare inline message.

### What was wrong (all re-read in this session, not taken from the matrix)

1. `handlePublish` gated at `allImages.length === 0` while the backend requires 10
   (`listings.service.ts:940-945`). A seller with 1-9 photos reached the Stripe sheet.
2. Order was create → pay → publish. The publish `catch` had **no `return`**, so a failed
   publish fell through to `clearDraft()` and a second alert reading
   "Published! / Your listing is now live."
3. **Found in-session, beyond the matrix:** `publishListing` never returns `activated: true`
   for a DRAFT — every success path sets `PENDING_REVIEW`
   (`listings.service.ts:987-991,1030-1036`). So "Your listing is now live" was false *even
   when nothing failed*. The auction branch had already been corrected for exactly this
   (there is a comment at `SellCarFlowScreen.tsx:1533-1536` saying so); the classified branch
   was left behind.
4. **Also found in-session:** the backend's 10-photo guard runs *before* the
   `badgeTier === 'FREE'` branch (`listings.service.ts:940` vs `:967`), so it applies to
   auctions too. The auction branch swallowed publish failure (`catch {}` — "Non-fatal") and
   then announced "Auction Scheduled!" for an auction that was never submitted for review.

### What changed — `src/screens/sell/SellCarFlowScreen.tsx` only

- `MIN_PHOTOS = 10` (`:64-72`) and a `PublishResult` type mirroring the endpoint (`:74-79`).
- `step2HasErrors()` (`:943-946`) disables Next on the Media step below the minimum, using the
  same shape as the existing `step1HasErrors` / `step3HasErrors` and wired into the same
  footer condition (`:3121,3124`).
- Photo tracker reads `N / 10 MINIMUM` in warning colour while short, and the coaching hint is
  replaced by "Add N more photos to continue" (`:2266-2296`). Two new style entries; no raw
  hex, no inline font sizes.
- `validateStep(2)` blocks as a second path (`:1204-1214`) for draft-resume and hardware-back
  entries that do not go through the footer button.
- `handlePublish`'s own gate moved `=== 0` → `< MIN_PHOTOS` (`:1375-1383`).
- Classified branch restructured to publish-first / pay-only-on `requiresPayment`
  (`:1575-1653`), copied from `SellerListingsScreen.tsx:331-380`. Every failure path returns
  and states the money position explicitly — "You have not been charged" before payment,
  "Your payment went through… you will not be charged twice" after it.
- Success copy is now "Submitted for review", matching what the backend actually did.
- Auction branch surfaces publish failure instead of swallowing it (`:1540-1559`).

**No other file was modified.** No backend change. No new dependency.

### Quality gates

```
$ npx tsc --noEmit
exit=2 — 22 errors, all in src/components/__tests__/VehicleCard.test.tsx (@types/jest)
Errors outside that file: 0.  Identical to the Flow 0 baseline.

$ npx eslint src/screens/sell/SellCarFlowScreen.tsx
exit=0 — clean.

$ npm run lint
exit=1 — 25 problems (12 errors, 13 warnings). Identical to the Flow 0 baseline;
none in the changed file.
```

### Manual test script

Preconditions: a signed-in seller account, a Stripe test card, and a vehicle draft you are
willing to discard. Auctions are FREE tier, classifieds are paid (BASIC £1 / STANDARD £10 /
PREMIUM £25) — steps 4-8 involve a real test charge.

**A — Photo minimum blocks before any charge (SELL-005)**

1. Start a new listing, complete Step 1 Details, tap **NEXT · MEDIA**.
   *Expect:* Media step. Tracker reads `0 / 10 MINIMUM` in amber. Hint reads "Add 10 more
   photos to continue — listings need 10 to publish." **NEXT · PRICING is greyed out and does
   nothing when tapped.**
2. Add 3 photos.
   *Expect:* tracker `3 / 10 MINIMUM`, hint "Add 7 more photos…". Next still disabled.
3. Add 7 more (10 total).
   *Expect:* tracker flips to `10 / 100` in the normal accent colour, hint reverts to the
   "Aim for at least 20 photos…" coaching line, **Next is enabled.**
4. Add one more photo, then delete photos back down to 9.
   *Expect:* the counter and hint return to the blocking state and Next disables again.

**B — Classified: publish succeeds (SELL-006)**

5. With 10+ photos, complete Pricing (pick BASIC £1), reach Review, tap Publish.
   *Expect:* the Stripe payment sheet appears **only after** a brief publish call — and on a
   listing that meets every requirement it appears normally. Pay with the test card.
   *Expect:* exactly **one** alert, titled **"Submitted for review"**, reading "Your listing
   goes live once our team has reviewed it." **It must not say "now live".** Tap View Listings.
6. In My Listings, find the listing.
   *Expect:* status **PENDING_REVIEW**, not ACTIVE. (There is no PENDING_REVIEW tab on mobile
   yet — SELL-022 — so check the ALL tab.)

**C — Classified: payment cancelled**

7. Start another listing with 10+ photos, reach Publish, and **dismiss the Stripe sheet**.
   *Expect:* one alert, "Payment cancelled — Your listing was saved as a draft. Publish it
   from My Listings to complete payment." **No "Published!" alert follows it.** The draft is
   still in My Listings as DRAFT.

**D — Classified: publish fails after payment (the regression this flow exists to prevent)**

8. Hardest to stage; do it if you can. Force the second publish call to fail — e.g. put the
   device in airplane mode in the moment between paying and the app returning.
   *Expect:* one alert titled **"Payment received — listing not submitted"** which states the
   payment went through and that publishing again will not double-charge.
   **Fail the flow if you see "Published!", "now live", or two alerts in a row.**

**E — Auction path**

9. Create an AUCTION listing with **9** photos.
   *Expect:* blocked at the Media step exactly as in A — the minimum is not classified-only.
10. Create an AUCTION listing with 10+ photos and schedule it.
    *Expect:* no payment sheet (auctions are FREE tier), and one alert
    **"Auction Scheduled!"** → View Auctions shows it.
11. If you can force the auction publish call to fail (airplane mode at the moment of
    scheduling): *expect* **"Auction saved, not yet submitted"**, never "Auction Scheduled!".

**F — Regression sweep**

12. Resume a saved draft from the Media step. *Expect:* the counter reflects the restored photo
    count and Next is disabled if under 10. (Note SELL-020: draft resume only restores 12
    fields, so declarations will need re-entering — that is a known separate gap, not this flow.)
13. Android hardware back from the Media step. *Expect:* steps back one, does not exit the flow.

### Not verified in this session

- Nothing was run on a device — this machine has no Android SDK. Every expectation above is
  derived from code read in this session plus the backend contract, not from execution.
- Step D's post-payment failure path is reasoned, not staged; it is the one branch I could not
  exercise even in principle from here.
- `triggerListingFeePayment` internals were not re-read this session; the restructure treats it
  as the unchanged black box it already was.

**Next session:** Flow 2a — `parity/auction-correctness` (AUC-029, AUC-012, AUC-022, AUC-017).

---

## Phase 2 — Flow 2a: Auction correctness (2026-09-01)

Branch `parity/auction-correctness`, cut from `main` (P-1).
Rows: **AUC-029, AUC-012, AUC-022, AUC-004/017** → `NEEDS_VERIFICATION`. **AUC-030** folded in.

> Note on branching: this branch was cut from `main` in parallel with Flow 1, so it conflicted
> with it in this file on merge (the matrix auto-merged — different rows, different lines).
> Settled as **P-5**: each flow merges to `main` once verified, and the next is cut from there.
> Flows 1 and 2a were merged to `main` **unverified**, at the repo owner's explicit direction,
> so that Flow 2b had a single base. Both remain `NEEDS_VERIFICATION`.

### Verified against source this session, not taken from the matrix

- Backend grace is **72h**, and it is measured from **`wonAt`**, not `endTime`
  (`auctions.service.ts:23`, `revertUnpaidWins` `:618-626` filters `wonAt < now - 72h`).
  The matrix said 72h but did not say from what — the distinction decides which client can
  compute the deadline exactly and which can only approximate.
- `wonAt` is set at the moment the auction closes with a winner (`auctions.service.ts:544`),
  which is the same moment the `auction:ended` socket event fires. So the live-win path can
  use `Date.now()` and be exact.
- `GET /bids/my` selects only `id, status, endTime, winnerId, winningBidAmount` from the
  auction (`bids.service.ts:203-211`) — **no `wonAt`**. `BuyerBidsScreen` therefore cannot be
  exact; it approximates off `endTime`. Logged below as a backend item.
- Web renders initials in **both** the avatar and the label (`live/[id]/page.tsx:1360,1362`),
  so mirroring web means the mobile row shows initials in both places too — not a name field
  repointed at initials.
- `PATCH /auctions/:id` accepts updates only while `SCHEDULED` (`auctions.service.ts:434-436`).
  Recorded here because it settles AUC-016 for Flow 2b (P-4).

### Changes

**AUC-029 + AUC-030** — `SellerAuctionsScreen.tsx:626-676`. `openCreateModal` now fetches
`/auctions/my/list` in parallel with `/listings/my` and admits a `DRAFT` listing when an
`ENDED` auction exists against its id, which is what distinguishes a reserve-not-met revert
from an ordinary unfinished draft. Also excludes listings already tied to a SCHEDULED/ACTIVE
auction and any listing carrying a `linkedListingId` (AUC-030 — same filter expression, same
test, so folding it in was cheaper than a second pass over the same function).

**AUC-012** — `name` **removed from `BidEntry`** rather than reassigned (`:50-62`), so the
field that carried the leak no longer exists. Initial-load mapper (`:305-313`), socket mapper
(`:405`) and the row render (`:1403`) all now use `initials` only.

**AUC-022** — shared `AUCTION_PAYMENT_GRACE_MS` in `lib/auctionApi.ts:5-20`. Socket win path
passes `Date.now() + 72h` (exact); `BuyerBidsScreen` passes `endTime + 72h` (approximate, see
above). The 24h mount-time fallback is **deleted**: `timeLeft` became `number | null` and the
countdown block is not rendered when the deadline is unknown, rather than showing an invented
one. Payment stays enabled in that case — refusing a payment on a deadline we do not know
would be worse than showing no timer. Note `timeLeft === 0` in the pay guard is deliberately
an identity check, since `null < 3600` and `!null` both coerce the wrong way.

**AUC-004 / AUC-017** — `AuctionDetailScreen.tsx:396-404`. The `reconnect` handler refetches
alongside re-emitting `auction:join`, which only re-subscribes and replays nothing.
`loadAuction` gained `{ silent: true }` (`:291-297`) so the resync does not blank the live
screen, and is reached via a ref (`:342-350`) so the socket effect keeps its
`[auctionId, currentUser?.id]` deps — `loadAuction` is keyed on the whole `currentUser`
object, and that effect carries a comment recording that object-keying tore the socket down
mid-auction. Also changed the error-state retry from `onPress={loadAuction}` to
`onPress={() => loadAuction()}`, which otherwise passes the press event as the options object.

Five files: `lib/auctionApi.ts`, `screens/vehicle/AuctionDetailScreen.tsx`,
`screens/seller/SellerAuctionsScreen.tsx`, `screens/main/AuctionCompleteScreen.tsx`,
`screens/buyer/BuyerBidsScreen.tsx`. No backend change, no new dependency.

### Quality gates

```
$ npx tsc --noEmit
exit=2 — 22 errors, all in src/components/__tests__/VehicleCard.test.tsx (@types/jest)
Errors outside that file: 0.  Identical to the Flow 0 baseline.

$ npx eslint <the five changed files>
exit=0 — 1 warning, the pre-existing unused eslint-disable in SellerAuctionsScreen
(baseline line 650, now 693 after the edit). No new problems.

$ npm run lint
exit=1 — 25 problems (12 errors, 13 warnings). Identical to the Flow 0 baseline.
```

### Manual test script

Needs two accounts: a **verified dealer** who can bid, and a **seller** with an auction.
Several steps need an auction to actually end, so allow for the 24h duration or use a
short-scheduled auction if you can.

**A — Re-auction a reserve-not-met listing (AUC-029, the P0)**

1. As seller, run an auction to completion with **no bid meeting the reserve** (either no bids
   or all below reserve).
   *Expect:* the auction ends; the listing reverts to DRAFT.
2. Open My Auctions, the ended auction, results modal, then **Re-auction**.
   *Expect:* the create-auction sheet opens with **that listing already selected**. Before this
   change it opened showing "no eligible listings" — that is the exact failure being fixed.
3. Complete the form and schedule.
   *Expect:* a new SCHEDULED auction against the same vehicle.

**B — Eligibility exclusions (AUC-030)**

4. With a listing already in a SCHEDULED auction, open Create Auction from the header.
   *Expect:* that listing is **not** in the picker (previously it was, and the server rejected
   it on submit).
5. Take a listing you have also-listed for retail, open the picker.
   *Expect:* not offered.
6. An ordinary DRAFT that has never been auctioned.
   *Expect:* **not** offered — only reverted drafts come back, not every draft.

**C — Bidder identity (AUC-012)**

7. As dealer A, open a live auction where dealer B has already bid, and scroll the bid history.
   *Expect:* every row shows **initials only** (e.g. "JS") in both the avatar and the label.
   **Fail if any row shows a full name.**
8. Have dealer B place a bid while you watch.
   *Expect:* the new row also shows initials — the list is consistent top to bottom. Previously
   pre-loaded rows showed names and live rows showed initials.

**D — Payment deadline (AUC-022)**

9. Win an auction **while watching the live screen** (socket path).
   *Expect:* AuctionComplete opens with a countdown reading roughly **71:59:xx**, not 24:00:00.
10. Kill and reopen the app, then reach the same win from **My Bids**.
    *Expect:* a countdown still near 72h, counting from the auction's end. It may differ from
    step 9 by seconds-to-minutes — that is the known `wonAt` vs `endTime` approximation, not a
    bug. **Fail if either shows ~24h, or if the number resets to a full 24h on every reopen.**
11. Leave the screen open a minute.
    *Expect:* it ticks down once per second and does not reset.

**E — Reconnect resync (AUC-017)**

12. On a live auction with the connection banner visible, turn airplane mode on for ~30s, then
    off.
    *Expect:* the banner clears and the screen **refreshes to current state** — current bid,
    bid history and timer all correct — **without** the full-screen loader blanking the page.
13. Harder, but the case that matters: have the auction **end** while you are disconnected,
    then reconnect.
    *Expect:* the screen reflects the ended state. Previously it could sit on ACTIVE with a
    frozen 00:00:00 forever.
14. While reconnecting, confirm the socket does not tear down repeatedly (bids keep arriving
    live afterwards) — this is the regression the ref indirection exists to prevent.

**F — Regression sweep**

15. Force the auction load to fail (airplane mode, then open an auction) and tap **Retry**.
    *Expect:* it retries and shows the loader — the retry path is still the loud one.
16. Place a bid, cancel it within 24h, check anti-snipe extension still toasts.

### Not verified in this session

- Nothing run on a device; no Android SDK here. All expectations are derived from code read in
  this session plus the backend contract.
- Steps 12-14 (socket reconnect) are the least verifiable from here — the ref indirection is
  reasoned from the existing comment about mid-auction teardown, not observed.
- `auction.gateway.ts` was not re-read this session; the "replays nothing on rejoin" claim
  rests on the Pass 4 citation (`:65-75`), not a fresh read.
- `AuctionResultsModal`'s mobile equivalent was not read; step A2's "already selected"
  expectation rests on `presetListingId` handling in `openCreateModal`, which I did read.

### Logged for the backend — not mobile parity work

- `GET /bids/my` should select `wonAt` on the auction (`bids.service.ts:203-211`) so the
  payment deadline can be computed exactly on the bids screen instead of approximated from
  `endTime`.

**Next session:** Flow 2b — `parity/auction-truthfulness` (AUC-016, AUC-038, AUC-025, OQ-9).

---

## Phase 2 — Flow 2b: Auction truthfulness (2026-09-01)

Branch `parity/auction-truthfulness`, cut from `main` at `187b88a4` — the first flow cut under
**P-5**, with Flows 1 and 2a already merged in.

Rows: **AUC-016, AUC-038, AUC-025, BUY-028/OQ-9** → `NEEDS_VERIFICATION`.

Four places where the app stated something untrue or defaulted to a wrong number. Grouped
because they are one defect class in three adjacent files, not because they are related
features.

### Changes

**AUC-016 — a button that lied.** The seller panel's RESERVE button opened an "Adjust Reserve
Price" prompt and, on confirm, alerted "Reserve Updated — your reserve price has been
updated." It made no API call at all. **Removed** per P-4 (`AuctionDetailScreen.tsx:1661-1673`).
Wiring it was never an option where it sat: `PATCH /auctions/:id` throws for any auction that
is not `SCHEDULED` (`auctions.service.ts:434-436`, read this session), and that panel renders
only on a live auction. The reserve status bar above it is kept — it reads real state and web
has no equivalent. CLOSE NOW now occupies the action row alone.

**AUC-038 — a header that contradicted the list under it.** The paid state read "PURCHASE
COMPLETE / Handover confirmed" directly above a journey list showing "Handover to be booked"
and "Handover confirmed" as *incomplete*. Now reads **"PAYMENT COMPLETE / Buyer fee paid"**
(`AuctionCompleteScreen.tsx:341-342`) — what has actually happened at that point. The journey
list is untouched; the two now agree. Mobile still has no live handover status card (AUC-020,
Phase D) — this row only stops the screen contradicting itself.

**AUC-025 — a warning that arrived too late, i.e. never.** A seller could complete an auction,
photograph and upload handover proof, get approved, and only then find there was nowhere to
send the £100. `SellerAuctionsScreen` now reads `GET /users/stripe-connect/status` (`:302-311`,
the same call `SettingsScreen.tsx:266-274` already makes) and renders an amber tappable warning
inside the handover block, above the upload button, routing to Settings (`:1013-1026`).

Three states, deliberately, not two: `null` renders **nothing** — a failed status call must not
accuse a seller of missing setup they actually have; `false` warns; `true` is silent. Also
suppressed once `sellerBonusReleased`, since by then the money has demonstrably gone somewhere.

**BUY-028 / OQ-9 — a default that was one forgetful caller from undercharging.** `buyerFee` is
now **required** on `PurchaseFlowParams` (`PurchaseFlowScreen.tsx:45`); the £95 destructuring
default is gone (`:94`). The bare-navigation fallback object uses **0** rather than a
plausible-looking fee (`:88`) — that path has no `listingId` and cannot pay anyway, and a
visible £0 fails obviously where £95 would fail quietly.

The type change produced **no new tsc errors**, which confirms every caller already passes a
fee; grepped to confirm all five pass **125** (`BuyerBidsScreen:383`, `ChatScreen:454`,
`AuctionDetailScreen:451,1033,1617`). So nothing was being mispriced — this closes the hole
rather than fixing an active bug.

Four files: `screens/vehicle/AuctionDetailScreen.tsx`, `screens/main/AuctionCompleteScreen.tsx`,
`screens/seller/SellerAuctionsScreen.tsx`, `screens/main/PurchaseFlowScreen.tsx`. No backend
change, no new dependency. Two new style entries, both tokenised (`Colors.warningAlpha10/30`).

### Quality gates

```
$ npx tsc --noEmit
exit=2 — 22 errors, all in src/components/__tests__/VehicleCard.test.tsx (@types/jest)
Errors outside that file: 0.  Identical to the Flow 0 baseline.

$ npx eslint <the four changed files>
exit=0 — 1 warning, the pre-existing unused eslint-disable in SellerAuctionsScreen
(baseline line 650, now 712). No new problems.

$ npm run lint
exit=1 — 25 problems (12 errors, 13 warnings). Identical to the Flow 0 baseline.
```

Note the merged tree was also gated before Flows 1 and 2a were merged to `main`: same
22 / 25, so the merge itself introduced nothing.

### Manual test script

Needs a seller account with an ENDED auction that has a winner, and — for step 6 — an account
whose Stripe Connect onboarding is **not** complete.

**A — Reserve button removed (AUC-016)**

1. As the seller, open your own **live** auction and scroll to the seller panel.
   *Expect:* the reserve status bar is still there and correct — green "Reserve met — current
   bid £X" once bidding passes the reserve, amber "Reserve not yet met — need £X" before.
2. *Expect:* **no RESERVE button.** CLOSE NOW is the only action button and spans the row.
   **Fail if any control claims to change the reserve.**
3. Tap CLOSE NOW and cancel the confirmation.
   *Expect:* unchanged behaviour — this flow did not touch it.

**B — Completion header (AUC-038)**

4. As a buyer who has won an auction, pay the £125 fee and reach the completed state.
   *Expect:* header reads **"PAYMENT COMPLETE / Buyer fee paid"**. **Fail if it says "Handover
   confirmed"** while the list below shows handover steps outstanding.
5. Check the YOUR JOURNEY list directly beneath.
   *Expect:* "Auction ended" and "Buyer fee paid" ticked; both handover rows still open. Header
   and list agree.

**C — Payout warning (AUC-025)**

6. As a seller **without** completed Stripe Connect onboarding, open My Auctions and find an
   ENDED auction with a winner.
   *Expect:* an amber warning above "Upload Handover Proof" reading "Payout method not set
   up…". Tapping it opens Settings.
7. Complete Stripe Connect onboarding, return, pull to refresh.
   *Expect:* the warning is gone.
8. **The state that matters most:** put the device in airplane mode and open the screen so the
   status call fails.
   *Expect:* **no warning at all.** A seller who *has* set up payouts must never be told they
   have not because a request failed.
9. An auction where the £100 has already been released.
   *Expect:* no warning, and the existing "£100 payout released" pill unchanged.

**D — Buyer fee (OQ-9)**

10. Reach the purchase/payment screen from all the routes that lead there: My Bids, the live
    auction banner, the auction detail buy-fee button, and a chat "pay" action.
    *Expect:* **£125** on every one. **Fail on any £95.**
11. Check the order summary total on each.
    *Expect:* £125 for a commission payment, with no sale price stacked on top.

**E — Regression sweep**

12. Upload handover proof on an ENDED auction. *Expect:* unchanged — uploads, then "Awaiting
    admin approval".
13. Open the auction list tabs (ALL / LIVE / SCHEDULED / ENDED / WON). *Expect:* unchanged.
14. Re-run Flow 2a's step A2 (re-auction picker) to confirm this flow did not disturb it — both
    flows edit `SellerAuctionsScreen`.

### Not verified in this session

- Nothing run on a device; no Android SDK here.
- Step C8 (status call failing) is reasoned from the `null` branch, not observed.
- The exact `GET /users/stripe-connect/status` response shape was confirmed only as far as
  `onboardingComplete` (`users.service.ts:482,514`); the rest of the payload was not read.
- The visual result of CLOSE NOW spanning the action row alone was not rendered — it is a
  `flex: 1` button in a two-child row that now has one child, so it should fill, but that is
  reasoning rather than a screenshot.
- Step D10's chat route (`ChatScreen:454`) was grepped for its `buyerFee` value, not traced
  through to the screen.

**Next session:** Flow 3 — `parity/search-and-offer-contract`
(BUY-022, BUY-006, BUY-017, BUY-007, BUY-008).

---

## Phase 2 — Flow 3: Search and offer contract (2026-09-01)

Branch `parity/search-and-offer-contract`, cut from `main` at `187b88a4`.
Rows: **BUY-022, BUY-006, BUY-017, BUY-007, BUY-008** → `NEEDS_VERIFICATION`.

**This flow contains the first backend change of Phase 2, explicitly approved before it was
made.** Flow 2b is still unmerged on its own branch; it touches no file this flow touches.

### Two findings that changed the work

**BUY-017 was mis-framed, and the fix was not available client-side.** The row implies mobile
diverges from web. It does not: web links *every* search result to `/buy-cars/${listing.slug}`
regardless of listing type (`src/app/search/page.tsx:1191,1231`) — the row's web citation
(`:969-983`) is the listing-type *filter*, not the routing. So web has the same gap.

More importantly mobile *could not* have fixed it alone: `GET /listings` included only the
`seller` relation (`listings.service.ts:503-517`), so a search result carried the `type` scalar
but nothing identifying which auction, and no endpoint resolves an auction by listing id
(`auctions.controller.ts` exposes `GET /auctions/:id` only). The existing linked-auction banner
on the retail screen does not cover this — that is for retail↔auction *pairs*, not
auction-typed listings. Raised as a blocker; the repo owner approved the backend change.

**BUY-007 needed no new data at all.** `src/data/carData.ts` already ships `CAR_MAKES`, 71
entries, which I diffed against web's `src/lib/carData.ts` — byte-identical, nothing missing in
either direction. `SearchScreen` simply never imported it and hardcoded ten makes instead.

### Changes

**Backend (approved) — `backend/src/listings/listings.service.ts:518-525`.** `findAll` now
includes `auction: { select: { id, status, endTime } }`. Scalars only, no bids, so it is one
join and no N+1. Web receives the same field and could make the same routing fix.

**BUY-022 (P0, money-adjacent).** `OFFER_MIN` is now `Math.floor(listing.price * 0.7)`
(`VehicleDetailScreen.tsx:329`) instead of an absolute `price - 15000`, matching
`offers.service.ts:55-64` and web. The old window diverged in both directions: negative floor on
a £10k car (offers submitted, then rejected by the server with a generic alert), £85k floor on a
£100k car (blocking offers the backend would have accepted down to £70k). Prefill moved from
`price - 2500` to 90% of asking (`:193`), matching web — the flat figure could open the modal
already below the floor on a cheap car. The floor hint now names the number and the rule
(`:1890`). Mobile still sends only `amount`; the backend checks `amountMax ?? amount`, so the
check lands on the right value. BUY-023 stays open and out of scope.

**BUY-006.** `TRANSMISSIONS` constant separating enum values from labels
(`SearchScreen.tsx:139-144`): `SEMI_AUTO` → `SEMI_AUTOMATIC`, `CVT` added. Labels are explicit
rather than `t.replace('_',' ')`, which would have rendered "SEMI AUTOMATIC".

**BUY-008.** `CAT_C` and `CAT_D` added (`:119-131`) — all eight of web's values.

**BUY-007.** Type-to-filter field over `CAR_MAKES`, falling back to the ten popular makes when
empty (`:67`, `:193-199`, `:1502-1524`) — the native equivalent of web's input-plus-datalist.
A selected make outside the popular ten is unioned into the default list so an active filter
never disappears. Selection stays single-value: the backend has no `makes[]` param and
`buildParams` only ever sent `selectedMakes[0]`, which the existing comment already recorded.

**BUY-017.** Mapper carries `type` and `auction` through (`listingsApi.ts:308-309`,
`data/listings.ts`) — both were being dropped. `handleCardPress` routes an AUCTION result with a
known auction id to `LiveAuctionDetailed` (`SearchScreen.tsx:264-280`), falling through to
retail detail when the id is absent, since an auction-typed listing whose auction has not been
created yet is a real state and the retail screen renders it acceptably.
`MainStackParamList.LiveAuctionDetailed` now types `auctionId`, which
`AuctionDetailScreen.tsx:261` has always read — every caller previously reached it through an
`as any` cast.

Six files: `backend/src/listings/listings.service.ts`, `screens/main/SearchScreen.tsx`,
`screens/vehicle/VehicleDetailScreen.tsx`, `lib/listingsApi.ts`, `data/listings.ts`,
`navigation/MainStackNavigator.tsx`. No new dependency.

### Quality gates

```
$ npx tsc --noEmit            (mobile)
exit=2 — 22 errors, all in src/components/__tests__/VehicleCard.test.tsx (@types/jest)
Errors outside that file: 0.  Identical to the Flow 0 baseline.

$ npx tsc --noEmit            (backend — first time this flow series has touched it)
exit=2 — 3 errors: payments.controller.ts:62, sellers.service.ts:195,
tasks/db-backup.service.ts:45. Confirmed pre-existing by stashing this change and
re-running against HEAD: same 3. None in listings.service.ts.

$ npm run lint
exit=1 — 24 problems (11 errors, 13 warnings).
**One better than the Flow 0 baseline of 25/12** — see below.
```

**The lint baseline moved, deliberately.** `VehicleDetailScreen.tsx:3108` had a raw
`rgba(239,68,68,0.10)` where `Colors.errorAlpha10` exists. `CLAUDE.md` says to migrate token
call sites in files you touch, and this flow opens that file, so it is fixed. **New baseline for
Flow 4 onward: tsc 22 (mobile) / 3 (backend), lint 24 problems, 11 errors, 13 warnings.**

### Manual test script

**A — Offer floor (BUY-022, the P0)**

1. Open a vehicle priced around **£10,000** and tap Make an Offer.
   *Expect:* the field opens at **£9,000** (90%). The stated range floor is **£7,000**, not a
   negative number. Tapping "−" repeatedly stops at £7,000.
2. Try to submit at the floor. *Expect:* accepted by the server — no "Offer must be at least…"
   alert. Previously the app allowed below-70% offers and the server rejected them.
3. Open a vehicle priced around **£100,000**.
   *Expect:* prefill £90,000, floor **£70,000** — previously £85,000, which blocked legitimate
   offers. Step down to £70,000 and submit. *Expect:* accepted.
4. At the floor, check the hint text. *Expect:* "Minimum offer is £X — 70% of the asking price",
   naming the number.
5. Tap "+" past the asking price. *Expect:* still capped at asking, unchanged from before.

**B — Transmission and condition filters (BUY-006, BUY-008)**

6. Open Refine Search → TRANSMISSION. *Expect:* four chips — Automatic, Manual,
   **Semi-Automatic**, **CVT**. Labels read properly, not "SEMI AUTOMATIC".
7. Select Semi-Automatic, apply. *Expect:* results, or a clean empty state — **no error, no
   500**. Previously this sent an invalid enum value straight through to Prisma.
8. Select CVT, apply. *Expect:* CVT vehicles are now reachable.
9. CONDITION. *Expect:* eight chips including **Cat C** and **Cat D**. Filter on each.

**C — Make filter (BUY-007)**

10. Open Refine Search → MAKE. *Expect:* a search field above the chips, and the familiar ten
    popular makes below it.
11. Type "sko". *Expect:* **Skoda** appears. Select it, apply, confirm results are Skodas.
12. Reopen the filter. *Expect:* Skoda is still visible and still selected, even though it is
    not one of the popular ten — that is the union behaviour.
13. Type nonsense ("zzz"). *Expect:* "No makes match "zzz"", not an empty void.
14. Clear with the ✕. *Expect:* the popular ten return.
15. Select a second make. *Expect:* it replaces the first — single-select, as before.

**D — Auction routing (BUY-017) — needs the backend deployed**

16. **Deploy the backend first.** Without it, `auction` is absent from search results and every
    result opens retail detail — i.e. exactly the old behaviour, silently. Worth confirming that
    fallback is harmless before deploying.
17. Refine Search → Listing Type → **Auction**, apply, tap a result.
    *Expect:* the **live auction screen** with the bidding console, countdown and bid history —
    not the retail detail page.
18. Tap a CLASSIFIED result. *Expect:* retail detail, unchanged.
19. Tap an auction result from **Home** (the rails). *Expect:* unchanged — that path already
    worked and this flow did not touch it.

**E — Regression sweep**

20. Run a normal text search, scroll to trigger pagination. *Expect:* unchanged; the tap handler
    is still id-keyed via the ref, so cards should not re-render on scroll.
21. Apply several filters at once and Reset. *Expect:* everything clears including the make
    search field.

### Not verified in this session

- Nothing run on a device, and **the backend change is not deployed** — step D17 will not pass
  until it is. Everything in D is untested against a live response.
- I did not run a request against `GET /listings` to confirm the new `auction` field serialises
  as expected; the change type-checks and the relation exists (`schema.prisma:697`), but the
  wire shape is inferred, not observed.
- `HorizontalVehicleCard.tsx` was not read this session. Pass 2 noted it was only read to L90
  of 286, so an internal navigation inside the card still cannot be fully excluded — if step
  D17 fails, that is the first place to look.
- Backend deployment, migrations and whether web needs redeploying to pick up the extra field
  were not investigated.
- Step A2/A3 expectations about server acceptance are read from `offers.service.ts`, not from a
  request I made.

### Logged for the web app — not mobile parity work

- Web now receives `auction` on `GET /listings` too, and could route auction search results to
  `/auctions/live/[id]` instead of `/buy-cars/[slug]`. Same defect, same one-line data source.

**Next session:** Flow 4 — `parity/session-and-auth` (AUTH-005, AUTH-013, AUTH-014, AUTH-034,
AUTH-035, AUTH-003). Largest flow in the plan; split into 4a/4b if it does not fit.

---

## Phase 2 — Flow 7: Dashboard error states (2026-09-01)

Branch `parity/dashboard-error-states`, cut from `main` at `187b88a4`. Independent of the
stack above it (2b → 3, and 4a → 4b → 6) — it touches only dashboard screens, none of which
those flows opened, so it merges in any order.

Rows: **CROSS-023, DASH-047** → `NEEDS_VERIFICATION`. One new row logged: **CROSS-025**.

One dedicated pass, per OQ-26, rather than folding this into each feature flow.

### The defect had three shapes, not one

The matrix describes `catch { /* show zeros */ }`. That is the *least* common form. Reading all
seven dashboards turned up three:

1. **The plain silent catch** — `UnifiedDashboardScreen:117`, `SellerPerformanceScreen:119`.
   `SellerPerformanceScreen`'s comment even claimed "EmptyState covers missing data", which is a
   different and wrong claim: an empty state says *you have no performance data*, not *we could
   not load it*.
2. **`Promise.allSettled` with unchecked results** — `SellerDashboardScreen`, `EarningsScreen`,
   `DealerEarningsScreen`. Here the `catch` almost never fires, because `allSettled` does not
   reject. A failed slice simply left its numbers at zero. This is the sneakiest of the three:
   the error handling *looks* present and does nothing.
3. **The bare `.catch(() => {})`** — `DealerAnalyticsScreen:244`. The worst instance in the app,
   and the exact scenario the audit called out: a dealer whose analytics call fails sees zero
   sales, zero leads and zero revenue, presented with total confidence.

### What changed

Seven screens, each now distinguishing **three** states rather than two — loading,
loaded-and-genuinely-zero, and failed — via the existing shared `ErrorBanner` with a working
retry. No new component; this is adoption, not invention.

- `UnifiedDashboardScreen` — fetch extracted to a `useCallback` so retry re-runs it.
- `SellerDashboardScreen` — counts rejected settlements and distinguishes **total** failure
  ("Could not load your dashboard") from **partial** ("Some of your dashboard could not be
  loaded"). Partial matters: the numbers on screen are real but incomplete, which is precisely
  what a silent zero hides.
- `EarningsScreen`, `DealerEarningsScreen` — handle the non-fulfilled branch of `allSettled`.
- `SellerPerformanceScreen` — replaces the misleading "EmptyState covers it" comment.
- `DealerAnalyticsScreen` — the bare catch now sets an error and clears stale analytics.
- `DealerProfileScreen` — keeps already-loaded data (right, and unchanged) but now *says* the
  refresh failed. Note `Promise.all` means one rejection loses both calls, so it fires more
  often than the single catch suggests.

**Genuinely empty data still renders as zeros with no banner.** That was the whole point of the
row, and it is the thing most likely to be got wrong by a careless version of this change.

**Screens reset to their empty value on failure** rather than leaving the previous render's
numbers sitting under an error banner — stale figures beneath a "could not load" message are
their own kind of lie.

### Scope boundary, and a new row

CROSS-023 and OQ-26 both scope this to *dashboards*. The same pattern survives on **list**
screens, where a failed fetch renders as an empty list: `PaymentHistoryScreen:120`,
`DealerMyOffersScreen:148`, `DealerTeamScreen:231`, `NotificationsScreen:86`,
`SellerAuctionsScreen:233,250`, `SellerListingsScreen:219`, `SellerOffersScreen:187`. Logged as
**CROSS-025** (P3) rather than silently expanding this flow. Lower severity — an empty list is a
weaker false claim than a confident zero-revenue figure — but the same lie.

`BuyerDashboardScreen:192` has it too. That screen is dead code today (CROSS-021), so it was
deliberately not edited here; **Flow 9 must fix it as part of reviving it**, and CROSS-025 says
so.

Seven files. No backend change, no new dependency, no new component.

### Quality gates

```
$ npx tsc --noEmit
exit=2 — 22 errors, all @types/jest in VehicleCard.test.tsx. Errors elsewhere: 0.

$ npm run lint
exit=1 — 25 problems (12 errors, 13 warnings) — this branch's base (cut from main,
so without Flow 3's token fix that makes it 24/11).
```

### Manual test script

The whole flow is about telling failure apart from emptiness, so it needs testing **both** ways
round. Airplane mode is the easiest way to force failure.

**A — Failure is visible (the fix)**

1. Sign in as a seller with real data. Open the dashboard and confirm the numbers are right.
2. Turn on airplane mode, pull to refresh.
   *Expect:* a red error banner with **Try again**, and the tiles **not** showing a confident
   set of zeros.
3. Turn airplane mode off, tap **Try again**.
   *Expect:* the banner disappears and the real numbers come back.
4. Repeat 2-3 on each of: Seller Performance, Earnings, Dealer home, Dealer Analytics, Dealer
   Earnings, and the main (Unified) dashboard.
   *Expect:* the same behaviour on all six. **Dealer Analytics is the important one** — that is
   where a dealer previously saw zero sales and zero revenue with no warning at all.

**B — Emptiness is still emptiness (the regression risk)**

5. Sign in as a **brand-new account with no listings, no sales, no offers**, on a good
   connection.
   *Expect:* zeros and empty states, and **no error banner anywhere**. If a new user sees "Could
   not load your dashboard", this change is wrong in the opposite direction.
6. Same account, Earnings.
   *Expect:* £0 with no banner — not an error.

**C — Partial failure (SellerDashboard specifically)**

7. Hard to stage deliberately; try it if you can. The seller dashboard fires three requests. If
   only some fail, *expect:* "Some of your dashboard could not be loaded" rather than the total
   failure message, with whatever loaded still shown.

**D — Regression sweep**

8. Pull-to-refresh on every screen above with a good connection. *Expect:* unchanged.
9. Dealer Analytics period pills (7d/30d/etc.) while online. *Expect:* still refetch correctly
   and no banner appears.
10. Confirm no banner ever appears on a normal, connected session — a banner that shows up
    spuriously is worse than the silent zeros it replaced.

### Not verified in this session

- Nothing run on a device; no Android SDK here.
- **Step B is the one I would most want run.** I have reasoned that empty data does not trigger
  the error path, but "new account sees a scary red banner" is exactly the failure mode a
  careless version of this change produces, and I cannot rule it out from reading alone.
- Step C (partial failure) is reasoned from the rejection count; I did not stage three requests
  with mixed outcomes.
- `DealerProfileScreen` uses `Promise.all`, so I could not easily distinguish partial from total
  failure there without restructuring the call — it reports a single "could not refresh"
  message. Left as is rather than reworking a screen this flow only needed to annotate.
- I did not audit whether every dashboard's *sub*-fetches (period toggles, secondary calls) are
  covered — only the primary load path of each screen was traced.

**Next session:** Flow 5 — `parity/account-deletion` (AUTH-033, DASH-030), the last ship-line
flow, moved here by decision P-2.

---

## Phase 2 — Flow 4a: Signup role picker and onboarding flag split (2026-09-01)

Branch `parity/session-and-auth`, cut from `main` at `187b88a4`.
Rows: **AUTH-005, AUTH-001** → `NEEDS_VERIFICATION`.

**Flow 4 was split, as the plan pre-authorised.** 4a is the signup/onboarding half; 4b is the
session lifecycle half (AUTH-013, AUTH-014, AUTH-034, AUTH-035) and follows on its own branch
chained off this one, since both edit `authStore` heavily. The plan's instruction was to take
the split rather than half-land either half.

**A row ID in the plan was wrong.** The plan and the Phase 2 ordering both call the flag split
"AUTH-003". AUTH-003 is **Google OAuth sign-in**. The flag-pollution row is **AUTH-001**, whose
notes describe exactly this defect. Corrected in the matrix on AUTH-001; nothing renumbered.
Flow 4b's row list is unaffected.

### AUTH-005 — signup role picker

Mobile hardcoded `role = 'BUYER'`, so a dealer could not register as one at all: they had to
sign up as a buyer and then elevate. Now a two-card BUYER / DEALER picker
(`SignupScreen.tsx:49,151-186`), threaded through `signup(email, password, fullName, role)` to
`authStore.ts:303`.

**No backend change needed** — `syncUser` already validates `role` against the `UserRole` enum
and drops anything unrecognised (`users.service.ts:320`), read this session. BUYER + DEALER
only: FINANCE_PARTNER and the other partner roles are deliberately absent (OQ-5) because mobile
has no partner dashboard, and SELLER is not offered because buyer and seller are one account
here.

Choosing DEALER sets the **account role only**. It does not confer verification —
`dealerProfile.isVerified` still comes from KYC and `withDealerGate` still blocks dealer
screens — so the DealerOnboarding → KYC road is unchanged, just reachable without registering
as a buyer first.

**`CLAUDE.md:129-140` was updated in the same commit, and this matters.** That file actively
defended the BUYER hardcode; a later session reading it would have reverted this change. The
bug it guarded against was reading `get().role` — the local "preview as dealer" toggle — which
silently wrote DEALER into the database for people who never asked. An explicit choice on the
form is the opposite of that. The prohibition on `get().role` stands and is restated in code.

### AUTH-001 / OQ-3 — onboarding flag split

The pre-auth marketing carousel called `completeOnboarding()`, writing the same
`czm_onboarding_complete` key that gates the post-signup wizard. So a signed-out user tapping
through three marketing slides marked the wizard complete, and after signing up was never asked
for name, postcode or preferences.

- Carousel now writes its own `czm_intro_seen` via a new `completeIntro()`
  (`authStore.ts:16,111-114`, `OnboardingScreen.tsx:132-135`).
- `czm_onboarding_complete` is left to the wizard alone and its key is **deliberately
  unchanged**, so installs that already have it are not re-prompted — OQ-3's "default safely".
  The new key's absence on an existing install means "not seen", whose worst case is one extra
  viewing of the carousel, never a skipped wizard.
- **The carousel is now skipped once seen** (`AuthNavigator.tsx:40`) — owner-approved during
  the session. It was previously the initial route on *every* signed-out launch, so without
  this the new flag would have been written and never read. `hasSeenIntro` is hydrated
  unconditionally at the top of `initializeAuth` (`authStore.ts:126`), including on the
  no-session branch, which is precisely the branch that matters when signed out.

Five files: `screens/auth/SignupScreen.tsx`, `store/authStore.ts`,
`screens/onboarding/OnboardingScreen.tsx`, `navigation/AuthNavigator.tsx`, `CLAUDE.md`.
No backend change, no new dependency.

### Quality gates

```
$ npx tsc --noEmit
exit=2 — 22 errors, all @types/jest in VehicleCard.test.tsx. Errors elsewhere: 0.

$ npx eslint <the four changed source files>
exit=0 — clean, no warnings.

$ npm run lint
exit=1 — 25 problems (12 errors, 13 warnings).
```

**On the lint number:** this is 25/12, not the 24/11 Flow 3 established. That is correct and
not a regression — this branch is cut from `main`, which does not yet contain Flow 3's token
fix in `VehicleDetailScreen`. The baseline is per-base until the flows are merged. When Flow 3
lands on `main`, this branch's number becomes 24/11 too.

### Manual test script

**A — Dealer signup (AUTH-005)**

1. Sign out, go to Sign Up. *Expect:* an "I AM A" row above Full Name with two cards —
   **Buyer / Seller** (selected by default) and **Dealer**.
2. Tap Dealer. *Expect:* the card highlights and a note appears: "You'll complete dealer
   verification after signing up."
3. Complete signup as **Dealer**, verify the email, finish the wizard.
4. Open a dealer screen from the drawer (e.g. Dealer Inventory).
   *Expect:* the **dealer gate**, offering KYC — *not* the inventory itself, and *not* a
   buyer-only UI with the dealer entries missing. Choosing DEALER must not fake verification.
5. Complete DealerOnboarding → KYC. *Expect:* dealer screens unlock as before.
6. Sign up a second account as **Buyer / Seller**. *Expect:* buyer experience exactly as
   before this change.
7. **The regression that matters:** confirm neither account was created with the *other* role.
   Check the role on each profile after signup.

**B — Onboarding flag split (AUTH-001)**

8. **On a fresh install** (or after clearing app data): launch signed out.
   *Expect:* the marketing carousel.
9. Tap through or Skip to the end. *Expect:* Login.
10. Force-quit and relaunch, still signed out.
    *Expect:* **Login directly — no carousel.** It should not reappear.
11. Now sign up a brand-new account from that same install.
    *Expect:* the post-signup wizard **does** run — name, verify, postcode, preferences.
    **This is the bug being fixed: before, step 9 silently satisfied this gate and the wizard
    was skipped entirely.**
12. **Existing-install check, important:** on a device that had the app *before* this build and
    had already completed the wizard, update and sign in.
    *Expect:* **not** re-prompted for the wizard. The wizard's key is unchanged precisely so
    this holds.
13. Complete the wizard, sign out, sign back in. *Expect:* no wizard, no carousel.

**C — Regression sweep**

14. Sign out and back in on an existing account. *Expect:* unchanged.
15. Forgot-password flow. *Expect:* unchanged — it routes through the same Auth stack whose
    initial route changed.
16. Sign up with an email that already exists. *Expect:* the existing error handling.

### Not verified in this session

- Nothing run on a device; no Android SDK here.
- **Step A4 is the one I would most want tested.** That a DEALER-role account still hits the
  dealer gate is reasoned from `DealerGate` reading `isVerified || isDealerStaff`, neither of
  which signup sets — but I did not re-read `DealerGate.tsx` this session.
- Step B12 (existing install not re-prompted) cannot be exercised here at all; it depends on
  SecureStore state from a previous build.
- I did not read `PostSignupOnboardingScreen` this session beyond confirming it calls
  `completeOnboarding()`; its internal step order is untouched by this flow.
- Whether Supabase stores the chosen role in `user_metadata` usefully for anything downstream
  was not traced — it is passed, as before, but nothing was verified to read it.

**Next session:** Flow 4b — `parity/session-lifecycle` (AUTH-013, AUTH-014, AUTH-034,
AUTH-035), chained off this branch.

---

## Phase 2 — Flow 4b: Session lifecycle (2026-09-01)

Branch `parity/session-lifecycle`, chained off `parity/session-and-auth` (Flow 4a) because both
rewrite `authStore`.

Rows: **AUTH-013, AUTH-014, AUTH-034, AUTH-035** → `NEEDS_VERIFICATION`.

This is the layer every screen sits on. A mistake here signs everyone out, so each change is
deliberately conservative and guarded.

### An open question from Pass 1, now closed

AUTH-014 was scoped to "no handler in `App.tsx`, `RootNavigator.tsx`, or `authStore.ts`" because
`ChatContext` had never been read. It has now: `ChatContext.tsx:135-136` **swallows**
`AUTH_REDIRECT` as an expected condition alongside `NO_SESSION` and `REQUEST_TIMEOUT`. So the
row holds in its strong form — nothing in the app acted on an expired session.

### AUTH-014 / OQ-6 — 401 now signs the user out

`apiClient` emits before throwing (`apiClient.ts:102`); `authStore` registers `forceLogout` as
the handler (`:571-573`).

They are connected through a new `lib/authEvents.ts` rather than a direct import. `authStore`
imports `apiClient`, so importing back would be a require cycle — Metro resolves those by
handing one module a half-initialised copy of the other, which for an auth store is a bug that
shows up once in a hundred cold starts. The new module imports nothing.

**The emit is latched.** A screen firing five requests on focus gets five 401s; without a latch
each runs its own teardown and its own navigation. First wins, rest are ignored. Re-armed on
`SIGNED_IN`, `TOKEN_REFRESHED` and a successful `login()`, so a later expiry in the same app run
is still acted on.

`forceLogout` deliberately does **not** call `POST /auth/logout` — the session it would
authenticate with is the one that just failed. It does call Supabase `signOut()`, so the dead
refresh token is cleared from SecureStore instead of being retried on next launch. It returns
early when already signed out, so it cannot yank a user who is legitimately sitting on Login.

### AUTH-034 — the destination survives re-login

`forceLogout()` reads the current route from `navigationRef` **before** the stacks swap
(`authStore.ts:146-160`), skipping auth screens as destinations.
`RootNavigator.tsx:32-52` consumes it exactly once after re-login, deferred one tick — the same
reason `App.tsx`'s deep-link handler defers, since navigating in the same tick targets the
navigator being unmounted. A route that no longer exists is caught and ignored: the user is
signed in, and Main's default route beats a blank screen. A deliberate `logout()` clears the
destination — that is not an interrupted journey.

### AUTH-035 — no more Login flash

**`isLoading` could not have been the fix**, which is worth recording since the row points at
it. It starts `false`, so there is a window between mount and `initializeAuth` running where it
and `isAuthenticated` are both false and the app looks signed out. Added `authInitialized`, set
in `initializeAuth`'s `finally` on success *and* failure (`:311`) — the question it answers is
"have we looked?", not "did we find one?" — and `App.tsx:253` holds the splash on
`!fontsLoaded || !authInitialized`.

### AUTH-013 — one app-wide subscription

`subscribeToAuthChanges()` (`authStore.ts:189-247`), mounted once in `App.tsx:197`.

- `SIGNED_OUT` → `forceLogout()`, guarded on `isAuthenticated` so our own logout does not
  trigger a second teardown racing the first.
- `PASSWORD_RECOVERY` → deliberately nothing. Recovery tokens 401 against the backend bridge,
  which is exactly why web skips it (`AuthContext.tsx:124-129`); routing to the reset screen is
  already handled by `App.tsx`'s deep-link branch.
- `SIGNED_IN` → **stands aside when `pendingEmailVerification` is true.**
  `VerifyEmailScreen.tsx:38-48` keeps its own handler to drive its spinner; without this guard
  the two would race on the same profile fetch. Otherwise rehydrates if not already signed in.
- `TOKEN_REFRESHED` → rehydrates only when local state thinks it is signed out (a cold restore
  that lost the race). The backend session outlives a token refresh, so the normal case needs
  nothing.

Five files: `lib/authEvents.ts` (new), `lib/apiClient.ts`, `store/authStore.ts`,
`navigation/RootNavigator.tsx`, `App.tsx`. No backend change, no new dependency.

### Quality gates

```
$ npx tsc --noEmit
exit=2 — 22 errors, all @types/jest in VehicleCard.test.tsx. Errors elsewhere: 0.

$ npx eslint <the changed source files>
exit=0. (App.tsx reports "File ignored because no matching configuration" — it sits
outside the eslint config's src glob, which is pre-existing and not introduced here.)

$ npm run lint
exit=1 — 25 problems (12 errors, 13 warnings). Same as Flow 4a: this branch chains off
4a, which is cut from main, so Flow 3's token fix (24/11) is not in this base.
```

### Manual test script

The theme of this flow is that failure states must not strand or spuriously eject the user, so
most of these steps are about what should *not* happen.

**A — Cold start (AUTH-035)**

1. Sign in, force-quit, relaunch.
   *Expect:* splash, then straight into the app. **No flash of the Login screen.** Watch
   carefully — the old bug was a single frame.
2. Relaunch in airplane mode while signed in.
   *Expect:* still no Login flash. The splash may hold slightly longer (the profile fetch times
   out at 10s), then the app opens. **It must not sign you out** — `authInitialized` is set on
   failure too, precisely so a failed check does not hang on the splash forever.
3. Relaunch while signed out. *Expect:* Login (or the carousel on a first run — Flow 4a).

**B — Session expiry (AUTH-014, AUTH-034) — the core of this flow**

4. Sign in and navigate somewhere specific and deep, e.g. a vehicle detail screen.
5. Invalidate the session server-side (sign the account out from web, or clear its Supabase
   session), then trigger a request on mobile — pull to refresh, or open a screen that fetches.
   *Expect:* you are returned to **Login**, once, cleanly. Previously nothing happened at all:
   the screen just stopped working.
6. Sign back in.
   *Expect:* you land back on **the screen from step 4**, not the app root.
7. Repeat step 5 on a screen that fires several requests at once (a dashboard).
   *Expect:* **one** trip to Login, not several — and no flicker of repeated navigation. This is
   what the latch exists for.
8. After a successful re-login, expire the session again.
   *Expect:* it still ejects you. The latch must have re-armed.

**C — Sign-out paths (AUTH-013)**

9. Sign out from the app normally. *Expect:* Login, unchanged from before.
10. Sign back in and go somewhere deep, then sign out normally.
    *Expect:* signing in again lands you at the **default screen, not** where you were. A
    deliberate sign-out is not an interrupted journey.
11. **Remote sign-out:** signed in on the device, sign that account out from the web app.
    *Expect:* the device notices and returns to Login. Previously unobserved entirely.
12. Leave the app backgrounded past a token refresh (an hour or so), then return.
    *Expect:* it still works and does **not** sign you out.

**D — Sitting on Login (the guard)**

13. Sign out, sit on the Login screen, and let any background request fail.
    *Expect:* nothing happens — no navigation, no flicker. `forceLogout` returns early when
    already signed out.

**E — Email verification, unchanged (the SIGNED_IN guard)**

14. Sign up a new account and stop on the Verify Email screen.
15. Click the verification link.
    *Expect:* the screen shows its spinner and proceeds into the app **once** — not twice, and
    with no double profile fetch. This is what the `pendingEmailVerification` guard protects.

**F — Password recovery, unchanged**

16. Run forgot-password to completion via the emailed link.
    *Expect:* exactly as before — the reset screen opens and the reset succeeds. The new
    `PASSWORD_RECOVERY` branch deliberately does nothing, so any change here is a regression.

### Not verified in this session

- Nothing run on a device; no Android SDK here. For a flow whose failure mode is "everyone gets
  signed out", **that gap matters more than in any previous flow** — B, C and E are all timing
  and race behaviour that I have reasoned about but not observed.
- Step B7 (the latch under concurrent 401s) is reasoned from the latch logic, not observed.
- Step E15 (no double `initializeAuth`) rests on reading `VerifyEmailScreen`'s handler and the
  new guard; I did not instrument the calls.
- Step C12 (token refresh across a long background) cannot be simulated here at all.
- The 300ms defer in `RootNavigator` matches the existing deep-link handler's timing. It is a
  heuristic, not a guarantee — if step B6 lands on the app root instead of the intended screen,
  that constant is the first thing to look at.
- `GlobalToastProvider` and `ChatContext` both open sockets on auth state; I did not re-read how
  they react to `forceLogout` clearing the user mid-session.

**Next session:** Flow 6 — `parity/deep-linking-and-offline` (AUTH-020, AUTH-019, AUTH-030 +
CROSS-015, CROSS-017), the prebuild boundary. Flow 5 (account deletion) was moved after Flow 7
by decision P-2.

---

## Phase 2 — Flow 6: Deep linking and offline (2026-09-01)

Branch `parity/deep-linking-and-offline`, chained off `parity/session-lifecycle` (4b) — both
edit `App.tsx` and `apiClient`.

Rows: **AUTH-020, AUTH-019, AUTH-030, CROSS-015, CROSS-017** → `NEEDS_VERIFICATION`.

**This is the prebuild boundary.** `app.json` changed and a native dependency was added, so
none of this reaches a binary without `npx expo prebuild --clean --platform android` followed by
a fresh build. `android/` is gitignored, so pulling this branch is not enough. Two commits,
kept separately reviewable as planned: linking first, offline second.

### AUTH-020 — a real linking config

`NavigationContainer` had no `linking` prop at all, so React Navigation never routed an inbound
URL and every deep link fell to one ad-hoc `expo-linking` listener that understood Supabase
tokens and nothing else. New `src/navigation/linking.ts` holds the route map; its `filter`
excludes auth-callback URLs so the config and the listener never both act on one link.

**Two deliberate limits, both recorded rather than half-built:**

1. **`VehicleDetail` and `LiveAuctionDetailed` are not linkable.** Both take a hydrated
   `listing: CarListing` route param. A URL can only carry a slug or id, so mapping them would
   hand the screen `{ slug }` where it reads `route.params.listing` — a crash on every inbound
   vehicle link. Making them linkable means first giving them an id-only entry path that
   self-fetches, which is a real change to two large screens and not this flow's job.
2. **iOS App Links are not configured.** `app.json` gains the Android https intent filter for
   `/auth/accept-invite`, but iOS needs `associatedDomains` *and* an
   `apple-app-site-association` file served from `carmazium.com` — server-side work outside this
   repo. So `https://` links open the app on **Android only**. The `carmazium://` scheme works
   on both, as before.

### AUTH-019 — the callback handler now covers web's branches

Mobile handled two of seven: implicit tokens, and a bare PKCE exchange. No error branch, no
rescue when the code had already been consumed, no timeout — so a failed or expired link left
the user on the splash with no feedback, indistinguishable from a working link that did nothing.

Now, in web's order: error param first; implicit tokens with recovery routing; PKCE with **both**
rescues — the exchange-error path and the AbortError path each fall back to `getSession()`,
because a session existing means success even when the exchange itself threw; and a 15s safety
alert in place of web's 15s forced redirect, since mobile has nowhere to redirect to.

**Those rescues matter more now than when the row was written.** Flow 4b added a global
`onAuthStateChange` subscription (AUTH-013) — precisely the kind of listener that races the
handler to consume the code, which is the same race web's own comments describe against its
`AuthContext`. Adding AUTH-013 without these rescues would have made this worse, not better.

### AUTH-030 — the invite link opens the app

`AcceptInvite` takes `{ token?: string }`, the linking config maps `/auth/accept-invite` to it,
and the screen auto-accepts when the token arrives by link — matching web, which accepts
straight from its `?token=` param with no extra tap.

**The paste field stays.** With iOS App Links unconfigured, pasting is still the only route on
iOS, so removing it would have broken the flow on one platform to tidy the other.

### CROSS-015 / CROSS-017 — offline, minimum viable

`@react-native-community/netinfo` 11.4.1, `src/lib/network.ts`, an `OfflineBanner` mounted once
above the navigator, and an `OFFLINE` sentinel in `apiClient` joining `NO_SESSION` /
`REQUEST_TIMEOUT` / `AUTH_REDIRECT`. **Scope is OQ-28's minimum: no request queueing, no cached
reads.** Both change what "saved" and "up to date" mean app-wide and were held for a separate
discussion.

Three judgement calls:

- **The monitor starts optimistic.** NetInfo's first callback is asynchronous; treating "not yet
  known" as offline would break cold start on a perfectly good connection.
- **The sentinel is raised after `fetch` fails, not pre-flight.** A stale or wrong reachability
  flag must never block a request that would have succeeded. Only once the request has genuinely
  failed is "you're offline" worth saying.
- **Only a definite `false` counts as offline.** `isInternetReachable` false-positives on
  captive portals and some Android emulators, and a wrong "you're offline" on a working
  connection is worse than one honest request failure.

`ChatContext.tsx:136` was extended to swallow `OFFLINE` alongside the other sentinels — the
banner already says it, and a chat error stacked on top is noise.

Nine files across two commits. `App.tsx`, `apiClient.ts`, `ChatContext.tsx`,
`MainStackNavigator.tsx`, `AcceptInviteScreen.tsx`, `app.json`, `package.json`, plus new
`navigation/linking.ts`, `lib/network.ts`, `components/OfflineBanner.tsx`.

### Quality gates

```
$ npx tsc --noEmit
exit=2 — 22 errors, all @types/jest in VehicleCard.test.tsx. Errors elsewhere: 0.

$ npx eslint <the changed source files>
exit=0 — clean.

$ npm run lint
exit=1 — 25 problems (12 errors, 13 warnings). Same as this branch's base.
```

One self-correction worth noting: the first pass added an `eslint-disable-next-line
react-hooks/exhaustive-deps` to the invite screen that the rule did not need. That would have
made the baseline 26/12 by adding a fourteenth unused-directive warning — the exact class of
lint debt already sitting in this repo. Removed before commit; the comment explaining the empty
dependency array stayed.

### Manual test script

**Prerequisite: `npx expo prebuild --clean --platform android`, then a fresh build.** Nothing in
section A or C will work on an existing binary — `app.json` and a native module both changed.

**A — Deep links (AUTH-020, AUTH-030)**

1. With the app **closed**, open `carmazium://notifications` (adb: `adb shell am start -W -a
   android.intent.action.VIEW -d "carmazium://notifications"`).
   *Expect:* the app cold-starts on Notifications, not the home screen.
2. Same link with the app **backgrounded**. *Expect:* it foregrounds onto Notifications.
3. `carmazium://settings`, `carmazium://messages`, `carmazium://dashboard/listings`.
   *Expect:* each lands correctly.
4. A **signed-out** device, then `carmazium://settings`.
   *Expect:* Login — not a crash, and not a screen that immediately errors. RootNavigator still
   decides Auth vs Main from session state; the URL does not override it.
5. `carmazium://this-route-does-not-exist`. *Expect:* the app opens normally, no crash.
6. **Android https link:** `https://carmazium.com/auth/accept-invite?token=<real token>`.
   *Expect:* the app opens on Accept Invite and **accepts automatically** — no pasting. First
   run may show the Android disambiguation dialog until App Links verification completes.
7. **iOS:** the same https link. *Expect:* it opens the **website**, not the app — that is the
   documented limitation, not a bug. The paste field must still work there.
8. Invite screen reached from the drawer with no token. *Expect:* the paste field, unchanged.

**B — Auth callback (AUTH-019)**

9. Sign-up verification email → tap the link. *Expect:* app opens, verification completes.
10. Forgot password → tap the emailed link. *Expect:* the reset screen, and the reset works.
    This path is the most likely regression in the whole flow.
11. Google sign-in, all the way through. *Expect:* returns to the app signed in.
12. **Tap an already-used verification link a second time.**
    *Expect:* a clear "Sign-in link problem" alert. **Previously: nothing at all** — the app
    just sat there, which is the actual bug in AUTH-019.
13. Let a recovery link expire, then tap it. *Expect:* an alert, not silence.

**C — Offline (CROSS-015)**

14. Turn on airplane mode with the app open.
    *Expect:* the amber "No internet connection" banner appears at the top within a second or
    two, over whatever screen you are on.
15. Pull to refresh a list while offline.
    *Expect:* a sensible failure, **not** a raw `TypeError: Network request failed`.
16. Turn airplane mode off. *Expect:* the banner disappears on its own.
17. Cold-start the app **with a working connection** and watch closely.
    *Expect:* **no flash of the offline banner.** This is what the optimistic default protects;
    a flash on every launch would mean the default is wrong.
18. Cold-start in airplane mode. *Expect:* banner shows; the app still opens (Flow 4b's
    `authInitialized` handles the failed session check).
19. Open Messages while offline. *Expect:* no chat error toast stacked on top of the banner.

**D — Regression sweep**

20. Normal navigation around the app with a good connection. *Expect:* the banner never appears
    and never occupies layout.
21. Re-run Flow 4b step B5 (session expiry ejects to Login) — `apiClient` changed again here, so
    confirm the 401 path still works.

### Not verified in this session

- **Nothing here has been prebuilt or run.** This is the flow where that gap is largest: the
  linking config, the intent filter and the native module are all things whose first honest test
  is a real build. Everything below is design intent, not observed behaviour.
- Whether Android App Links verification actually succeeds depends on an `assetlinks.json`
  served from `carmazium.com/.well-known/` — **I did not check whether one exists.** If it does
  not, step 6 will show the disambiguation dialog every time rather than opening the app
  directly. Worth checking before that step is called a failure.
- The `linking` config's `filter` is the only thing keeping React Navigation and the Supabase
  listener from both claiming a callback URL. I reasoned about the URL shapes; I did not observe
  a real Supabase link being filtered.
- NetInfo's behaviour on the specific test device is unknown — `isInternetReachable` semantics
  vary, which is why only a definite `false` is treated as offline.
- I did not audit every screen's error rendering for the new `OFFLINE` sentinel. Only
  `ChatContext` was updated; other screens will show their generic error path, which is a
  degradation from the banner's clarity but not a regression from the raw `TypeError` they
  showed before.

### Logged — not done in this flow

- **iOS App Links**: `associatedDomains` in `app.json` plus `apple-app-site-association` served
  from the domain.
- **Android `assetlinks.json`** if not already served.
- **Linkable vehicle/auction screens**: both need an id-only entry path that self-fetches before
  they can safely appear in the linking config.
- **Web has no offline handling either** — CROSS-015 was a shared absence and only mobile is
  addressed.

**Next session:** Flow 7 — `parity/dashboard-error-states` (CROSS-023, DASH-047), the last
ship-line flow before Flow 5.

---

## Phase 2 — Flow 5: Account deletion (2026-09-01)

Branch `parity/account-deletion`, cut from `main` **after every prior flow was merged into it**
at the repo owner's direction — so this is the first flow built on the complete stack, and the
first whose lint baseline is the merged 24/11 rather than a per-branch number.

Rows: **AUTH-033, DASH-030** → `NEEDS_VERIFICATION`.

Moved to last by decision P-2: it is required before Play Store submission, not before the
side-loaded APK. It also depends on Flow 4b, whose `logout()` teardown it reuses.

### Contract details established by reading the endpoint, not assumed

Three things the matrix did not record, all of which shape the UI:

1. **The request must carry `{ confirmation: 'DELETE' }` in the body.** The controller 400s
   otherwise (`users.controller.ts:236-243`). So the typed field is a guard against a pointless
   round trip, not the only gate — the server enforces it independently.
2. **It is an anonymise, not a hard delete** (`users.service.ts:145-155`), and it **withdraws
   DRAFT / PENDING_REVIEW / ACTIVE listings** first (`:140-143`). The copy says exactly that
   rather than implying everything vanishes.
3. **The backend refuses deletion outright** while the user has a live auction as seller or an
   active bid as buyer (`:117-136`) — deliberately, so nobody dodges losing an auction by
   deleting. Those messages are specific and actionable, so the screen surfaces the server's own
   text rather than flattening it into "could not delete your account".

### What was built

A danger-zone section at the end of `SettingsScreen`, opening a typed-confirmation bottom sheet
that mirrors web's `DeleteAccountSection.tsx:73-97`. Confirm is disabled until the field reads
DELETE; the sheet cannot be dismissed mid-request.

Teardown **reuses the existing `logout()`** rather than writing a second path. It clears the
backend session, Supabase tokens and local state in the right order, `RootNavigator` swaps to
the Auth stack off the back of it, and its best-effort `POST /auth/logout` already tolerates the
session the server has just destroyed. Notably **not** `forceLogout()` — that one captures a
`postLoginRedirect` for a later return, which is precisely wrong for an account that no longer
exists.

One file: `src/screens/main/SettingsScreen.tsx`. No backend change, no new dependency.

### Quality gates — run on the fully merged tree

```
$ npx tsc --noEmit            (mobile)
exit=2 — 22 errors, all @types/jest in VehicleCard.test.tsx. Errors elsewhere: 0.

$ npx tsc --noEmit            (backend)
3 errors, all pre-existing (payments.controller, sellers.service, db-backup).

$ npm run lint
exit=1 — 24 problems (11 errors, 13 warnings) — the merged baseline, including
Flow 3's token fix.
```

### Manual test script

**Use a throwaway account.** Deletion is irreversible and the email is rewritten, so the address
cannot be reused as-is.

**A — The guard**

1. Settings → scroll to the bottom. *Expect:* a red DANGER ZONE card explaining that listings
   are withdrawn and personal details removed.
2. Tap DELETE ACCOUNT. *Expect:* a sheet with a confirmation field; the confirm button is
   **disabled and dimmed**.
3. Type `delete` (lowercase). *Expect:* enabled — the check is case-insensitive, matching the
   server's `.toUpperCase()`.
4. Type `DELETEX` or clear the field. *Expect:* disabled again.
5. Tap Cancel. *Expect:* the sheet closes, nothing happens, the account still works.

**B — The blocking rules (the interesting cases)**

6. On an account **currently selling a live auction**, attempt deletion.
   *Expect:* the specific message "You have a live auction in progress. Please wait for it to
   end before deleting your account." — **not** a generic failure. The account still works.
7. On an account **with an active bid on a live auction**, attempt deletion.
   *Expect:* the equivalent bid message, and the account still works.

**C — Deletion itself**

8. On a throwaway account with **one ACTIVE listing**, note the listing, then delete.
   *Expect:* the sheet closes and the app returns to Login — no crash, no half-signed-in state.
9. Try to sign in again with those credentials. *Expect:* failure.
10. From another account, look for that seller's listing.
    *Expect:* **withdrawn**, not still live. This is the step most likely to reveal a gap
    between what the copy promises and what the backend does.

**D — Regression sweep**

11. Sign out normally from another account. *Expect:* unchanged.
12. Everything else in Settings — profile save, password change, payouts, bank details, trader
    verification. *Expect:* unchanged; this flow only appended to the screen.

### Not verified in this session

- Nothing run on a device; no Android SDK here.
- **Steps B6/B7 are the ones I would most want run.** That the server's specific message reaches
  the sheet rests on `apiClient` surfacing the backend's `message` field through
  `normalizeErrorMessage`, which I did not re-read this session.
- Step C10 (listing actually withdrawn) is read from `users.service.ts:140-143`, not observed.
- Whether the Supabase auth user is also removed or merely orphaned was **not traced** — the
  backend anonymises its own `User` row, and I did not check for a corresponding Supabase admin
  deletion. If it is orphaned, step 9 may fail in a different way than expected (a session with
  no backend user rather than a rejected sign-in). Worth watching.
- The sheet's behaviour if the app is backgrounded mid-request was not considered.

**Phase 2 ship-line status:** all ship-line flows are now built and merged to `main`
(1, 2a, 2b, 3, 4a, 4b, 6, 7 merged; 5 on its branch pending merge). **None are VERIFIED** —
every row is `NEEDS_VERIFICATION` and only the repo owner sets otherwise. Flow 6 requires
`npx expo prebuild --clean` and Flow 3's auction routing requires the backend deployed.

---

## Phase 3 (Phase D) — Flow 8: Chat presence and contact support (2026-09-01)

Branch `parity/chat-presence-support`, cut from `main` with the whole ship-line merged in.
Rows: **DASH-023, DASH-024** → `NEEDS_VERIFICATION`.

First flow below the ship-line. Both rows are pure consumption of things the backend already
does — no backend change, no new dependency.

### DASH-023 — presence

The gateway broadcasts `presence:update` on connect and disconnect, and sends a
`presence:snapshot` of who is already online when you connect. Web consumes both.
`ChatContext` listened for `message:new`, `user:typing`, `messages:read` and `error` — neither
presence event — so mobile could never show who was reachable.

`ChatContext` now handles both and exposes `onlineUserIds: Set<string>`; `MessagesScreen`
renders a green dot on the partner's avatar.

Three choices worth recording:

- **The snapshot is handled, not just the update.** Without it every partner reads as offline
  until their next connect/disconnect, which is exactly why the gateway sends it
  (`chat.gateway.ts:116-124`). Handling only `presence:update` would look correct in a quick
  two-device test and be wrong in practice.
- **The set is cleared when our own socket disconnects.** Holding the last known state would
  show stale green dots for the length of the outage — a confident claim about something we can
  no longer observe.
- **The row takes a boolean, not the Set.** `ThreadRow` is `React.memo`'d specifically so a
  `FlatList` only re-renders the row that changed; passing the Set would hand every row a new
  prop identity on every presence change and defeat that.

Absence of a dot means "offline or unknown" — it never claims someone is offline.

### DASH-024 — contact support

`POST /chat/support` finds-or-creates a room with the oldest ADMIN and joins both parties
server-side. Mobile had no route to it at all. Added `getOrCreateSupportRoom()` to `chatApi` and
a **Contact Support** row in `GlobalDrawer` above Sign Out — the drawer is mobile's equivalent
of web's sidebar, where this sits for every role.

Opens the support chat room rather than an email client, matching web and keeping the
conversation in the product. The endpoint is idempotent, and the handler additionally guards on
its own in-flight state, because this is a button people will double-tap.

Four files: `context/ChatContext.tsx`, `screens/main/MessagesScreen.tsx`, `lib/chatApi.ts`,
`components/GlobalDrawer.tsx`.

### Quality gates

```
$ npx tsc --noEmit    22 errors, all @types/jest. Errors elsewhere: 0.
$ npx eslint <the four changed files>   exit=0, clean.
$ npm run lint        24 problems (11 errors, 13 warnings) — the merged baseline.
```

### Manual test script

Presence needs **two accounts on two devices** (or one device plus the web app signed in as the
other party) — it cannot be tested single-handed.

**A — Presence (DASH-023)**

1. Devices A and B, each signed in as a different account, with an existing conversation between
   them. Open Messages on A while B is signed in with the app open.
   *Expect:* a green dot on B's avatar in the thread list.
2. Force-quit the app on B. Wait a few seconds.
   *Expect:* the dot on A disappears without A refreshing.
3. Reopen the app on B. *Expect:* the dot returns on A.
4. **The snapshot case:** with B already online, force-quit and reopen the app on **A**.
   *Expect:* the dot is there immediately on A's first load — not only after B next reconnects.
   This is the case that fails if only `presence:update` is handled.
5. Put A in airplane mode. *Expect:* all dots clear rather than freezing as they were.
6. A conversation with someone offline. *Expect:* no dot, and no "offline" label either.

**B — Contact support (DASH-024)**

7. Open the drawer. *Expect:* a Contact Support row above Sign Out, on every role — buyer,
   seller and dealer.
8. Tap it. *Expect:* the drawer closes and a chat opens with CarMazium support.
9. Send a message, then go back to Messages. *Expect:* the support conversation is in the list.
10. Tap Contact Support again. *Expect:* the same conversation, not a second one — the endpoint
    is find-or-create.
11. Double-tap it quickly. *Expect:* one navigation, no duplicate rooms, no error.
12. Tap it with no connection. *Expect:* "Could not open support" with a real message, and the
    drawer stays usable.

**C — Regression sweep**

13. Normal chat: send and receive a message, typing indicator, unread badge. *Expect:*
    unchanged.
14. Scroll a long thread list. *Expect:* no jank — the memoised row should not be re-rendering.

### Not verified in this session

- Nothing run on a device; no Android SDK here, and presence is inherently a two-device test.
- **Step A4 (the snapshot) is the one I would most want run.** It is the difference between
  presence that looks right in a quick test and presence that is right, and I have only reasoned
  about the gateway's emit order.
- Whether an ADMIN user actually exists in the target environment was **not checked**.
  `findOrCreateSupportRoom` pairs the user with the oldest ADMIN — if there is none, step 8 may
  fail server-side. Worth confirming before treating a failure there as a client bug.
- `ChatScreen` was not read this session, so how the support room renders once opened — title,
  avatar, any admin-specific affordances — is unverified.
- Presence is surfaced on the thread list only. Web also shows it in the conversation header;
  that is a possible follow-up, not done here.
