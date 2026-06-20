# Phase 12: Auction Enhancements — Research

**Researched:** 2026-06-21
**Domain:** NestJS auction service extension + Next.js live auction room UI + Prisma schema migration
**Confidence:** HIGH — all findings are from direct codebase inspection of the running system

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Buy It Now — Pricing & Availability**
- Optional per seller — seller sets a BIN price when creating the auction; if left blank, no BIN is shown
- No price constraint — seller enters any amount; system does not validate against starting bid or reserve price
- Visibility rule — BIN disappears once any bid meets or exceeds the reserve price; before that point it remains visible
- Where displayed — listing detail sidebar AND the live auction room (two places buyers are watching)
- Editable? — Locked once auction goes ACTIVE; can be set (and adjusted) while SCHEDULED only
- Where seller sets it — Auction creation wizard (alongside starting bid and reserve price); optional field

**Buy It Now — Trigger Behaviour**
- Trigger flow — Buyer clicks BIN → confirmation modal ("Buy now for £X,000? Confirm / Cancel") → auction enters BIN Pending state (seller must confirm within 24h)
- Seller response window — 24h to Accept or Decline
  - Decline → auction resumes normally; BIN becomes available again; buyer is notified
  - 24h expires (no response) → BIN request expires; auction resumes normally (seller silence = declined)
- While BIN Pending, bidding continues — if a new bid meets or exceeds the BIN price, the pending BIN request is automatically cancelled; auction continues
- On seller Accept — auction status → ENDED; auto-create chat thread between buyer and seller; push + in-app notification to both parties; buyer sees modal: "You've won this vehicle" → redirect to messages
- Re-trigger rules — No limit on BIN requests per buyer per auction; same buyer can re-trigger BIN after a decline
- No payment gate — BIN acceptance routes to chat for handover arrangement, same as regular auction win

**Cancel Bid — Window & Scope**
- Window duration — 2 minutes from bid placement
- Who can cancel — Only the current high bidder (if outbid, your cancel window becomes moot)
- Auction state during window — Unchanged; bid is live and other bidders can outbid; being outbid ends the cancel window for the original bidder
- Auction end is hard cut-off — if the auction ends during the 2-minute window, the bid is final; no post-auction cancels
- Enforcement — Server-side: cancel endpoint checks `bid.createdAt + 2 minutes`; client shows countdown but server enforces

**Cancel Bid — Edge Cases & UI**
- Only bid cancelled — auction continues with zero bids; starting bid still applies; no special state
- Anti-snipe extension — stays in place even if the bid that triggered it is cancelled (no rollback)
- Visibility — Private: only the bidder who placed the bid sees the cancel button; other participants see a normal bid in history
- Re-bid after cancel — Allowed immediately; no amount restriction; buyer can re-place the same amount straight away
- Seller notifications — None; bid cancels are invisible to the seller
- Admin override — Only admins can cancel bids outside the 2-minute window; sellers cannot cancel bids on their own auctions
- Cancel button UI — Countdown button that visually drains/shrinks over 2 minutes (shown in the live auction room to the bidder who placed the bid)

### Claude's Discretion
None specified — all material decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase 12 scope.
</user_constraints>

---

## Summary

Phase 12 adds two surgical enhancements to the auction engine. Both features require new DB columns, new backend endpoints, and targeted additions to existing frontend pages. No new pages are created; everything slots into established patterns already used in the codebase.

**Buy It Now (BIN)** is a field added to the `Auction` model (`buyItNowPrice Decimal?`) and three tracking fields (`buyItNowPendingBuyerId String?`, `buyItNowPendingAt DateTime?`). The pending state is not a new enum value — it is tracked via these fields, detected lazily on `findOne()`. Four new backend endpoints handle the lifecycle. Two existing frontend surfaces receive BIN UI: the live auction room right sidebar (where `acceptBid` logic already lives) and the listing detail page sidebar.

**Cancel Bid** requires a single new field on `Bid` (`cancelledAt DateTime?`) and one new endpoint (`DELETE /bids/:id/cancel` or `PATCH /bids/:id/cancel`). The existing `findByListing`, `findMyBids`, and broadcast logic all need minor filtering to exclude soft-cancelled bids. The cancel countdown button appears only in `src/app/auctions/live/[id]/page.tsx` and only to the bidder who placed it, identified by comparing `bid.bidderId === user.id` and `bid.bidId` from the `BidBroadcastPayload` which already carries `bidderId`.

