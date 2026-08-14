# Vehicle Detail Screen — Web vs Mobile Field Diff

Sources read in full:
- Web: `src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx` (1439 lines) — canonical vehicle detail page. `src/app/vehicle/[id]/page.tsx` is a thin SEO-redirect wrapper (56 lines) that renders the same slug via `/buy-cars/`, confirmed by its own code comment (lines 19-25): "renders the exact same listing as `/buy-cars/[slug]`... kept around because several places in the app still link here."
- Web sub-component: `src/components/features/FinanceCalculator.tsx` (APR 9–49% slider, 19% default).
- Mobile: `carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx` (3149 lines, read in full).
- Mobile data layer: `carmazium app/carmazium app/src/lib/listingsApi.ts` (`ApiListing` interface + `mapApiListingToCarListing`), `carmazium app/carmazium app/src/data/listings.ts` (`CarListing` interface).
- Backend: `backend/src/listings/listings.service.ts` `findBySlug()` (lines 565-696, used by both web routes and by mobile's `GET /listings/:id`), `backend/prisma/schema.prisma` `Listing` model (~lines 560-720) and enums (`BodyType` 145-161, `VehicleCondition` 163-172).

## 1. Field inventory table

| Field / section | Web location | Backend provides it? | Mobile mapper carries it? | Mobile renders it? | Verdict |
|---|---|---|---|---|---|
| Title, price | `VehicleDetailsPageClient.tsx:561,801` | Yes (`listing.title/price`) | `listingsApi.ts:198-202` | `VehicleDetailScreen.tsx:695,738` | PRESENT |
| Make/Model/Year | `:944-946` | Yes | `:198-201` | `:696,832` | PRESENT |
| Body type (raw enum label, e.g. "Coupé"/"MPV"/"Van") | `:547,947` via `BODY_TYPE_LABELS` (13-value `BodyType` enum, schema.prisma:145-161) | Yes (`listing.bodyType`) | `ApiListing.bodyType` declared (`listingsApi.ts:16`) but `mapApiListingToCarListing` only feeds it into `mapCategory()` (`:206`), which collapses 13 enum values into 6 buckets (`Sports\|SUV\|Saloon\|Convertible\|Supercar\|Estate`) — `CarListing` has **no raw bodyType field at all** (`data/listings.ts:15-94`) | `:969-972` shows `listing.category` (the lossy 6-bucket value), not the real enum | MISSING-DATA-DROPPED-BY-MAPPER (precision loss: MPV/Van/Hatchback/Crossover/Pickup/Minivan/Station Wagon listings all get relabeled into one of 6 buckets, several with no true equivalent) |
| Condition (raw enum: EXCELLENT/GOOD/FAIR/POOR/CAT_S/CAT_N) | `:950` `listing.condition.replace('_',' ')` | Yes (`VehicleCondition` enum, schema.prisma:164-172, 6 values incl. CAT_S/CAT_N insurance categories) | `mapCondition()` (`listingsApi.ts:180-188`) collapses to only 2 of `CarListing['condition']`'s 3 possible values (`Used`/`Certified Pre-Owned`) — CAT_S/CAT_N/FAIR/POOR all silently become "Used"; "New" is never reachable from the mapper | Not rendered anywhere (no `condition` spec row in `VehicleDetailScreen.tsx`) | MISSING-DATA-DROPPED-BY-MAPPER |
| Mileage | `:949` | Yes | `:203` | `:836-838` | PRESENT |
| Colour | `:948` `listing.color` | Yes | `:208` (`colour`) | `:1045-1046` | PRESENT |
| Registration (VRM) | `:951` `listing.vrm` | Yes (`listing.vrm`, referenced `listings.service.ts` selects) | `ApiListing` has no `vrm` field declared at all (only accessed via `(listing as any).vrm` at `VehicleDetailScreen.tsx:445` for the HPI-checkout payload); `CarListing` has no `vrm` field | Not shown in the spec grid — only ever surfaces inside the paid HPI report modal (`hpiData.vrm`, `:1732`) | MISSING-DATA-DROPPED-BY-MAPPER (mobile has no free-tier registration display) |
| Reg. date (month of first registration) | `:952` | Yes (`monthOfFirstRegistration`, schema.prisma:634) | Mapped (`listingsApi.ts:252`) | Not rendered — no match anywhere in `VehicleDetailScreen.tsx` | MISSING-BUT-AVAILABLE |
| Previous owners | `:953-960` | Yes | `:245` (`owners`) | `:1029-1035`, `:1094-1098` | PRESENT |
| Fuel type | `:968` | Yes | `:204` | `:842` | PRESENT |
| CO2 emissions | `:969` | Yes | `:215` | `:1013-1017` | PRESENT |
| ULEZ compliant | `:970` `listing.ulezCompliant` | Yes (`ulezCompliant Boolean?`, schema.prisma:625) | `ApiListing.ulezCompliant` declared (`listingsApi.ts:85`) but **never assigned in `mapApiListingToCarListing`**, and `CarListing` has no `ulezCompliant` field to hold it | Not rendered | MISSING-DATA-DROPPED-BY-MAPPER |
| Euro standard | `:971` `listing.euroStandard` | Yes (`EuroStandard?`, schema.prisma:626) | Same as ULEZ — declared on `ApiListing` (`:86`) but not mapped, `CarListing` has no field | Not rendered | MISSING-DATA-DROPPED-BY-MAPPER |
| Gearbox / Transmission | `:979` | Yes | `:205` | `:845-848` | PRESENT |
| Engine size | `:980` | Yes | `:212` | `:980` (own file) | PRESENT |
| Horsepower / BHP | `:981` | Yes | `:209` | `:981` | PRESENT |
| Torque (Nm) | Not shown on web at all (no torque row in `VehicleDetailsPageClient.tsx`) | Yes (`torqueNm`) | `:216` | `:998-1003` | Mobile shows a field web doesn't (not a gap) |
| 0-60 mph | Not shown on web (no acceleration row) | Yes (`zeroTo60Mph`) | `:210` | `:985-987` | Mobile ahead of web here |
| Top speed | Not shown on web | Yes (`topSpeedMph`) | `:211` | `:992-996` | Mobile ahead of web here |
| Combined / extra-urban MPG | Not shown on web | Yes | `:217-218` | `:1018-1026` | Mobile ahead of web here |
| Doors | `:989` | Yes | `:213` | `:1005-1010` | PRESENT |
| Seats | `:990` | Yes | `:214` | `:1005-1010` | PRESENT |
| Wheelplan | `:991` | Yes (schema.prisma:635) | Mapped (`listingsApi.ts:250`) | Not rendered — no match in screen | MISSING-BUT-AVAILABLE |
| Type approval | Web spec table doesn't render `typeApproval` either (only `wheelplan` shown at `:991`, no `typeApproval` row found in web file) | Yes (schema.prisma:636) | Mapped (`:251`) | Not rendered | MISSING-NO-DATA-ON-WEB-EITHER (not a mobile-specific gap) |
| MOT status | `:999` | Yes | `:241` | `:1099-1108` | PRESENT |
| MOT expiry | `:1000` | Yes | `:242` | `:1036-1043` | PRESENT |
| Tax status | `:1001` | Yes | `:243` | `:1109-1118` | PRESENT |
| Tax due date | `:1002` | Yes | `:244` | Mapped but not rendered — no `taxDueDate` match in screen | MISSING-BUT-AVAILABLE |
| Service history | `:989` implied via owners? No dedicated row on web either (only used in mobile) — web doesn't render `serviceHistory` explicitly | Yes | `:246` | `:1032` (appended in parens after owner count) | Mobile ahead of web here |
| Write-off category | Not shown on web spec table (only implied via general "Condition") — no explicit write-off row on web | Yes | `:247` | `:1058-1067` | Mobile ahead of web here |
| Stolen/recovered marker | Not on web | Yes | `:248` | `:1081-1091` | Mobile ahead of web here |
| Outstanding finance | Not on web | Yes | `:249` | `:1069-1080` | Mobile ahead of web here |
| Description | `:853-871` | Yes | `:226` | `:874-880` | PRESENT (mobile has no expand/collapse truncation, shows in full — fine) |
| Video URLs (YouTube/IG/FB/X) | `:874-916` | Yes | `:239` | `:920-962` | PRESENT, functionally equivalent |
| Features list | `:918-933` (always expanded) | Yes | `:227` | `:887-916` (collapsed by default, tap to expand — deliberate mobile UX choice per code comment "Prompt M1") | PRESENT (cosmetic difference only) |
| 3D Damage map + damage list | `:1008-1076` (`ThreeDVehicleViewer`) | Yes (`damageRecords` include) | n/a (fetched separately via `/damage/{id}`) | `BuyerDamageViewer` (`:1191`) | PRESENT — parity component exists |
| Exterior grade | Computed server-side, shown as a chip on web (`:1013-1023`) | Yes | `:230` | `GradeChip` (`:1189`) | PRESENT |
| HPI Report | `:1078-1097` (button opens `HpiReportModal`, no visible price on the CTA itself) | N/A (paid feature, triggered via Stripe) | n/a | `:1122-1181`, plus full checkout flow (`handleHpiCheck`, `:435-461`) and result rendering (stolen/finance/write-off/mileage anomaly, `:1130-1149`) | PRESENT — mobile is functionally ahead (shows checkout price £9.99 and inline summary fields web's CTA doesn't preview) |
| Finance calculator | `FinanceCalculator.tsx` — fully interactive: deposit slider (£0 to 50% of price), term buttons (12/24/36/48/60mo), **APR slider 9–49%** (default 19%), live monthly payment | Client-side only, no backend field | n/a | `VehicleDetailScreen.tsx:1255-1333` — card explicitly labeled **"Coming Soon"** (`:1274` badge, `:1289` overlay text: "Finance options will be available here. Contact the seller directly to discuss finance."); the deposit/term step rows are rendered at `opacity: 0.4` and are **inert** (no `onPress` handlers wire them to `depositPct`/`termMonths` setters — they're static "preview" UI only) | **P0 — mobile actively disables a feature web ships fully working.** No APR control exists on mobile at all; only a static "19% APR representative" subtitle (`:1269`) computed by the still-functioning `calcMonthlyPayment()` (`:489-497`) that IS used for the top-line "or £X/mo" figure (`:741-745`), but the buyer cannot interact with or adjust it. |
| Delivery availability + radius + fee | `:1294-1338` (tiered client-computed fee: £30 flat ≤10mi, £2/mi 10-30mi, £1.50/mi beyond, ×1.2 "VAT") | `deliveryAvailable`, `deliveryMaxMiles`, `deliveryPricePerMile` | `:235-237` | `:1344-1450+` (server-computed real quote via `getDeliveryQuote`, replacing web's fabricated tiered/VAT formula per code comment `:167-172`) | PRESENT — mobile is arguably more correct (web's formula is a client-side approximation the mobile code comment explicitly calls out as not matching what the backend actually charges) |
| Imported-from badge/link | `:634-644` | `importedFromUrl`, `importedSource` | `:231-232` | `:809-826` | PRESENT |
| Linked live-auction cross-link | `:780-794`, `:1207-1221` | `linkedListingId`, `linkedListing` | `:233-234` | `:852-869`, `handleOpenLinkedAuction` | PRESENT, mobile fetches the full linked listing before navigating (fixes a dead alert() the web equivalent doesn't have to worry about) |
| Buy It Now (auction) | `:1274-1292` | `listing.auction.buyItNowPrice`, reserve fields | N/A — not surfaced in `CarListing`/mapper at all (auction-specific fields live on a separate `AuctionListing` type in `data/listings.ts:96-111`) | Not found in `VehicleDetailScreen.tsx` for the plain listing-detail path — grep for `buyItNowPrice`/reserve returned nothing in this screen | UNVERIFIED as MISSING — could be handled entirely by a separate `LiveAuctionDetailed` screen for auction-type listings (mobile routes there instead of showing BIN inline); could not confirm within budget which screen a non-auction viewer of an AUCTION-type classified listing lands on from `VehicleDetail`. Flagging as a gap to verify, not asserting MISSING-NO-DATA. |
| Offer status chip (buyer/seller/public wording) | `:35-101`, rendered `:808-815`, `:1245-1252` | `offers` include (latest offer) | n/a, fetched live via `/offers/my/:id` and `/offers/listing/:id` | `:761-807` (buyer chip), `:747-756` (public "last offer" teaser) | PRESENT, near-verbatim wording match (code comments cite exact web line numbers) |
| Seller name / verified badge | `:721-753`, `:1110-1143` | Yes | `dealer` string only (`:222`) | `:1213-1223` | PRESENT but degraded: web shows separate "Verified Dealer" (blue) vs "Verified Seller" (emerald) distinction with different icon colors (`:738-748`); mobile shows one generic blue checkmark regardless of dealer/private (`:1216`) — P2 cosmetic |
| Seller listing count ("N active listings") | `:1152-1156` `listing.seller.listingCount` | Yes — backend explicitly computes this (`listings.service.ts:671-673`: "Map _count to listingCount on seller") | **`ApiListing.seller` type (`listingsApi.ts:33-39`) never declares `listingCount`, and `mapApiListingToCarListing`'s `CarListing.seller` output is hardcoded to `{ id: string }` only (`data/listings.ts:57`, `listingsApi.ts:228`)** | Not rendered (there is no `seller.listingCount` in `VehicleDetailScreen.tsx`; `listing.dealer` is a flat string, not an object with more fields) | MISSING-DATA-DROPPED-BY-MAPPER |
| Seller phone (dealer + private, login-gated) | `:1167-1191` `BlurredPhone` | Yes, gated server-side in `findBySlug` (`listings.service.ts:678-691`) | n/a — mobile calls a **separate** endpoint `GET /sellers/:id/phone` (`VehicleDetailScreen.tsx:356-368`) rather than reading it off the listing payload | `:1224-1236` | PRESENT via an alternate but equivalent path |
| Dealer profile (description, website, logo) | `:757-775`, `:1161-1181` | Yes (`dealerProfile` include) | **Not present anywhere in `ApiListing` or `CarListing`** — no `dealerProfile` field of any kind on the mobile listing types | Not rendered — no dealer description, no "Visit Website" link, no dealer logo anywhere in `VehicleDetailScreen.tsx` | MISSING-DATA-DROPPED-BY-MAPPER |
| Badge tier trust chips (Verified / VIN Report / Condition Check / Stolen Check / Finance Check, tier-gated) | `:585-624` | Yes (`badgeTier`) | `:240` (`badgeTier` mapped) | Data is present on `CarListing.badgeTier` but **no chip rendering was found anywhere in `VehicleDetailScreen.tsx`** (only a generic "✓ VERIFIED" text pill gated on `isSellerVerified`, `:680-684`, which is a different, coarser signal) | MISSING-BUT-AVAILABLE |
| Featured badge | `:582-584` `<FeaturedBadge compact />` | Yes (`isFeatured`) | `:224` | No `FeaturedBadge`-equivalent or "Featured" chip found on the detail screen (only used on listing cards elsewhere per earlier grep of `VehicleCard.tsx`) | MISSING-BUT-AVAILABLE |
| SOLD watermark / banner | `:566-568,576-580,687-700,818-823,1193-1204` (multiple: image watermark, title pill, sidebar block) | `status` | `:256` | `:713-734` (status banner covers DRAFT/PENDING_REVIEW/REJECTED/SOLD) | PRESENT — mobile's status banner is arguably more complete (covers non-ACTIVE statuses web's badge logic doesn't call out as explicitly) |
| Deceased Estate badge | `:625-633` `listing.isDepartedSale` + `departedRelationship` | Yes (`isDepartedSale`, `departedRelationship`) | `isDepartedSale` mapped (`:229`); **`departedRelationship` is declared on `ApiListing` (`listingsApi.ts:90`) but never assigned in the mapper, and `CarListing` has no field for it** | No Deceased Estate badge anywhere in `VehicleDetailScreen.tsx` | MISSING-DATA-DROPPED-BY-MAPPER (both the badge itself and the relationship qualifier) |
| View count | Not displayed anywhere on web's vehicle detail page (grep found no `viewCount` render in `VehicleDetailsPageClient.tsx`) | Yes, incremented server-side on every `findBySlug` call | `:255` | Not rendered | MISSING-NO-DATA-ON-WEB-EITHER (not a mobile-specific gap — parity target doesn't show it either) |
| "Offers Welcome" / policies tooltip | `:795-806`, `:1222-1241` | N/A, static copy | n/a | No equivalent tooltip/copy found | P2 — cosmetic trust chrome only |
| Compare button | `:648-654`, `:1387,1418-1422` (mobile bottom bar) | N/A | n/a | `:663` (header icon), navigates to `Compare` screen | PRESENT |
| Share | `:433-451,655-657` | N/A | n/a | `:664` | PRESENT |
| Watchlist / Save (heart) | `:453-473,661-666` | Yes | n/a | `:665` | PRESENT |
| Similar / related listings | Not present on web's vehicle detail page (grep for "similar"/"related" in `VehicleDetailsPageClient.tsx` returned no matches) | N/A | n/a | Not present | Not a gap — neither platform has this |
| Price history / price-drop indicator | Not present on web either (no `priceHistory`/`priceDrop` match) | N/A | n/a | Not present (mobile has a `bannerLabel` seller-set ribbon, e.g. "Price Drop", which is a manual label not a computed history — `:687-692`) | Not a gap |

## 2. Sections web has that mobile has no equivalent of at all

1. **Dealer profile block** — company description, "Visit Website" link, dealer logo. Backend includes `dealerProfile` fully (`listings.service.ts` seller select includes `dealerProfile: true`); mobile's `ApiListing`/`CarListing` types never declare a `dealerProfile` field at all, so there is nothing to render even if a screen were built. This is the single biggest structural gap — it's not "unrendered," the data path doesn't exist on mobile.
2. **Badge-tier trust chip row** (Verified / VIN Report / Condition Check / Stolen Check / Finance Check) — tier-gated marketing/trust chrome shown prominently in web's header (`:600-624`). Mobile has the raw `badgeTier` value but builds no UI for it.
3. **Seller "N active listings" count** — dropped at the type level (`listingCount` never declared on mobile's seller type), so no UI could show it without a type + mapper change first.
4. **Distinct Dealer vs. Private-seller verified badge styling** — web visually differentiates (blue "Verified Dealer" vs emerald "Verified Seller"); mobile collapses both to one generic blue check.

## 3. Prioritised list

**P0 — buyer-facing decision info the data supports but mobile doesn't show, or actively shows as unavailable:**
- Finance calculator is hard-disabled ("Coming Soon") on mobile despite the deposit/term UI existing and a working `calcMonthlyPayment()` backing the headline "or £X/mo" figure — buyers see a monthly estimate but cannot adjust deposit, term, or APR, and are told the feature isn't available yet, even though web's equivalent (`FinanceCalculator.tsx`) is fully interactive with a 9-49% APR range. `VehicleDetailScreen.tsx:1255-1333`.
- ULEZ compliance and Euro standard — both real backend fields, both declared on mobile's `ApiListing` type, both silently dropped by the mapper because `CarListing` has no field to receive them. A buyer in a low-emission zone city has no way to check ULEZ status on mobile. `listingsApi.ts:85-86` (declared, unused) vs `data/listings.ts:15-94` (no field).
- Vehicle registration (VRM) is not shown anywhere in mobile's free spec grid — only surfaces after a buyer pays £9.99 for the HPI report. Web shows it for free (`:951`).
- Dealer profile (description + website link) — entirely absent from mobile's data model, not just unrendered.

**P1 — present but materially less detail than web:**
- Body type shown via a lossy 6-bucket `category` mapping instead of the real 13-value `BodyType` enum — several body types (MPV, Van, Minivan, Station Wagon, Crossover, Pickup) have no accurate mobile label.
- Vehicle condition collapsed to 2 buckets (`Used`/`Certified Pre-Owned`) from a 6-value enum that includes CAT_S/CAT_N insurance write-off categories — and isn't rendered at all despite being collapsed.
- Seller listing count and badge-tier trust chips — mapped/available-adjacent (badgeTier mapped, listingCount not even typed) but neither renders.
- Reg. date, wheelplan, tax due date — mapped into `CarListing` successfully but never rendered (dead data sitting in the object, cheapest of all these to fix since no mapper change is needed).
- Deceased Estate badge + relationship qualifier — `isDepartedSale` reaches the mapper but the badge itself was never built on mobile, and `departedRelationship` is dropped at the mapper.

**P2 — cosmetic:**
- Generic "Verified" checkmark instead of web's dealer/private-seller color-and-label distinction.
- "Offers Welcome" / policies tooltip copy present on web, absent on mobile.
- Features list is collapsed-by-default on mobile vs. always-expanded on web (a deliberate mobile UX choice per its own code comment, not a bug).

## Notes on what's UNVERIFIED

- Buy It Now (auction reserve/buyItNowPrice) rendering for a plain-listing view of an AUCTION-type record on mobile's `VehicleDetailScreen` could not be confirmed within the file as read — no `buyItNowPrice`/reserve logic was found in `VehicleDetailScreen.tsx`, but it's plausible auction-type listings route entirely to a different screen (`LiveAuctionDetailed`) before reaching this one. Flagged, not asserted as a gap.
- Sections of `VehicleDetailScreen.tsx` beyond line ~1450 (delivery modal internals, seller card continuation, sticky footer, chat modal, HPI full-report modal body) were read via targeted greps and partial reads rather than line-by-line, since the spec/history/finance/seller sections most relevant to "missing information" were fully covered by line ~1460. No additional web-only fields were found by grep across the full mobile file for any field name in the web page's rendering, beyond what's listed above.
