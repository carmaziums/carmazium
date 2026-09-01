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