**Primary recommendation:** Implement as three plans: (1) DB migration + backend BIN endpoints, (2) backend cancel bid endpoint + live auction room cancel button, (3) BIN UI in both frontend surfaces.

---

## Standard Stack

### Core (already installed — nothing new to install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | existing | schema migration + typed DB client | project ORM |
| NestJS | existing | backend endpoint + service layer | project framework |
| socket.io-client / socket.io | existing | real-time WebSocket events | established auction pattern |
| framer-motion | existing | modal + countdown animations | already used in live auction page |
| lucide-react | existing | icons (countdown, BIN) | established icon set |
| class-validator + class-transformer | existing | NestJS DTO validation | established in all DTOs |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/swagger | existing | ApiProperty decorators on new DTOs | all controller methods need Swagger docs |
| Next.js useState + useCallback + useEffect | existing | frontend countdown timer | cancel button 2-min countdown |

---

## Architecture Patterns

### Recommended Project Structure — new files only
```
backend/src/auctions/
  dto/
    trigger-bin.dto.ts        # new — body for POST :id/bin-trigger (just auctionId from param)
    confirm-bin.dto.ts        # new — empty body (seller just POSTs to confirm)
  auctions.service.ts         # extend — triggerBuyItNow(), confirmBuyItNow(), declineBuyItNow()
  auctions.controller.ts      # extend — 3 new POST routes + 1 PATCH for BIN

backend/src/bids/
  bids.service.ts             # extend — cancelBid()
  bids.controller.ts          # extend — PATCH /bids/:id/cancel

backend/prisma/schema.prisma  # migration — 3 fields on Auction, 1 field on Bid
backend/prisma/migrations/    # new migration file

src/lib/auctionApi.ts         # extend — types + API fns for BIN
src/app/auctions/live/[id]/page.tsx  # extend — BIN section in sidebar + cancel button in bid feed
src/app/buy-cars/[slug]/page.tsx     # extend — BIN section in right sidebar
src/app/dashboard/dealer/auctions/page.tsx  # extend — optional BIN price field in create form
```

### Pattern 1: Lazy BIN Expiry Check (no cron job)
**What:** When `findOne(id)` or `findBySlug()` is called, if `buyItNowPendingAt + 24h < now`, the service auto-clears the pending fields before returning the auction.
**When to use:** Any read path that returns an auction to the client.
**Example:**
```typescript
// In auctions.service.ts findOne() — after fetching from DB
private clearExpiredBin(auction: any): any {
  if (
    auction.buyItNowPendingAt &&
    new Date(auction.buyItNowPendingAt).getTime() + 24 * 60 * 60 * 1000 < Date.now()
  ) {
    // Fire-and-forget DB clear (non-blocking)
    this.prisma.auction.update({
      where: { id: auction.id },
      data: { buyItNowPendingBuyerId: null, buyItNowPendingAt: null },
    }).catch(() => {});
    return { ...auction, buyItNowPendingBuyerId: null, buyItNowPendingAt: null };
  }
  return auction;
}
```

### Pattern 2: BIN Pending Auto-Cancel on Bid >= BIN Price
**What:** In `bids.service.ts create()`, after saving the bid and before broadcasting, check if the new bid amount >= auction.buyItNowPrice AND a BIN request is pending. If so, clear pending fields.
**When to use:** Every bid placement when BIN is set.
**Example:**
```typescript
// After bid.create(), in BidsService.create():
if (
  auction.buyItNowPrice &&
  auction.buyItNowPendingBuyerId &&
  createBidDto.amount >= Number(auction.buyItNowPrice)
) {
  await this.prisma.auction.update({
    where: { id: auction.id },
    data: { buyItNowPendingBuyerId: null, buyItNowPendingAt: null },
  });
  // Notify the pending buyer their BIN request was cancelled
  this.notificationsService.create({
    userId: auction.buyItNowPendingBuyerId,
    type: 'AUCTION_ENDED', // reuse closest type
    title: 'Buy It Now request cancelled',
    message: `A new bid cancelled your Buy It Now request on ${listing.make} ${listing.model}.`,
    entityType: 'AUCTION',
    entityId: auction.id,
    link: `/auctions/live/${auction.id}`,
  }).catch(() => {});
}
```

