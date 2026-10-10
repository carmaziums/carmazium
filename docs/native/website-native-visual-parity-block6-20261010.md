# Issue #477 — Block 6/10: Dealer Buy & Bid website/native parity

Date: 10 October 2026. **60% means six implementation blocks out of the ten planned. It is NOT 60% pixel similarity, nor approved screenshots.**

## Canonical website source and actual mismatch

- Website dealer sidebar routes `Buy & Bid` to `/dashboard/dealer/auctions` (`src/config/dealerRouteConfig.ts`, required `VIEW_TRADE`); that page's heading is **Auctions & Buying**, subtitle **Live auctions, bids and purchases**, and its five-item navigation is **My Auctions** (default), **Live Auctions**, **Shortlisted**, **My Bids**, **Purchases**.
- Website `src/app/dashboard/dealer/auctions/page.tsx` lists the dealer's OWN auction lots by stage, provides **Create Auction**, results, seller funds confirmation and handover actions. `src/app/dashboard/dealer/bids/page.tsx` displays active BID POSITIONS only via `GET /bids/my/active`; `src/app/dashboard/dealer/auctions/shortlisted/page.tsx` uses **dealer-specific** `GET /watchlist/auctions?view=live|all`. `/dashboard/dealer/auctions/won` is the WON auction/purchase workflow, distinct from retail purchases.
- Before Block 6 native `DealerBuyBid` tab rendered `LiveScreen` directly. The tab therefore skipped the entire default website auctions workspace, owned auction management, separate shortlist, active positions, and auction-won route. Routing all bookmarks to generic `SavedScreen` would also miss dealer-only shortlisted auction records.

## Block 6 implementation — source level

1. `DealerBuyBidScreen.tsx`: new canonical **Auctions & Buying** workspace with full-width website-like heading, five action tabs and **My Auctions** selected first. Uses `fetchAllMyAuctions('list')` (the already-tested pagination-safe read) to show actual seller auction cards/photo, dates, state, totals and a cautiously worded "may need a next step" banner. **Not** buyer live lots relabelled as owned stock. Errors are explicit and never treated as zero. Pull-to-refresh, private-registration fallback and no fabricated bid data. Card/manage actions open existing `SellerAuctions`.
2. **Create Auction** launches existing approved `SellerAuctions` wizard with `openCreate: true`, permission guarded by `MANAGE_INVENTORY` both at hub and seller screen. No new form/pricing/reserve/increment calculations. The existing seller-stage/handover and 10-block prior fixes remain authoritative.
3. **Live Auctions** stays in this workspace using the **existing** `LiveScreen` card/filter/search/timer/UI and existing `AuctionDetailScreen` / real backend bidding controls. `embeddedDealerHub` suppresses duplicate global header, not detail/auction semantics. Dealer staff lacking `MANAGE_INVENTORY` no longer see seller-only "Auction your car" CTA. Users lacking `PLACE_BID` receive a view-only explanation; auction detail continues independently verifying access.
4. **Shortlisted** is now `DealerAuctionShortlist`, using `GET /watchlist/auctions?page=N&limit=12&view=live|all`, the website's authenticated dedicated shortlist endpoint; **Live Only / All Saved** and per-page loading, error, thumbnails, status and deep-links to original `AuctionDeepLink`. No guessed access to buyer retail bookmarks.
5. **My Bids** is `DealerActiveBidPositions` using the website's **`GET /bids/my/active`** with one position per listing, live/leading/outbid counts, real bid amounts, end-time hints and link to existing `AuctionDeepLink`. Previously established `BuyerBids` remains accessible as **full bid history and cancellation option**; no new cancel or payment endpoint created, so backend rules remain unaltered.
6. **Purchases** uses `SellerAuctions` with `initialTab:'WON'`, not `DealerPurchases` (the latter is retail-purchases context). This entry is `VIEW_PURCHASES` gated and reuses the existing fee countdown/contact/inspection path. No buyer-fee or payout changes.
7. Tab Navigator only swaps `DealerBuyBid`'s component; preserves original Home/Stock/Customers/More, original buyer Live/Saved routes, prior #476 shell, #479 drawer and #480/#481/#482 changes.
8. Source-only contracts for previous Block 1/2/3 updated to expect the **fixed** DealerBuyBid route while preserving their historical evidence and full role/consumer-route assertions. New Block 6 tests assert website source truth and financial-rule isolation.

