# CarMazium Parity — Open Questions

Ambiguities found during the audit that need a decision from the repo owner.
Claude writes questions here and stops rather than inventing behaviour.

Format: one section per question. Status is `OPEN` or `ANSWERED`.
Answered questions stay in the file with the answer recorded inline.

---
## OQ-1 — Should mobile support role selection at signup? — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-005, AUTH-026, AUTH-029.

Web lets a user pick BUYER / DEALER / FINANCE_PARTNER at signup (`src/app/auth/signup/page.tsx:153-157`) and validates against six roles (`signup/page.tsx:13`). Mobile hardcodes `const role = 'BUYER'` (`carmazium app/carmazium app/src/store/authStore.ts:265`).

The mobile comment (`authStore.ts:258-264`) says this was a deliberate fix — reading the local preview-role toggle was writing `role: DEALER` into the database for fresh signups. So the hardcode fixed a real bug, but it also removed the capability.

**Question:** which is canonical?
- (a) Mobile is right — all signups are BUYER, dealers elevate later via `DealerOnboardingScreen` / `POST /users/elevate`. Then the **web** role picker is the divergence and AUTH-005 becomes a web bug, not a mobile gap.
- (b) Web is right — mobile needs a role picker, wired so it reads the picker rather than `get().role`.

Not guessing. This determines whether AUTH-005 is scoped at all, and whether AUTH-029 (partner dashboards) is ever in scope for mobile.

---

## OQ-2 — Which password minimum length is canonical? — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-008, AUTH-016.

Four different rules in one codebase:

| Surface | Minimum | Citation |
|---|---|---|
| Web signup | none client-side (HTML5 `required` only) | `src/app/auth/signup/page.tsx:60-151` |
| Web reset password | **6** | `src/app/auth/reset-password/page.tsx:30-33` |
| Mobile signup | **8** | `src/screens/auth/SignupScreen.tsx:50` |
| Mobile reset password | **8** | `src/screens/auth/ResetPasswordScreen.tsx:41-45` |
| Backend `RegisterDto` / `ResetPasswordDto` | **8** | MinLength(8) |

**Question:** confirm 8 everywhere, and confirm the web reset page's 6 is a bug to be filed separately (web change — out of scope for mobile parity, but it should not be copied onto mobile).

---

## OQ-3 — `hasCompletedOnboarding` is set pre-auth by the marketing carousel — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-001, AUTH-023, AUTH-025.

`OnboardingScreen.tsx:156,162` calls `completeOnboarding()` — which writes the `czm_onboarding_complete` SecureStore flag (`store/authStore.ts:6,89-92`) — when a user skips or finishes the pre-auth marketing carousel, before they have an account.

That is the same flag the post-signup wizard gate reads: `hasCompletedOnboarding = storedFlag === '1' || !!profile.location` (`authStore.ts:123-127`), consumed at `RootNavigator.tsx:40-41`.

**Concern (not verified on device):** a user who skips the carousel, then signs up, may have the post-signup wizard skipped entirely — never setting name, postcode, or preferences — because the OR short-circuits on the local flag.

**Question:** are these meant to be the same flag? I have not run this on device and will not assume the outcome. If they should be separate, that is a mobile fix; the flag split is the change, and it needs your go-ahead since it touches stored state on existing installs.

---

## OQ-4 — Terms and Privacy acceptance: mobile enforces it, web does not — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-007.

Mobile requires an agree-to-terms checkbox before signup is enabled (`SignupScreen.tsx:50,292-305`). A grep for `terms` / `agree` in `src/app/auth/signup/page.tsx` returned no matches.

**Question:** is the web app missing a required legal gate (a web bug), or is the mobile checkbox extra? Parity work will otherwise "fix" mobile by removing a consent gate, which is the wrong direction if the gate is legally required.

---

## OQ-5 — Are ADMIN and partner roles ever in scope for mobile? — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-027, AUTH-029, AUTH-026.

Backend has 7 roles (`backend/prisma/schema.prisma:18-27`). Web routes 6 of them to distinct dashboards plus an admin panel (`src/app/dashboard/page.tsx:25-44`). Mobile's store types `role` as only `'buyer' | 'seller' | 'dealer'` (`store/authStore.ts:60,68`) and maps everything else to `buyer` (`authStore.ts:117`).