### Pattern 3: BIN Pending State Tracked via Fields, Not Enum
**What:** The `AuctionStatus` enum stays as `SCHEDULED | ACTIVE | ENDED | CANCELLED`. BIN pending state is two nullable fields on Auction: `buyItNowPendingBuyerId` and `buyItNowPendingAt`. No Prisma enum change needed.
**Why:** Avoids a breaking enum migration and keeps status logic simple. The frontend derives "BIN pending" from whether `buyItNowPendingBuyerId` is non-null on the Auction object returned by the API.

### Pattern 4: Accept BIN Reuses closeAuction() Logic
**What:** `confirmBuyItNow()` in `auctions.service.ts` follows the same transaction as `acceptBid()` (lines 314-343): update auction status → ENDED with winnerId + winningBidAmount, update listing to SOLD, create Sale record, upsert SellerProfile, broadcast `auction:ended`, call `notifyAuctionEnd()`. No duplicate code needed — call the existing helpers.
**When to use:** Seller accepts the BIN request.

### Pattern 5: Bid Cancel Soft-Delete
**What:** `cancelBid()` in `bids.service.ts` writes `cancelledAt: new Date()` to the Bid row. Existing queries that filter `deletedAt: null` need to also exclude `cancelledAt: { not: null }` OR `cancelledAt` can be written to the existing `deletedAt` field. **Simpler option: use the existing `deletedAt` field for bid cancellation** — it already filters correctly everywhere (`findByListing`, `findMyBids`, `getBuyerStats`, `closeAuction` top-bid query). This means a cancelled bid is indistinguishable from a hard-deleted one in queries, which is the desired behavior (invisible to all but the bidder in their own session).
**Important:** The CONTEXT.md specified `cancelledAt DateTime?` as a NEW field. This is the safer approach — it lets admin distinguish cancelled vs deleted bids. The existing `deletedAt` queries must then be updated to also filter `cancelledAt: null` or `cancelledAt` is kept separate and read paths use `{ deletedAt: null, cancelledAt: null }`.
**Recommendation:** Use `cancelledAt` as a new field (per CONTEXT.md). Update all `where: { deletedAt: null }` on Bid queries to `where: { deletedAt: null, cancelledAt: null }`. There are 5 query sites to update.

### Pattern 6: WebSocket Event for Bid Cancel
**What:** After `cancelBid()` succeeds, the backend broadcasts a new event `bid:cancelled` to the auction room with the `bidId`. The live auction page listens for this and removes the cancelled bid from `bidHistory` state.
**Why:** Without this, other viewers would still see the cancelled bid in their session.
**Gateway addition needed in `auction.gateway.ts`:**
```typescript
broadcastBidCancelled(auctionId: string, bidId: string): void {
  this.server.to(`auction:${auctionId}`).emit('bid:cancelled', { auctionId, bidId });
}
```

### Pattern 7: Cancel Countdown Button
**What:** A 2-minute countdown button shown only to the current viewer for their most recent bid (identified by `bidderId === user.id` from the `BidBroadcastPayload` stored in `bidHistory`). Uses `useEffect` with `setInterval` or a single `setTimeout` chain, not a library.
**Visual:** CSS circular arc that drains over 120 seconds using SVG `stroke-dashoffset` animation OR a linear fill. The existing `antiSnipeActive` flag uses a single `setTimeout` approach — the same pattern works here.
**Key state:**
```typescript
const [cancelableBidId, setCancelableBidId] = React.useState<string | null>(null)
const [cancelWindowMs, setCancelWindowMs] = React.useState(0) // 0-120000
const [cancelLoading, setCancelLoading] = React.useState(false)
```
When `bid:new` arrives with `bidderId === user.id`, set `cancelableBidId = payload.bidId` and start a 120s countdown. When outbid (new bid from different bidder arrives) OR when `bid:cancelled` arrives for that bidId, clear `cancelableBidId`.

