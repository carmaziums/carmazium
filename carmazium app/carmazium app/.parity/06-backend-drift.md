# Backend Drift Audit — Mobile Parity

Scope: commits touching `backend/` since 2026-06-01, cross-checked against
`carmazium app/carmazium app/src/lib/*Api.ts` and the consuming screens.
Web (`src/`) used as the "how should this be consumed" reference per CLAUDE.md.

---

## 1. `53c5acca` — mandatory location + postcode fields on profile

**Backend contract**: `backend/prisma/schema.prisma` `User.postcode String?` (new,
optional at DB level). `backend/src/users/users.controller.ts:54-57` and
`backend/src/users/users.service.ts:111-139` accept `postcode` on `PATCH /users/me`
as a plain inline object type (no class-validator DTO), so `forbidNonWhitelisted`
does **not** apply here — extra/missing fields are silently ignored server-side.
"Mandatory" is enforced only in the web app's UI (onboarding gate +
`LocationPromptModal.tsx` one-time popup for existing accounts missing either field).

**Mobile today**:
- `src/screens/auth/PostSignupOnboardingScreen.tsx:157-324` collects and sends
  `postcode` (normalised into `location`) for **new signups only**.
- No equivalent of web's `LocationPromptModal` — a one-time popup that catches
  **existing** accounts that predate the mandatory-field rollout and are missing
  `location`/`postcode`. Grepped `src/` for `LocationPrompt` / "missing location":
  no match outside `VehicleDetailScreen.tsx` (unrelated usage).

**VERDICT: NOT ADAPTED (P1).** Not a 400/whitelist break (field is optional
server-side), but existing mobile users who signed up before this change have no
path to ever be prompted for postcode on mobile — silently diverges from web's
"nag until they fill it in" behavior. Add a startup/dashboard check (e.g. on app
launch, if `user.location` or `user.postcode` is falsy, show a blocking modal)
mirroring `src/components/features/LocationPromptModal.tsx`.

---

## 2. `3bfb498e` + `d5165935` — auctions require fresh admin review whenever scheduled

**Backend contract**: `backend/src/auctions/auctions.service.ts` `create()`
(~line 88-95) now force-flips the underlying `Listing.status` back to
`PENDING_REVIEW` whenever a new auction is scheduled and the listing isn't
already `PENDING_REVIEW` — covers both "new auction listing via wizard" and
"existing ACTIVE listing put up for auction directly via `POST /auctions`".
`auction-lifecycle.service.ts` cron only activates `SCHEDULED → ACTIVE` when
`listing.status === 'ACTIVE'`. `CreateAuctionDto` (`backend/src/auctions/dto/create-auction.dto.ts`)
is unchanged: `listingId, startTime, reservePrice, startingBid, minIncrement?, buyItNowPrice?`.

**Mobile today**: `src/screens/sell/SellCarFlowScreen.tsx:1474-1490` builds
`auctionPayload` with exactly `listingId, reservePrice, startingBid, minIncrement,
buyItNowPrice?, startTime` — matches the DTO field-for-field, no stray keys.
`src/screens/seller/SellerAuctionsScreen.tsx:735` (schedule-auction-on-existing-listing
path) also posts to `/auctions`. This gate is entirely server-side and
transparent to the client — no new field to send.

**VERDICT: ADAPTED / N/A.** Payload is correct either way. Cosmetic gap: mobile
doesn't explicitly tell the seller "your auction now needs re-review" after
scheduling (web added review-queue visibility in the admin panel only — no
buyer/seller-facing copy change was in this commit either), so no action needed
beyond confirming the publish success alert doesn't overclaim the listing is live.

---

## 3. `0517f642` — auto-revert unpaid auction wins (`Auction.wonAt` + cron)

**Backend contract**: `backend/prisma/schema.prisma` `Auction.wonAt DateTime?`
(new). Hourly cron (`backend/src/tasks/unpaid-auction-fee-expiry.service.ts`)
reverts any `ENDED` auction with `winnerId` set, `buyerFeePaid: false`, and
`wonAt` older than 72h: auction → `CANCELLED`, listing → `ACTIVE`, `Sale` row
deleted, seller `totalSales` decremented, and both parties get a
`type: 'AUCTION_WIN_EXPIRED'` notification (`backend/src/auctions/auctions.service.ts:544-627`).
Also: `payments.service.ts:223` — Stripe Checkout `cancel_url` now carries
`&type=${type}` (web-only checkout-redirect flow).

**Mobile today**:
- `src/lib/notificationsApi.ts:64-75` `notifStyle()` switch has no case for
  `AUCTION_WIN_EXPIRED` — falls through to `default` (generic bell icon, no
  color). Not a crash; cosmetic only.