**Question:** confirm mobile is intentionally buyer/seller/dealer only. If so I will mark AUTH-027 and AUTH-029 as out-of-scope rather than gaps, and AUTH-026 reduces to "ensure non-supported roles get a clear message instead of silently landing in the buyer UI."

---

## OQ-6 — Who handles the mobile `AUTH_REDIRECT` sentinel? — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-014, AUTH-012.

Mobile `src/lib/apiClient.ts:93-95` throws `Error('AUTH_REDIRECT')` on 401, mirroring the web sentinel. But web's `apiClient` *also* navigates first (`src/lib/apiClient.ts:9-20,119`); mobile does not.

I searched `App.tsx`, `RootNavigator.tsx`, and `store/authStore.ts` and found no global catch. `ChatContext` is referenced in an `apiClient.ts` comment as a caller that motivated the `NO_SESSION` early-bail, but I did not read `ChatContext` in this pass — so **I cannot claim there is no handler anywhere**, only that there is none in the three files I checked.

**Question:** is there an intended global handler? If not, the fix is a store-level `forceLogout()` that `apiClient` calls on `AUTH_REDIRECT`. That touches every screen's error path, so I want your approval before scoping it.

---

## OQ-7 — `src/app/auth/partners/page.tsx` looks broken against the backend contract — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-031.

The partners portal posts `{email, supabaseToken}` to `POST /auth/login` (`src/app/auth/partners/page.tsx:54-60`). The backend `LoginDto` accepts only `{email, password}`, and the global validation pipe is configured `whitelist: true, forbidNonWhitelisted: true` (`backend/src/main.ts:115-116`) — so this request should be rejected with a 400 (unknown property `supabaseToken`, missing `password`).

I have **not** run this, so I am not asserting it fails in production — only that the code as written contradicts the DTO plus pipe config.

**Question:** is the partners portal live and working? If it is broken, AUTH-031 should not be ported to mobile until the web flow is fixed, since I would be copying a broken contract.

---

## OQ-8 — Two deployment paths with different route prefixes — `OPEN` (informational)
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** nothing yet; flagged so it does not bite later passes.

`backend/src/main.ts` has **no** `setGlobalPrefix` call (grep returned no match), and listens directly (`main.ts:157`). `api-server/index.ts:11` wraps the same `AppModule` for a serverless deploy and **does** call `app.setGlobalPrefix('api')`, rewriting URLs to start with `/api` (`api-server/index.ts:27-29`).

Both clients target the same host with no `/api` prefix: web `src/lib/apiClient.ts:3` and mobile `src/lib/apiClient.ts:3` both default to `https://carmazium-hjoh9w.fly.dev`.

So `api-server/` appears to be an unused legacy Vercel path — consistent with the recent commit "fix(payments): stop sending paying customers to a dead deployment". **Question:** can I treat `backend/src/main.ts` (no prefix) as the only contract for all remaining passes and ignore `api-server/`?

## OQ-9 — Stale £95 buyer-fee default in `PurchaseFlowScreen` — `OPEN`
**Raised by:** Pass 2 BUY (2026-08-31). **Blocks:** BUY-028.

Web's auction buyer fee is a constant `AUCTION_BUYER_FEE = 125` (`src/app/checkout/page.tsx:16`, documented as £100 seller bonus + £25 platform).

Mobile's `PurchaseFlowScreen` declares `buyerFee` with a default of **95** in two places (`PurchaseFlowScreen.tsx:74,80`). I checked every call site: all five pass `buyerFee: 125` explicitly (`BuyerBidsScreen.tsx:376`, `AuctionCompleteScreen.tsx:82`, `ChatScreen.tsx:454`, `AuctionDetailScreen.tsx:422,999`). **So nothing charges £95 today.**

**Question:** can I delete the `95` default (making the param required) as part of the BUY flow work? It is a money path, so I am not changing it on my own initiative — but leaving a wrong default in a payment screen invites a future caller to silently undercharge by £30.

---

## OQ-10 — Retail checkout is dormant on BOTH apps — `OPEN`
**Raised by:** Pass 2 BUY (2026-08-31). **Blocks:** BUY-029.