### Anti-Patterns to Avoid
- **Polling for BIN expiry:** Do NOT add a cron job or setInterval to check BIN expiry. The lazy check in `findOne()` is sufficient.
- **New AuctionStatus enum value for BIN_PENDING:** No. It complicates existing status checks throughout the codebase. Track via nullable fields only.
- **Using deletedAt for bid cancellation:** Tempting since existing queries filter it, but loses audit trail. Use the separate `cancelledAt` field and update query filters.
- **BIN price validation on backend:** Per locked decision — no validation against starting bid or reserve. Accept any positive number.
- **Bidding disabled during BIN Pending:** Per locked decision — bidding continues while BIN request is in flight.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chat auto-creation on BIN accept | custom chat init | `prisma.chatRoom.upsert()` at lines 563-577 in `auctions.service.ts` | already tested pattern from `closeAuction()`/`acceptBid()` |
| Win notifications | custom notification builder | `notificationsService.create()` + `auctionGateway.broadcastAuctionEnd()` | same pattern used in `notifyAuctionEnd()` |
| BIN expiry timeout | server-side cron/Bull queue | lazy check in `findOne()` on read | zero infrastructure overhead |
| Countdown UI | third-party timer component | `useEffect` + `setInterval` | CountdownTimer already exists in `/components/features/CountdownTimer.tsx` — check if it accepts milliseconds, or hand-roll the simple 120s countdown inline |
| Modal for BIN confirm | AlertDialog library | `AnimatePresence` + `motion.div` inline modal | identical to existing `acceptingBid` modal at line 320 of the live auction page |

---

## Common Pitfalls

### Pitfall 1: Bid History Filter After Cancel
**What goes wrong:** After `cancelledAt` is added to the Bid model, existing queries that use `where: { deletedAt: null }` will return cancelled bids, showing them in bid history feeds, top-bid calculations in `closeAuction()`, and `getBuyerStats()`.
**Why it happens:** `cancelledAt` is a new field — Prisma returns it but existing `where` clauses don't exclude it.
**How to avoid:** When updating `bids.service.ts` and `auctions.service.ts` after the migration, do a global search for `deletedAt: null` on Bid queries and add `cancelledAt: null` to each.
**Warning signs:** `closeAuction()` picks a cancelled bid as the top bid → wrong winner declared.

### Pitfall 2: BIN Price Visibility Race Condition
**What goes wrong:** Client shows BIN button. Buyer clicks. Meanwhile another bid meets reserve. Server correctly cancels the BIN pending request, but client still shows the old BIN-pending banner.
**Why it happens:** The `bid:new` WebSocket event triggers the BIN-pending auto-cancel on the backend, but the frontend must react to the `bid:new` event AND also update BIN visibility locally.
**How to avoid:** In the frontend `bid:new` handler, if `payload.amount >= auction.reservePrice`, hide the BIN section locally. The API response on next page load will confirm this. Also, re-fetch auction state after BIN confirm/decline (the API calls already return updated state).

### Pitfall 3: Seller Can See Cancel Button
**What goes wrong:** Cancel button appears for sellers who are watching bid activity.
**Why it happens:** Seller is authenticated; if `user.id` check is not strict, seller could match a bid from a bidder with the same name initials (edge case: initials match is not enough).
**How to avoid:** The cancel button visibility MUST use `bid.bidderId === user.id`, where `bidderId` comes from `BidBroadcastPayload`. The `BidBroadcastPayload` already carries `bidderId` (confirmed at line 18 of `auction.gateway.ts`). Also add `!isSeller` guard.

### Pitfall 4: BIN Field Missing from `Auction` TypeScript Interface
**What goes wrong:** `auctionApi.ts` `Auction` interface does not include `buyItNowPrice`, `buyItNowPendingBuyerId`, `buyItNowPendingAt`. Frontend TypeScript errors or `undefined` access.
**How to avoid:** Extend the `Auction` interface in `src/lib/auctionApi.ts` at the same time as adding the backend types. Also extend `CreateAuctionRequest` to add optional `buyItNowPrice?: number`.