- Mobile uses Stripe Payment Sheet (`src/lib/paymentsApi.ts` / `PurchaseFlowScreen.tsx`),
  not the web's redirect-based Checkout Session, so the `cancel_url` query-param
  change is N/A to mobile.
- No dedicated UI path found for surfacing "your win was cancelled — the vehicle
  relisted" beyond the generic notification list/detail.

**VERDICT: ADAPTED with a P2 gap.** Behavior is correct (mobile will show the
notification with generic styling); add an `AUCTION_WIN_EXPIRED` case to
`notifStyle()` for icon/color parity — cosmetic, not urgent.

---

## 4. `84437cd8` — payout tracking fixes (`stripeRefundError`, `manualPayoutConfirmedAt`)

**Backend contract**: `backend/prisma/schema.prisma` `Auction` gains
`manualPayoutConfirmedAt DateTime?` (this commit) and `stripeRefundError String?`
(from `2952f759`, same window). New admin-only endpoints
`GET /admin/payouts/pending`, `POST /admin/payouts/:id/retry`,
`POST /admin/payouts/:id/mark-paid` (`backend/src/admin/admin.controller.ts:199-224`).
Response fields `sellerBonusReleased`, `stripePayoutError` on `Auction` are what
sellers see; "paid" now correctly means `stripePayoutTransferId` OR
`manualPayoutConfirmedAt` is set, not just `sellerBonusReleased`.

**Mobile today**: `src/screens/seller/SellerAuctionsScreen.tsx:932-964` already
gates the UI on `item.stripePayoutError` (shows "Payout failed — …") before
falling back to `item.sellerBonusReleased` ("£100 payout released") — i.e. it
never claims "paid" purely off `sellerBonusReleased`, matching the bug fix's
intent. `src/lib/auctionApi.ts:103-104` types both fields.

**VERDICT: ADAPTED.** Mobile's existing logic already avoids the exact bug this
commit fixed on web (no need for `manualPayoutConfirmedAt` client-side since
mobile relies on `stripePayoutError` presence/absence, which the backend keeps
accurate). No mobile-side admin surface exists or is needed (admin panel is
web-only by design).

---

## 5. `11f96bf1` — include listing status in `getReceivedOffers`

**Backend contract**: `backend/src/offers/offers.service.ts:826-829` — the
`listing` relation on `GET /offers/received` (dealer/seller offers list) now
selects `status` in addition to `id/title/slug/vrm/price`. Purpose: let clients
hide "Mark as Sold" on an `ACCEPTED` offer whose listing is already `SOLD`
(e.g. sold via a different offer).

**Mobile today**:
- `src/screens/main/DealerOffersScreen.tsx:537,543` — **correctly** gates:
  `offer.status === 'ACCEPTED' && offer.listing?.status === 'SOLD'` shows a
  "already sold" state, and `!== 'SOLD'` shows the Mark as Sold button. ADAPTED.
- `src/screens/seller/SellerOffersScreen.tsx:551` — `offer.status === 'ACCEPTED'`
  is the **only** condition; it renders the Message/Mark as Sold/Cancel & Relist
  row unconditionally, with no `offer.listing?.status` check at all. A seller
  with two accepted offers on one listing (or a listing sold through another
  channel) still sees a live "Mark as Sold" button that will hit a backend
  rejection on tap.

**VERDICT: NOT ADAPTED for `SellerOffersScreen.tsx` (P1 — UX/logic bug, not a
400-whitelist break since the backend itself still correctly rejects the second
sale; but it's the exact broken affordance this commit's message describes,
just left unfixed on the seller side of mobile).** Fix: mirror
`DealerOffersScreen.tsx:537-563`'s `offer.listing?.status === 'SOLD'` gate in
`SellerOffersScreen.tsx` around line 551.

---

## 6. `ea1e2078` — chat `findOrCreateRoom` re-points room at a new listing

**Backend contract**: `backend/src/chat/chat.service.ts` — `findOrCreateRoom`
now updates `ChatRoom.listingId` when a different `listingId` is passed for an
existing initiator/participant pair, and runs the £125 buyer-fee gate
(`assertCanReferenceListing`) on that re-point path too, not just on first
creation. Purely server-side; `POST /chat/rooms` request shape unchanged
(`participantId`, optional `listingId`).

**Mobile today**: `src/lib/chatApi.ts:82` `createChatRoom(participantId, listingId?)`
already forwards `listingId` on every call — confirmed no mobile-side caching of
listingId that would suppress the re-point. Mobile automatically benefits from
this fix with no client changes needed.

**VERDICT: ADAPTED / N/A.**