## Known gaps and sign-off blockers

- Dealer's My Auctions overview cards are simplified preview cards; all original website inline seller controls (reserve editing, unsold relisting, funds confirmation, handover) are still reachable one tap later in **Manage Auctions**. This is **functionally routed** but not exact card-level/pixel parity. Do not represent it as a complete screen comparison.
- Active-bid cards show the current position and link to live auction. Existing full bid history/cancellation screen is one extra action away; direct per-card cancel at website location is not yet rebuilt in the hub. Reuse existing backend approval/cancel window rather than changing bidding safety rules just to match a button.
- Native shortlist uses the same backend, but doesn't yet expose website's remove-from-shortlist button on each row; the existing watchlist pathway can remove it. Avoid claiming every card control is identical.
- No installed Android/iOS app from this PR and **no authenticated dealer same-state website/native screenshots**, original referenced MP4s not directly replayed here. Prior Block 1 homepage/Sell captures do not establish dealer auction visual fidelity.
- Full parity requires screenshots at **360×800** and **390×844** including dealer owner + restricted staff, both iOS/Android safe areas, 200% font, no bids, active/outbid/highest, 0/12/13 shortlist, scheduled/ended/provisional lots, sold/withdrawn etc.

### Manual synthetic staging acceptance — OPEN

- [ ] Compare five horizontal nav labels, header/title/button/spacing against the actual authenticated website at both viewports. No double website header inside embedded Live Auctions; bottom dealer bar unobscured.
- [ ] Verify dealer with `VIEW_TRADE` but not `MANAGE_INVENTORY`: own records read-only and no Create Auction, no seller CTA. Verify lack of `PLACE_BID` cannot place a live bid, even by deep link; lack of `VIEW_PURCHASES` cannot reach won view.
- [ ] Existing `SellerAuctions` Create wizard preselect/no-preselect, reserve, starting bid, 24hr schedule; funds-confirmation before handover and proof rejection/resubmission **in approved synthetic staging only**, without live financial mutation.
- [ ] Live browse filters/search, auction detail photos, bid increment, anti-snipe, cancellation window, "bid accepted" visibility, updates and KYC permission denial **using approved synthetic staging only**; no production bid placed.
- [ ] Shortlisted Live Only/All Saved pagination and history, watchlist cross-client synchronization, deep-link to original auction, expiry display.
- [ ] My Bids leading/outbid counters vs identical backend API positions; history navigation, no fake £0 for missing values, error and stale states.
- [ ] Purchases routes to WON tab, not retail-purchase list; fees/contact rights/inspection flow guarded.
- [ ] Verify Android emulator and iOS device screenshot/video pairs, accessible tap targets, VoiceOver/TalkBack; no inferred pixel pass from green TypeScript/tests.

**VISUAL SIGN-OFF: PENDING.** "Six of ten" is implementation progress only.

## Scope/rollback

Block 6 PR branches off main after **merged PRs #476, #478, #479, #480, #481, #482**; no changes to website, production API/schema, customer records, seller payment flow, bidding economics, CarMazium fee model, external provider keys, mobile signing/distribution or production database. All writes in current UI remain behind pre-existing backend operations/permission checks, with NO live mutation performed during this task.

To revert, revert **this Block 6 PR only**, preserving #476, #478, #479, #480, #481 and #482. **STOP at 60%** and await next user **proceed** before Block 7.