### Pitfall 5: BIN Accept Skips Sale Record
**What goes wrong:** `confirmBuyItNow()` ends the auction but does not create a `Sale` record, so the buyer's purchase history and seller's earnings are empty.
**Why it happens:** Easy to copy `acceptBid()` partially without copying the `prisma.sale.create()` and `prisma.sellerProfile.upsert()` calls.
**How to avoid:** `confirmBuyItNow()` must call the existing `notifyAuctionEnd()` private method and execute the same `$transaction` block as `acceptBid()`. Best approach: extract shared "end auction with winner" logic into a private `endAuctionWithWinner(auctionId, winnerId, amount, sellerId)` helper, then call it from `acceptBid()`, `confirmBuyItNow()`, and `closeAuction()`.

### Pitfall 6: Cancel Bid After Auction Ends
**What goes wrong:** Buyer places bid in final seconds, auction closes before 2-min window expires, buyer sees cancel button and cancels.
**Why it happens:** Client shows cancel button based on local timer; auction may have ended server-side.
**How to avoid:** The server-side `cancelBid()` must check both `bid.createdAt + 2min > now` AND `auction.status === 'ACTIVE'`. Client-side, the `bid:cancelled` event fires `auction:ended` before the cancel window expires; detect `endedPayload` state and hide the cancel button when `isEnded` becomes true.

---

## Code Examples

Verified patterns from direct codebase inspection:

### DB Schema Additions (Prisma)
```prisma
// In model Auction — add after winningBidAmount line 712:
buyItNowPrice          Decimal?  @db.Decimal(12, 2)
buyItNowPendingBuyerId String?
buyItNowPendingAt      DateTime?

// In model Bid — add after updatedAt line 744:
cancelledAt DateTime?
```

### New Endpoints Needed (auctions.controller.ts)
```typescript
// POST /auctions/:id/bin-trigger   — buyer triggers BIN request
// POST /auctions/:id/bin-confirm   — seller accepts BIN (ends auction)
// POST /auctions/:id/bin-decline   — seller declines BIN (resumes)
// PATCH /bids/:id/cancel           — bidder cancels their bid within 2 min
```

### BIN Trigger Service Method Skeleton
```typescript
async triggerBuyItNow(auctionId: string, buyerId: string): Promise<void> {
  const auction = await this.findOne(auctionId);
  if (auction.status !== 'ACTIVE') throw new BadRequestException('Auction is not ACTIVE');
  if (!auction.buyItNowPrice) throw new BadRequestException('No BIN price set');
  // Check reserve not already met by existing top bid
  const topBid = auction.listing.bids?.[0];
  if (topBid && Number(topBid.amount) >= Number(auction.reservePrice)) {
    throw new BadRequestException('Reserve is met — BIN no longer available');
  }
  // Allow even if another BIN is pending (replace it — same buyer re-trigger)
  await this.prisma.auction.update({
    where: { id: auctionId },
    data: { buyItNowPendingBuyerId: buyerId, buyItNowPendingAt: new Date() },
  });
  // Notify seller
  await this.notificationsService.create({
    userId: auction.listing.sellerId,
    type: 'AUCTION_ENDED', // closest type
    title: 'Buy It Now request received',
    message: `A buyer wants to buy your ${auction.listing.make} ${auction.listing.model} for £${Number(auction.buyItNowPrice).toLocaleString()}.`,
    entityType: 'AUCTION',
    entityId: auctionId,
    link: `/auctions/live/${auctionId}`,
  });
  // Broadcast BIN pending state to all viewers via WebSocket
  this.auctionGateway.broadcastBinPending(auctionId, buyerId);
}
```

### Cancel Bid Service Method Skeleton
```typescript
async cancelBid(bidId: string, bidderId: string): Promise<void> {
  const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });
  if (!bid || bid.bidderId !== bidderId) throw new ForbiddenException('Not your bid');
  if (bid.cancelledAt || bid.deletedAt) throw new BadRequestException('Bid already cancelled');

  const twoMinMs = 2 * 60 * 1000;
  if (Date.now() - bid.createdAt.getTime() > twoMinMs) {
    throw new BadRequestException('Cancel window has expired (2 minutes)');
  }

  // Confirm bidder is still the current high bidder
  const listing = await this.prisma.listing.findUnique({
    where: { id: bid.listingId },
    include: { auction: true },
  });
  if (!listing?.auction || listing.auction.status !== 'ACTIVE') {
    throw new BadRequestException('Auction has ended — bid is final');
  }
  const topBid = await this.prisma.bid.findFirst({
    where: { listingId: bid.listingId, deletedAt: null, cancelledAt: null },
    orderBy: { amount: 'desc' },
  });
  if (topBid?.id !== bidId) {
    throw new BadRequestException('You are no longer the highest bidder');
  }

  await this.prisma.bid.update({ where: { id: bidId }, data: { cancelledAt: new Date() } });
  // Broadcast removal to auction room
  this.auctionGateway.broadcastBidCancelled(listing.auction.id, bidId);
}
```