Web `/checkout` fully implements a retail deposit (£500) and full-payment mode (`src/app/checkout/page.tsx:327-494`), but no inbound link reaching `mode=deposit` or `mode=full` was found in `src/app`. The detail pages instead state payment is not taken on the platform (`VehicleDetailsPageClient.tsx:1370`). Mobile mirrors this: `PurchaseFlowScreen` supports `DEPOSIT` / `FULL_PAYMENT` but only `COMMISSION` call sites exist.

Caveat: the web check was a grep, so a runtime-constructed URL could evade it. Treat as "apparently dormant", not proven dead.

**Question:** is retail checkout intentionally off (payment handled off-platform), or is this an unfinished feature? If intentionally off, BUY-029 is not a parity gap and I will mark it out-of-scope rather than build it.

---

## OQ-11 — Which web detail page is the porting source of truth? — `OPEN` (recommend `/buy-cars/[slug]`)
**Raised by:** Pass 2 BUY (2026-08-31). **Blocks:** BUY-013, BUY-015, BUY-016, BUY-024.

Web has two live detail routes resolving the same slug against the same endpoint. `/vehicle/[id]` is self-documented as legacy (`src/app/vehicle/[id]/page.tsx:19-25`), is de-indexed and canonicals to `/buy-cars/` (L40-45) — but it is still linked from Home (`HomeClient.tsx:330`), Compare (`compare/page.tsx:296`), and the checkout cancel page (`cancel/page.tsx:90`), and it carries UI the canonical page does **not** have:

- a simulated `BidModal` with client-seeded fake bid history (`VehicleDetailPageClient.tsx:133-432`)
- an `EnquireModal` (structured dealer enquiry form)
- buyer counter-offer Accept/Decline (`VehicleDetailPageClient.tsx:710-737`) — the canonical page has none
- a dead "Unlock Full Report for £9.99" button with no onClick (`VehicleDetailPageClient.tsx:1354-1356`)

**My recommendation:** port from `/buy-cars/[slug]` only, and treat anything unique to `/vehicle/[id]` as legacy unless you say otherwise. The simulated bidding UI in particular must not be ported — mobile already has real auction bidding.

**Question:** confirm `/buy-cars/[slug]` is the source of truth, and confirm the counter-offer UI missing from it is a web gap rather than a deliberate removal (mobile already implements it correctly — BUY-024).

---

## OQ-12 — Is the mobile `transmissions` filter actually erroring? — `OPEN`
**Raised by:** Pass 2 BUY (2026-08-31). **Blocks:** BUY-006.

Mobile sends `SEMI_AUTO` (`SearchScreen.tsx:915`), which is not a member of the backend `TransmissionType` enum (`backend/prisma/schema.prisma:49-56`: `MANUAL, AUTOMATIC, CVT, SEMI_AUTOMATIC`). The `transmissions` DTO field has `@IsArray()` but **no** per-item `@IsEnum` (`listing-filter.dto.ts:92-96`), so the value is not rejected at validation and is passed to Prisma.

I did not run this. Prisma may throw on an out-of-enum value in an `in` filter (surfacing as a 500) or the query may simply match nothing.

**Question:** can you tap Semi-Auto in the mobile search filter on device and tell me what happens — error toast, or zero results? That determines whether BUY-006 is a P0 crash-level fix or a P1 silent-empty-results fix. Either way the fix is the same one-line enum correction plus adding the missing `CVT` option; the answer only changes its priority.

## OQ-13 — Which web create-listing flow is the porting source of truth? — `OPEN` (recommend `ListingWizard`)
**Raised by:** Pass 3 SELL (2026-08-31). **Blocks:** SELL-001 and, indirectly, every other SELL row.

Web has **two unrelated create-listing implementations**:

| | `ListingWizard.tsx` (3200 lines) | `DealerQuickList.tsx` (969 lines) |
|---|---|---|
| Reached from | `/sell`, `/dashboard/seller/add-listing` | `/dashboard/dealer/add-listing` |
| Photo minimum | 10 | 1 |
| Legal declarations | all 5 required | **none at all** |
| Auction scheduling | full step 4 | **none** — see below |
| DVLA lookup | optional, manual entry allowed | **hard gate** — the form does not render without a successful lookup |
| HPI upsell | yes | no |