---

## 7. `25869c5d` + `05cfe7e4` + `8f54f6e9` — seller contact info gated on live auction page

**Backend contract** (evolved across 3 commits): `GET /auctions/:id`
(`backend/src/auctions/auctions.service.ts:findOne`, now via
`OptionalSessionAuthGuard`) returns `listing.seller.{phone, email}` plus
`dealerProfile.{phone, businessAddress, website}` **only when**
`viewerId === auction.winnerId && auction.buyerFeePaid === true`; otherwise all
of those are `null` with sibling `*Available` booleans (`phoneAvailable`,
`emailAvailable`, `businessAddressAvailable`, `websiteAvailable`) telling the
client whether to render a locked/blurred placeholder vs. nothing. Final state
(`8f54f6e9`) tightened email too — previously any logged-in viewer could see
email; now email requires win+paid like phone. `findAllActive`/`findAllScheduled`
apply the same phone gate (`auctions.service.ts:336-361`).

**Mobile today**: Grepped `src/screens/vehicle/AuctionDetailScreen.tsx` and
`src/screens/main/PurchaseFlowScreen.tsx` / `BuyerDashboardScreen.tsx` for
`phone`/`Call Seller`/`Linking` — **no matches**. Mobile's live-auction detail
screen shows only `seller.firstName`/`lastName` (lines 932, 1441); it never
requests or renders `phone`, `email`, `phoneAvailable`, `businessAddress`, or
`website` at all — there is no seller-contact UI, blurred or otherwise,
anywhere in the auction flow, and no "Call Seller" button on the
won-auctions/purchase-flow screens (web added this in `05cfe7e4`).

**VERDICT: NOT ADAPTED (P1 — missing capability, not broken).** Nothing crashes
(mobile simply never reads these response fields), but mobile is missing an
entire feature web now has: seller phone/email/business-address/website display
on the live auction page (blurred pre-win) and a "Call Seller" button on the
won-auction list post-payment. Since the backend already computes and gates
these fields correctly, mobile just needs to consume `auction.listing.seller.phone`
+ `phoneAvailable` (and the email/address/website siblings) and add the UI —
no backend risk either way.

---

## 8. `18671935` — chat missing `otherUser` root-caused

**Backend contract**: `backend/src/chat/chat.service.ts` — `findOrCreateRoom`,
`getRoom`, and `getUserRooms` now share a `roomInclude` + `withOtherUser()`
helper so **every** path returns a populated `otherUser` field, not just
`getUserRooms`. Previously `findOrCreateRoom` returned a bare `ChatRoom` row
with `otherUser` undefined, crashing any component that read
`room.otherUser.id` without optional chaining.