### Frontend: Extend BidBroadcastPayload for Cancel Response
```typescript
// In src/lib/auctionApi.ts — new event type (socket listener only, no new API function)
// Socket event: 'bid:cancelled' → { auctionId: string, bidId: string }
```

### Frontend: Cancel Countdown Pattern
```typescript
// In live auction page — track cancel window for current user's latest bid
React.useEffect(() => {
  if (!cancelableBidId) return;
  const WINDOW = 2 * 60 * 1000; // 120s
  const intervalId = setInterval(() => {
    setCancelWindowMs(prev => {
      if (prev <= 0) { setCancelableBidId(null); clearInterval(intervalId); return 0; }
      return prev - 100;
    });
  }, 100);
  setCancelWindowMs(WINDOW);
  return () => clearInterval(intervalId);
}, [cancelableBidId]);

// When bid:new arrives from user's own bid:
// setCancelableBidId(payload.bidId) — starts countdown
// When bid:new arrives from different bidder:
// setCancelableBidId(null) — user outbid, cancel window gone
// When bid:cancelled arrives:
// setBidHistory(prev => prev.filter(b => b.bidId !== payload.bidId))
// setCancelableBidId(null)
```

### BIN Section in Live Auction Page Sidebar (Placement)
The right column already has: Live Feed card → Bid controls card → Trust note → Buyer fee notice.
BIN card slots BETWEEN "Bid controls" and "Trust note", visible only when:
- `isLive`
- `!isSeller`
- `auction.buyItNowPrice` exists
- `!reserveMet` (top bid < reservePrice)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No BIN field in Auction schema | `buyItNowPrice Decimal?` + two pending tracking fields | Zero new enum complexity |
| Bid hard-delete via `deletedAt` | Soft-cancel via `cancelledAt` | Preserves audit trail |
| No cancel endpoint on Bids | `PATCH /bids/:id/cancel` with 2-min server check | Prevents stale client-side only windows |

---

## Open Questions

1. **BIN pending banner to other auction viewers**
   - What we know: CONTEXT.md says "auction room should show a BIN pending banner to other visitors"
   - What's unclear: Is this a WebSocket broadcast or a read-derived state from `auction.buyItNowPendingBuyerId !== null` on page load?
   - Recommendation: Broadcast a `bin:pending` WebSocket event from `triggerBuyItNow()` (following `broadcastBid` pattern) so live viewers see it immediately without page reload. On page load, `buyItNowPendingBuyerId !== null` signals the banner to render.

2. **BIN in buy-cars/[slug] sidebar — does it need WebSocket?**
   - What we know: The listing detail page (`/buy-cars/[slug]`) is a non-real-time page; it fetches `getListingBySlug()`. The auction object is not currently fetched on this page — it's linked via the `type === 'AUCTION'` flag and a "View Auction" button.
   - What's unclear: Should the BIN widget on the listing detail page be live or static?
   - Recommendation: Fetch the auction by `listing.auction.id` on that page (a separate `getAuction()` call), show BIN price statically. No WebSocket needed on this page — clicking "Buy It Now" navigates to or calls the BIN trigger API, then updates state locally. This is simpler and consistent with how the existing "View Auction" link works.

3. **Notification type for BIN events**
   - What we know: The `NotificationType` Prisma enum currently has: `BID_PLACED | OUTBID | AUCTION_WON | AUCTION_ENDED | OFFER_RECEIVED | COUNTER_RECEIVED | OFFER_ACCEPTED | OFFER_REJECTED | PAYOUT_FAILED | SYSTEM`.
   - What's unclear: Should BIN events use existing types (nearest: `AUCTION_ENDED` for seller, `AUCTION_WON` for buyer accept) or add new enum values?
   - Recommendation: Reuse `AUCTION_ENDED` for seller BIN notifications and `AUCTION_WON` for buyer BIN-accepted notification. This avoids a DB migration on the NotificationType enum and keeps mobile push notification routing intact. New types can be deferred.