Mobile's `SellCarFlowScreen.tsx` clearly mirrors `ListingWizard`, so that is my working assumption.

Two follow-on concerns I am **not** acting on without your say-so:
1. `DealerQuickList` lets a dealer select `listingType: 'AUCTION'` (`DealerQuickList.tsx:393-421`) but collects **no** reserve, starting bid, increment or start time, and never calls `POST /auctions` (grep: zero matches). That path appears to produce an auction-typed listing with no auction record. I did not verify what the backend does with it.
2. `DealerQuickList` omits every legal declaration, so those columns are left to server defaults for dealer-created listings.

**Question:** confirm `ListingWizard` is the source of truth for mobile parity, and tell me whether the two `DealerQuickList` issues above should be raised as separate web bugs (they are outside mobile-parity scope, so I have not logged them as matrix rows).

---

## OQ-14 — Mobile charges the listing fee before the publish gate can reject — `OPEN`
**Raised by:** Pass 3 SELL (2026-08-31). **Blocks:** SELL-005, SELL-006.

This is the most serious thing found so far, so I want your call on the fix before touching a payment path.

The backend rejects publish when a listing has fewer than 10 images:
`listings.service.ts:941-945` — `BadRequestException('Listings require at least 10 photos before publishing. You have N.')`

Web enforces this **before** payment, at the Media step (`ListingWizard.tsx:611`).

Mobile enforces only "at least one photo" (`SellCarFlowScreen.tsx:1344-1347`), then runs, in order (`SellCarFlowScreen.tsx:1528-1557`):
1. create the listing
2. `triggerListingFeePayment(...)` — **card is charged**, £1 / £10 / £25
3. `POST /listings/:id/publish` — **400s** if photos < 10
4. the `catch` alerts "Almost there!…" but **does not return**, so execution continues to
5. `clearDraft()` and a second alert: **"Published! / Your listing is now live."**

So a seller with 1-9 photos is charged, told the listing is live when it is not, and loses their draft.

Note mobile's *other* publish path already does this correctly — `SellerListingsScreen.tsx:331-380` calls publish first and only pays if the response says `requiresPayment`.

**Question:** which fix do you want?
- (a) Enforce ≥10 photos at the mobile Media step, matching web. Smallest change, matches the wizard.
- (b) Restructure the create flow to publish-then-pay like `SellerListingsScreen` already does. More correct, larger blast radius on a payment path.
- (c) Both.

I would do (c), with (a) first as the immediate stop-gap. Either way the missing `return` in the catch is a bug I would fix regardless.

---

## OQ-15 — `POST /damage/:listingId/save` has no ownership check — `OPEN` (backend security)
**Raised by:** Pass 3 SELL (2026-08-31). **Blocks:** nothing in mobile parity; logged because it was found while tracing SELL-012.

`POST /damage/:listingId/save` is guarded by `SessionAuthGuard` (any logged-in user) but the controller and `damage.service.ts` `saveDamageRecords` perform **no check that the caller owns the listing**. The handler deletes all existing `DamageRecord` rows for the given `listingId` and recreates them from the request body, then recomputes `Listing.exteriorGrade`.

As read, any authenticated user could overwrite any listing's damage records and change its displayed condition grade. I have **not** attempted this against a running server — this is a code reading, not a demonstrated exploit.

**Question:** want me to log this as a backend fix? It is outside mobile-parity scope and the working agreement says backend changes need an explicit callout, so I have not touched it.

---

## OQ-16 — Three different definitions of "listing complete" — `OPEN`
**Raised by:** Pass 3 SELL (2026-08-31). **Blocks:** SELL-031, SELL-004.

The product currently disagrees with itself about what a publishable listing is:

| Source | Rule |
|---|---|
| Backend `publishListing` | `images.length >= 10`. Nothing else. (`listings.service.ts:941-945`) |
| Web `ListingWizard` | 10 photos + 10 required detail fields + 5 declarations (`ListingWizard.tsx:598-611`) |
| Web dealer inventory gate | `images >= 1` + transmission + bodyType + description + condition (`inventory/page.tsx:26-44`) |
| Web `DealerQuickList` | 1 photo, no declarations (`DealerQuickList.tsx:211`) |
| Mobile `SellCarFlowScreen` | 1 photo + 8 required detail fields + 5 declarations (`SellCarFlowScreen.tsx:907,1344`) |