**Mobile today**: `src/lib/chatApi.ts:40` types `otherUser: ChatUser` (non-optional,
matches the now-guaranteed shape). `src/screens/main/ChatScreen.tsx:270,275,280,292`
still read `room.otherUser.id` unguarded in some places — but this now matches
reality since the backend fix guarantees `otherUser` is always populated on
every code path that returns a room (create, fetch, list). Pre-fix, this same
mobile code would have crashed on a freshly-created room; post-fix it's safe
because the root cause (backend) is fixed, exactly as the commit intended
("fixed the remaining unguarded accesses on the frontend as defense in depth" —
web did this too, mobile didn't, but is protected by the backend guarantee either way).

**VERDICT: ADAPTED (server-side fix; mobile inherits correctness automatically).**
Minor defense-in-depth gap (mobile lacks the optional-chaining web added on top),
but no live bug — P2 at most.

---

## 9. `2952f759` — failed buyer-fee refund on handover denial

**Backend contract**: `backend/prisma/schema.prisma` `Auction.stripeRefundError
String?` (new). `backend/src/admin/admin.service.ts` `denyHandover()` — refund
failures are now persisted + notify all admins, instead of being
`console.error`-only. Entirely admin-panel/server-side; no client-facing
request/response shape change for buyer or seller apps.

**Mobile today**: N/A — no mobile surface touches handover denial or refund
status directly beyond the existing notification list (buyer already gets a
"handover denied" type notification through the existing generic path; this
commit didn't add a new notification type for buyers/sellers, only for admins).

**VERDICT: N/A.**

---

## Other drift found while walking the log (not in your suspect list)

### `AdminUpdateListingDto` field expansion (`0517f642`)
Admin-only DTO gained ~45 fields (`priceMin/priceMax`, `variant`, `driveType`,
`engineSize`, DVLA fields, `features`, delivery fields, etc.) mirroring
`CreateListingDto`. This is the **admin correction form**, not the seller-facing
`CreateListingDto`/`UpdateListingDto` mobile uses to publish listings — verified
`backend/src/listings/dto/update-listing.dto.ts` is still `PartialType(CreateListingDto)`,
unchanged shape. **N/A to mobile.**

### `CreateListingDto` field inventory cross-check (P0 whitelist risk — clean)
Diffed every field in the current `backend/src/listings/dto/create-listing.dto.ts`
against the payload object mobile builds in
`src/screens/sell/SellCarFlowScreen.tsx:1345-1390`. All ~55 keys mobile sends
(`vehicleType, vrm, vin, make, model, year, bodyType, location, mileage,
fuelType, transmission, color, engineSize, bhp, doors, seats, variant,
driveType, serviceHistory, numberOfKeys, zeroTo60Mph, topSpeedMph, torqueNm,
combinedMpg, extraUrbanMpg, ulezCompliant, euroStandard, co2Emissions, features,
title, description, condition, owners, isImported, markedForExport,
isDepartedSale, departedRelationship, writeOffCategory, stolenRecovered,
hasOutstandingFinance, isLegalRegisteredKeeper, notOwnerRelationship, images,
videoUrls, priceMin, price, priceMax, bannerLabel, deliveryAvailable,
deliveryMaxMiles, deliveryPricePerMile, badgeTier, listingType, motStatus,
taxStatus, motExpiryDate, taxDueDate, monthOfFirstRegistration, wheelplan,
typeApproval`) exist on the current DTO. **No stray fields, no missing required
field.** The 2026-07-06 whitelist-break incident referenced in CLAUDE.md appears
fully resolved and has not regressed. `Object.keys(payload).forEach(k =>
payload[k] === undefined && delete payload[k])` at line 1392 correctly strips
`undefined` before serializing, avoiding `IsOptional` fields being sent as
`null`/`undefined` literals.

### Damage-record payload (mentioned in code, verified correct)
`src/screens/sell/SellCarFlowScreen.tsx:1400-1432` sends `part/type/size/coords/imageUrl`
to `POST /damage/:id/save`, matching `damage.service.ts`'s destructured fields —
confirmed already fixed per the inline comment, no drift found.

### Image cap
No `ArrayMaxSize`/hard cap found in `CreateListingDto` on `images` — backend
imposes no server-side image count limit. Mobile self-caps the wizard's progress
bar at 20 (`SellCarFlowScreen.tsx:2190`, `totalCount / 20`), web's `0b67b894`
commit references a "100-photo limit" as a **UI** cap, `8f54f6e9` raised
`CardImageCarousel`'s **slider display** cap (unrelated to upload limits). This
is a UX/feature-parity gap (mobile artificially caps sellers at 20 vs web's
100), not a backend contract issue. **P2.**

---

## Summary Table

| # | Commit(s) | Area | Verdict | Priority |
|---|---|---|---|---|
| 1 | 53c5acca | Existing-user postcode nag popup | NOT ADAPTED | P1 |
| 2 | 3bfb498e, d5165935 | Auction re-review gate | ADAPTED/N/A | — |
| 3 | 0517f642 | Auction win auto-revert + notif type | ADAPTED (cosmetic gap) | P2 |
| 4 | 84437cd8 | Payout tracking accuracy | ADAPTED | — |
| 5 | 11f96bf1 | listing.status in received offers | **NOT ADAPTED** (SellerOffersScreen) | **P1** |
| 6 | ea1e2078 | Chat room re-point on new listing | ADAPTED/N/A | — |
| 7 | 25869c5d, 05cfe7e4, 8f54f6e9 | Seller contact gating on live auction | **NOT ADAPTED** (feature missing) | **P1** |
| 8 | 18671935 | Chat otherUser root-cause fix | ADAPTED | — |
| 9 | 2952f759 | Refund-failure tracking (admin-only) | N/A | — |
| — | CreateListingDto whitelist check | Publish payload | ADAPTED (verified clean) | — |
| — | Image cap | Upload limit | Mobile under-caps (20 vs 100) | P2 |

**No P0s found.** No mobile request currently sends a field the backend DTOs
reject, and no currently-required backend field is missing from a mobile
request. The `forbidNonWhitelisted` whitelist incident referenced in CLAUDE.md
has not regressed. All findings are P1 (missing capability / stale UI gate) or
P2 (cosmetic/UX parity), concentrated in: (1) no re-prompt for existing users
missing postcode, (2) `SellerOffersScreen.tsx` missing the sold-listing gate on
"Mark as Sold" that `DealerOffersScreen.tsx` already has, and (3) mobile never
consumes the seller phone/email/business-contact fields the backend now exposes
(gated) on the live auction page and won-auctions list.