---

## DB Migration Summary

```sql
-- New columns on auctions table
ALTER TABLE auctions ADD COLUMN "buyItNowPrice" DECIMAL(12,2);
ALTER TABLE auctions ADD COLUMN "buyItNowPendingBuyerId" TEXT;
ALTER TABLE auctions ADD COLUMN "buyItNowPendingAt" TIMESTAMP;

-- New column on bids table
ALTER TABLE bids ADD COLUMN "cancelledAt" TIMESTAMP;
```

All columns nullable — no data backfill needed. Zero downtime migration.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to false in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via jest.config.js with jest-expo preset, established in Phase 2 Wave 0) |
| Config file | `/d/carmazium/backend/src/bids/bids.service.spec.ts` exists — a bids service test file |
| Quick run command | `npx jest bids.service.spec --no-coverage` (from backend dir) |
| Full suite command | `npx jest --no-coverage` (from backend dir) |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| BIN trigger rejected if auction not ACTIVE | unit | `npx jest bids.service.spec --no-coverage` | ❌ Wave 0 — add to `auctions.service.spec.ts` |
| BIN trigger rejected if reserve already met | unit | `npx jest auctions.service.spec --no-coverage` | ❌ Wave 0 |
| BIN pending auto-clears when bid >= BIN price | unit | `npx jest bids.service.spec --no-coverage` | ❌ Wave 0 |
| BIN confirm creates Sale record + ends auction | unit | `npx jest auctions.service.spec --no-coverage` | ❌ Wave 0 |
| Cancel bid rejected after 2 min | unit | `npx jest bids.service.spec --no-coverage` | existing spec file, new test |
| Cancel bid rejected if not current high bidder | unit | `npx jest bids.service.spec --no-coverage` | existing spec file, new test |
| Cancel bid rejected if auction ended | unit | `npx jest bids.service.spec --no-coverage` | existing spec file, new test |
| Cancelled bid excluded from top-bid query | unit | `npx jest bids.service.spec --no-coverage` | existing spec file, new test |

### Sampling Rate
- **Per task commit:** `npx jest bids.service.spec --no-coverage`
- **Per wave merge:** `npx jest --no-coverage` (full backend suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/auctions/auctions.service.spec.ts` — covers BIN lifecycle tests (does not currently exist)
- [ ] Add 4 new test cases to `backend/src/bids/bids.service.spec.ts` — cancel bid edge cases

---

## Sources

### Primary (HIGH confidence)
- Direct read of `backend/src/auctions/auctions.service.ts` — all existing patterns verified line by line
- Direct read of `backend/src/auctions/auctions.controller.ts` — existing endpoint list confirmed
- Direct read of `backend/src/bids/bids.service.ts` — `create()`, `findByListing()`, `getBuyerStats()` confirmed
- Direct read of `backend/src/bids/bids.controller.ts` — no cancel endpoint confirmed absent
- Direct read of `backend/src/auctions/auction.gateway.ts` — WebSocket event types confirmed
- Direct read of `backend/prisma/schema.prisma` (lines 700-754) — Auction + Bid model columns confirmed
- Direct read of `src/app/auctions/live/[id]/page.tsx` — full live auction page UI structure
- Direct read of `src/lib/auctionApi.ts` — TypeScript types + API functions confirmed
- Direct read of `backend/src/auctions/dto/create-auction.dto.ts` — DTO structure confirmed
- Direct read of `src/app/dashboard/dealer/auctions/page.tsx` — auction creation form confirmed

### Secondary (MEDIUM confidence)
- `12-CONTEXT.md` — user decisions (all architectural choices locked; read directly)

---

## Metadata

**Confidence breakdown:**
- DB schema changes: HIGH — schema read directly, columns confirmed absent
- Backend patterns: HIGH — service code read directly, all reuse patterns verified
- Frontend placement: HIGH — live auction page read in full (1271 lines); right sidebar structure confirmed
- Pitfalls: HIGH — derived from direct code reading, not speculation
- Open questions: MEDIUM — design choices that weren't explicitly addressed in CONTEXT.md

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable codebase, no fast-moving dependencies)