**Question:** what is the canonical rule? I need one answer to write mobile against, otherwise I am just picking a side. My assumption unless told otherwise is that `ListingWizard`'s rule is canonical and the backend gate is the minimum floor — but note that would mean the backend should also be validating the declarations it currently accepts as optional (`create-listing.dto.ts:350-373`).

## OQ-17 — Should a socket reconnect resync auction state? — `OPEN`
**Raised by:** Pass 4 AUCTION (2026-09-01). **Blocks:** AUC-004.

Neither client re-fetches auction state after a socket reconnect — both only re-emit `auction:join`, which subscribes to the room but replays nothing (`auction.gateway.ts:65-75`). Bids, cancellations and `auction:ended` that fired during the gap are lost.

On web the user can reload the page. Mobile's `AuctionDetailScreen` has **no manual refresh control at all**, so a missed `auction:ended` leaves the screen showing ACTIVE with a frozen `00:00:00` countdown, with no way to recover short of backing out and re-entering.

**Question:** is the fix (a) mobile-only — call `loadAuction()` inside the `reconnect` handler, or (b) shared — have the gateway send a state snapshot on `auction:join`? (b) is the more correct fix and would help web too, but it is a backend change, so I am not assuming it.

I would do (a) now regardless, since it is a few lines and entirely within mobile.

---

## OQ-18 — Mobile shows competing bidders' full names — `OPEN`
**Raised by:** Pass 4 AUCTION (2026-09-01). **Blocks:** AUC-012.

Web maps the bid list to **initials only** and discards the rest (`src/app/auctions/live/[id]/page.tsx:176`). Mobile builds a full name from the same payload and renders it in each bid row (`AuctionDetailScreen.tsx:296-306`, rendered at `:1369`).

The backend returns `bidder.firstName` / `lastName` on the REST payload, so both clients receive it; only web chooses not to display it. Over the socket, only `bidderInitials` is sent (`auction.gateway.ts:13-22`) — so mobile currently shows **full names for bids loaded on entry and initials for bids arriving live**, in the same list.

On a dealer-to-dealer auction platform this tells a dealer exactly who they are bidding against.

