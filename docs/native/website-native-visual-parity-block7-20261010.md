# Issue #477 — Block 7/10: Retail Buy/Sell, valuation and native parity

Date: 2026-10-10. 70% means seven out of ten implementation blocks, **not** a measured visual similarity score.

## Canonical website vs existing native

The public website's src/app/search/page.tsx displays "Find Your Perfect Car", retail listings and filters for make/model, price, fuel, mileage, transmission, condition and distance. It also links to Live Auctions. Website src/app/sell/page.tsx displays "Sell Your Car Online in the UK", then registration + mileage free valuation, and lets users choose FREE Dealer Auction or £1 Retail Listing. The separate £100 auction-only reward requires a qualifying completed auction sale and approved handover. Buyer pays seller directly.

Native SearchScreen already implements a comprehensive search/filter state machine, pagination, and HorizontalVehicleCard displays real photos, explicit gearbox with "Not specified" fallback, fuel, mileage and price. Preserve rather than replace these proven business paths. The old native Search header used a dynamic listing count as the title and lacked the shared website-style top bar and an immediate auction navigation link.

The old public native Home/More Sell CTAs bypassed the valuation/choice landing and opened SellCarFlow immediately. The multi-step SellCarFlow already has DVLA/vehicle analysis, valuation, seller validation, draft/edit, photo, publishing, auction and retail payments: retain it rather than duplicating sensitive transactional logic.

## Changes made — source level

- Add native SellLandingScreen and SellLanding stack entry. Page first asks for registration and mileage plus make/model/year manual fields. Analyse uses existing authenticated POST /dvla/lookup with allowAiEnrichment:false, not OpenAI enrichment. Users must enter actual model if DVLA omits it. New VRM invalidates old car's identity/value and stale in-flight responses.
- Request actual figures through existing getVehicleValuation (same service as native wizard), show finite positive current market value only and an explicit guide-not-guaranteed disclaimer. On API error/no result show informative message and allow listing with manually set price. Never fabricate a valuation or claim an offer.
- Show Free Valuation / Free Auction / £1 Retail value propositions; actions choose AUCTION or CLASSIFIED and route to the pre-existing SellCarFlow. Pass optional vehicle prefill without auto-writing a listing, charging a fee or changing reserves/bids. Edit mode ignores new-flow prefill. Stored draft resume remains unchanged.
- Route public Home's two Sell entry buttons and the consumer drawer Sell a Car to the new landing. Preserve direct-to-wizard links for editing/relisting.
- Align Search heading to website "Find Your Perfect Car", real count below heading, shared WebsiteTopBar, and obvious "Browse Live Auctions" cross-link into pre-existing auctions tab. Maintain buyer retail vs verified trade-auction separation.
- Existing native cards continue to expose transmission/mileage/price/photo and sorting, favourite, offer, contact and HPI actions, with no backend/write changes.

## Known gaps and acceptance blockers

Native quick valuation is compact and shows manual vehicle fields in the same form, whereas website uses a staged input/form with its own analytics instrumentation. Native currently passes vehicle facts and selected type, not the entire valuation object, to the native wizard; the wizard may recompute when richer condition/spec data is entered. This is intentional bounded source implementation, not complete pixel identity or precise website analytics parity. Seller drafts may resume by confirmation and replace initial prefill. The website desktop search sidebar and native mobile bottom sheets differ by platform.

There are no authenticated same-state native vs website screenshots of these changed pages, and no updated Android/iOS QA build has been installed here. The user's old videos were not replayed during this turn. Source regression or public website screenshots cannot certify exact UI pixels.

## Manual QA acceptance — PENDING

- [ ] Compare website and installed Android/iOS /search, /sell and retail vehicle detail with matching synthetic listings, viewports 360×800 and 390×844, themes, fonts, safe areas and scroll position.
- [ ] Verify 0-vehicle, populated and filtered views; long titles, photos, prices, real gearbox (Manual/Automatic/CVT/Not specified), mileage, sorting, favourites, buyer retail offers and live auction routing.
- [ ] Validate VRM and manual make/model/year/mileage, DVLA absent-model branch, stale response cancellation, no AI enrichment without consent, valuation available/unavailable, correct guide messaging, keyboard/accessibility at 200% text scale.
- [ ] In approved isolated synthetic staging only, compare native and website valuations, confirm chosen auction/retail type reaches correct wizard, drafts/edit unchanged, admin review/retail listing fee guard unchanged, buyer fee/handover payout unchanged, buyer vs trade bidder permissions.
- [ ] Ensure no unexpected listing, payment, bid, customer message, real VRM lookup or seller handover created during QA.

VISUAL SIGN-OFF: PENDING. Six previous blocks and this one are source-level implementation only.

## Rollback and stop

Based on main after merged PR #476, PR #478, PR #479, PR #480, PR #481, PR #482 and PR #483. Revert only Block 7 PR without modifying these ancestors. No source modification to website, backend, production DB, auction money, customer KYC, signing, app distribution or production deployments.

**STOP at 70%**; await next explicit user "proceed" before Block 8 (unified account settings, saved, messaging, notifications, MaziuM).