**Question:** confirm initials-only is the intended rule (web's behaviour and the socket payload both imply it is). If so this is a small mobile fix. If full names are intentional, the socket payload should carry them too so the list stops being inconsistent — but I would want that decision from you, as it is a disclosure question rather than a formatting one.

---

## OQ-19 — `reservePrice` is sent to every client — `OPEN` (backend)
**Raised by:** Pass 4 AUCTION (2026-09-01). **Blocks:** nothing in mobile parity; found while tracing AUC-015.

Both clients deliberately hide the reserve from buyers, and mobile documents this in comments (`AuctionDetailScreen.tsx:1098-1100,1296-1298`). But `AuctionsService.findOne` returns the whole auction row and does **not** strip `reservePrice` (`auctions.service.ts:240-287`), unlike seller contact details which have explicit gating (`gateSellerContactDetails`).

So the reserve — described in web's own copy as "never shown to bidders" (`src/app/auctions/page.tsx:454-455`) — is present in the API response and visible to anyone who opens dev tools or inspects the app's traffic. The confidentiality is presentational only.

I have **not** run a request to confirm this end to end; it is a reading of the service method.

**Question:** want this raised as a backend fix (gate `reservePrice` to the seller the way contact details are gated)? Backend change, so flagging rather than acting.

---

## OQ-20 — Which payment deadline is correct for auction winners? — `OPEN`
**Raised by:** Pass 4 AUCTION (2026-09-01). **Blocks:** AUC-022.

The backend reverts an unpaid win after **72 hours** — `BUYER_FEE_GRACE_MS = 72h` (`auctions.service.ts:23`), enforced hourly by `revertUnpaidWins` (`:618-689`). Web's cancel page states the same 72-hour rule (`src/app/checkout/cancel/page.tsx:69`).

Mobile shows three different things, none of them 72 hours:

| Path | Deadline shown |
|---|---|
| `AuctionCompleteScreen` fallback when no param passed | now + **24h** (`AuctionCompleteScreen.tsx:98-115`) |
| Socket win path (`AuctionDetailScreen.tsx:434`) | passes `paymentDeadline: undefined` → always hits the 24h fallback |
| `BuyerBidsScreen.tsx:115-117` | `auction.endTime + 24h` |

So a winner can be told they have hours left when they actually have days, and two entry points to the same screen disagree.

**Question:** confirm 72 hours from the auction end (i.e. from `wonAt`) is the rule to display. If so the fix is to pass a real deadline from both entry points and correct the fallback. I want confirmation because it is a countdown users will make decisions against, and I would rather not harmonise on the wrong number.

## OQ-21 — Which web dashboard is the porting source of truth? — `OPEN` (blocks most of Pass 5)
**Raised by:** Pass 5 DASHBOARDS (2026-09-01). **Blocks:** DASH-001 and, indirectly, DASH-004 through DASH-017.

Web has **two parallel dashboard implementations** and users only ever reach one of them.

**The reachable one:** `/dashboard` routes BUYER and SELLER to `/dashboard/user` (`src/app/dashboard/page.tsx:31-44`), a single tab-driven page. The sidebar links only to `/dashboard/user?tab=…` plus `/dashboard/seller/auctions` (`DashboardSidebar.tsx:134-150` — I grepped for other `dashboard/buyer` / `dashboard/seller/` hrefs and that auctions link is the only hit).

**The unreachable ones:** nine fully-built standalone pages, none linked from anywhere:
`/dashboard/buyer`, `/dashboard/buyer/history`, `/dashboard/buyer/settings`, `/dashboard/buyer/messages`, `/dashboard/seller`, `/dashboard/seller/earnings`, `/dashboard/seller/performance`, `/dashboard/seller/offers`, `/dashboard/seller/settings`.

These are not stubs, and several are **better than the live tabs**:

| Capability | Orphaned page | Unified `/dashboard/user` |
|---|---|---|
| 7d/30d period toggle | yes | **no** |
| Auction bonuses (£100) in earnings | yes | **no** |
| Delivery requests inside offers | yes | **no** |
| Cancel & relist after accepting | yes | **no** |
| Purchase history | yes (`buyer/history`) | **no tab at all** |

This matters because **mobile has implemented several features that only exist on the orphaned pages** — the period toggle (DASH-005), delivery requests in offers (DASH-017), cancel-and-relist (DASH-016), and the performance metric set (DASH-012). So mobile currently matches the *unreachable* web app in those places.

**Question:** which is canonical?
- (a) `/dashboard/user` is the future and the orphans are dead code to delete. Then mobile is ahead of live web in four places and I should leave it alone, but web loses features.
- (b) The orphans are the richer design and the unified page is the stopgap. Then web needs re-linking work and mobile is already correct.
- (c) They should be merged.

I am not guessing at this. It changes whether four mobile rows are "ahead", "correct", or "built against dead code".

---

## OQ-22 — Should mobile's notification list update live? — `OPEN`
**Raised by:** Pass 5 DASHBOARDS (2026-09-01). **Blocks:** DASH-019.

Mobile's real-time notification handling lives entirely in `GlobalToastProvider.tsx:80,107-108`, which connects to the `/notifications` namespace and raises a toast. `NotificationsScreen.tsx` has **no socket** (a grep for `io(` returns 0), so a notification arriving while the list is open shows a toast but does not appear in the list until manual pull-to-refresh.

Separately, `GlobalToastProvider.tsx:107-108` listens for both `notification:new` **and** `notification`. The gateway only ever emits `notification:new` (`notifications.gateway.ts:108`), so the second listener is dead code — harmless, but it suggests the event name was uncertain when written.

**Question:** is a toast considered sufficient, or should the list subscribe too? The fix is small (subscribe in the screen, or lift the socket into a store the screen reads), but it changes an app-wide provider, so I would rather you choose.

---

## OQ-23 — Dealer staff roles are collected but never enforced — `OPEN`
**Raised by:** Pass 5 DASHBOARDS (2026-09-01). **Blocks:** DASH-040.

Both apps let a dealer invite staff as `ADMIN`, `SALES_AGENT` or `FINANCE_MANAGER` (`DealerRole`, `schema.prisma:204-210`), and both render the role as a coloured label. Neither app branches any behaviour on it.

On the backend I could not find enforcement either. The staff-delegation pattern substitutes the owning `DealerProfile` for any active staff member regardless of role (`dealers.service.ts:38-56`, `dashboard.service.ts:144-155`), and the only place `staff.role` is read at all is to prevent removing the last ADMIN. Web's dealer layout treats every staff member as fully verified (`dealer/layout.tsx:146`), and mobile's `DealerGate` does the same (`components/DealerGate.tsx:51-54`).

As read, a `SALES_AGENT` appears to have the same access as an `ADMIN` — including Team management and Settings.

Caveat: I did not read `dealers.service.ts` in full, so enforcement may exist in a method I did not open. I am reporting what I could and could not find, not asserting a vulnerability.

**Question:** are the three roles meant to be labels only for now, or is per-role permission enforcement expected? If the latter it is a backend change and out of mobile-parity scope, but mobile should not pretend to enforce something the API does not.

---

## OQ-24 — Notification preferences: mobile works, web does not — `OPEN`
**Raised by:** Pass 5 DASHBOARDS (2026-09-01). **Blocks:** DASH-021.

The backend genuinely honours user notification preferences — mute-all, per-type keys, push channel and quiet hours are all checked before emitting or pushing (`notifications.service.ts:87-140`).

Mobile implements this properly: `NotificationSettingsScreen.tsx:66-113` loads from `GET /users/me` and saves via `PATCH /users/me`.

Web does not. Its dealer settings notification toggles have **no save handler at all** (`dashboard/dealer/settings/page.tsx:314-337`), and buyer settings uses uncontrolled `defaultChecked` boxes that are never included in the save payload (`buyer/settings/page.tsx:205-223`). Both are cosmetic.

**Question:** confirm mobile's implementation is the intended behaviour and the web toggles are the bug. If so this is not a mobile parity item at all, and I will mark DASH-021 as a web defect rather than leaving it as a mobile-ahead row — but I want your confirmation before recording that a shipped web control does nothing.

## OQ-25 — Web renders the wrong brand red — `OPEN` (web fix, mobile is correct)
**Raised by:** Pass 6 CROSS-CUTTING (2026-09-01). **Blocks:** CROSS-001, CROSS-002.

The design system states as a hard rule: *"The primary brand red is `#FF0037`, not the old `#ED1C24`"* (`CarMazium Design System/SKILL.md:47`), implemented as `--cz-primary: #ff0037` (`colors_and_type.css:13`).

- **Mobile: correct.** `accent = '#FF0037'` (`src/constants/colors.ts:39`).
- **Web: stale.** `--color-primary: #ed1c24` (`src/app/globals.css:6`). Same for secondary — design system `#2d3c63`, mobile `#2D3C63`, web `#1e293b`.

So the entire web app renders the superseded brand colour, and mobile is the conformant one.

Caveat: the design-system file is itself mid-migration — its `--gradient-vip-tab` (`colors_and_type.css:164`) and shadow tokens (`:77-79`) still contain `#ed1c24`, and `README.md:128` still says `#ed1c24` while `SKILL.md:47` says `#FF0037`. `THEME_MIGRATION_TODO.md` does not mention this divergence at all.

**Question:** confirm `#FF0037` is canonical and web is the thing to fix. This is out of mobile-parity scope so I will not touch it — I want it recorded so nobody later "corrects" mobile toward web and reintroduces the old red.

---

## OQ-26 — Fix the silent-failure pattern on mobile dashboards? — `OPEN`
**Raised by:** Pass 6 CROSS-CUTTING (2026-09-01). **Blocks:** CROSS-023, DASH-047.

Mobile dashboard screens almost universally catch fetch failures as `catch { /* show zeros */ }`. A failed request is therefore indistinguishable from real zero data: a dealer whose `/dealers/analytics` call fails sees a dashboard reporting zero sales, zero leads and zero revenue, with no error indicator and no retry.

Only `BuyerPurchaseHistoryScreen` and `EarningsScreen`'s Stripe flow surface an `ErrorBanner`.

The shared `ErrorBanner` component already exists and is used in 18 screens, so the fix is mechanical rather than architectural.

**Question:** do you want this as a dedicated Phase 2 flow (one pass over the dashboard screens adding error state + retry), or folded into each feature flow as I touch it? I would do it as one dedicated pass — it is a consistent mechanical change and doing it piecemeal means the app is half-fixed for a long time.

---

## OQ-27 — Pagination: which lists actually need it? — `OPEN`
**Raised by:** Pass 6 CROSS-CUTTING (2026-09-01). **Blocks:** CROSS-018, BUY-020.

Only `SearchScreen` paginates on mobile. Every other list fetches page 1 at a fixed limit and stops, with no indication anything is missing:

| Screen | Limit |
|---|---|
| `DealerPurchasesScreen.tsx:129` | 100 |
| `DealerInventoryScreen.tsx:572` | 50 |
| `DealerLeadsScreen.tsx:487` | 50 |
| `SellerListingsScreen.tsx:215` | 50 |
| `SellerAuctionsScreen.tsx:217,238` | 50 |
| `CompareScreen.tsx:124` | 30 |
| `MyListingDashboardScreen.tsx:125` | 20 |
| watchlist store (BUY-020) | 50 |

The backend imposes no `@Max` on `limit` (`listing-filter.dto.ts:209-214`), so raising the numbers is possible but only moves the cliff.

Web has the same problem on 10 pages, so this is not a mobile regression — but a dealer with 60 leads silently loses 10 of them on both platforms.

**Question:** which of these realistically exceed their limit for your users? I would prioritise dealer inventory, dealer leads and seller listings (a real dealership plausibly passes 50) and leave compare/dashboard previews alone, since those are deliberately capped previews. Tell me if that ranking is wrong.

---

## OQ-28 — Offline handling: in scope or not? — `OPEN`
**Raised by:** Pass 6 CROSS-CUTTING (2026-09-01). **Blocks:** CROSS-015.

Neither app has any network detection — no `@react-native-community/netinfo` dependency or usage on mobile, no `navigator.onLine` or service worker on web (all greps empty).

On mobile this bites harder: `src/lib/apiClient.ts` has no reachability branch, so an offline request rejects with a raw `TypeError: Network request failed` which is not one of the app's sentinels (`NO_SESSION` / `REQUEST_TIMEOUT` / `AUTH_REDIRECT`), and each screen renders it however it happens to handle unknown errors. There is no offline banner and no retry-on-reconnect.

Mobile also has a **shorter** timeout than web (10s vs 30s) and **no** retry wrapper, where web at least has `fetchWithRetry` for its auth cold-start path — so mobile is more exposed to backend cold starts than web is.

**Question:** is offline support in scope for this parity effort at all? It is arguably a mobile-native expectation rather than a web-parity item, so I have not assumed it. If yes, the minimum useful version is: add NetInfo, an offline banner, and an `OFFLINE` sentinel in `apiClient` so screens can distinguish it — I would not attempt request queueing or cached reads without a separate discussion.

---

## OQ-29 — Two more dead screens: revive or delete? — `OPEN`
**Raised by:** Pass 6 CROSS-CUTTING (2026-09-01). **Blocks:** CROSS-021, BUY-021, DASH-004.

Two mobile screens are registered but unreachable — zero `navigate()` call sites and absent from the 33 `stackScreen` targets in `GlobalDrawer.tsx`:

1. **`WatchlistScreen.tsx`** (146 lines, BUY-021) — duplicates the live `SavedScreen` from the same store.
2. **`BuyerDashboardScreen.tsx`** (624 lines, CROSS-021) — and this one matters more, because it holds a **richer buyer tile set** (ACTIVE OFFERS, WATCHING, LIVE BIDS, AUCTIONS WON, TOTAL SPENT) plus a 7d/30d period toggle that the live `UnifiedDashboardScreen` does not have. I have amended DASH-004 accordingly.

For contrast, `UnifiedDashboardScreen`'s stack route is also never navigated to, but the component **is** live because `TabNavigator.tsx:29` renders it directly — so route-deadness and screen-deadness are not the same thing here.

**Question:** for each — delete, or wire up? `BuyerDashboardScreen` looks like the better buyer dashboard that simply never got connected; if you want it, wiring it up is small and would also settle DASH-004's "which tile set is canonical" question.
