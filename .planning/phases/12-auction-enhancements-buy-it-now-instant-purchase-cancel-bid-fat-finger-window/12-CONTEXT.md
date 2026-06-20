# Phase 12: Auction Enhancements - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Two targeted auction improvements: (1) Buy It Now — an optional instant-purchase price set by the seller that ends the auction via a seller-confirm flow, and (2) Cancel bid fat-finger window — a 2-minute server-enforced grace period after placing a bid where the current high bidder can retract their bid. No other auction changes.

</domain>

<decisions>
## Implementation Decisions

### Buy It Now — Pricing & Availability
- **Optional per seller** — seller sets a BIN price when creating the auction; if left blank, no BIN is shown
- **No price constraint** — seller enters any amount; system does not validate against starting bid or reserve price
- **Visibility rule** — BIN disappears once any bid meets or exceeds the reserve price; before that point it remains visible
- **Where displayed** — listing detail sidebar AND the live auction room (two places buyers are watching)
- **Editable?** — Locked once auction goes ACTIVE; can be set (and adjusted) while SCHEDULED only
- **Where seller sets it** — Auction creation wizard (alongside starting bid and reserve price); optional field

### Buy It Now — Trigger Behaviour
- **Trigger flow** — Buyer clicks BIN → confirmation modal ("Buy now for £X,000? Confirm / Cancel") → auction enters **BIN Pending** state (seller must confirm within 24h)
- **Seller response window** — 24h to Accept or Decline
  - **Decline** → auction resumes normally; BIN becomes available again; buyer is notified
  - **24h expires (no response)** → BIN request expires; auction resumes normally (seller silence = declined)
- **While BIN Pending, bidding continues** — if a new bid meets or exceeds the BIN price, the pending BIN request is automatically cancelled; auction continues
- **On seller Accept** — auction status → ENDED; auto-create chat thread between buyer and seller; push + in-app notification to both parties; buyer sees modal: "You've won this vehicle" → redirect to messages
- **Re-trigger rules** — No limit on BIN requests per buyer per auction; same buyer can re-trigger BIN after a decline
- **No payment gate** — consistent with the platform (no payments); BIN acceptance routes to chat for handover arrangement, same as regular auction win

### Cancel Bid — Window & Scope
- **Window duration** — 2 minutes from bid placement
- **Who can cancel** — Only the current high bidder (if outbid, your cancel window becomes moot)
- **Auction state during window** — Unchanged; bid is live and other bidders can outbid; being outbid ends the cancel window for the original bidder
- **Auction end is hard cut-off** — if the auction ends during the 2-minute window, the bid is final; no post-auction cancels
- **Enforcement** — Server-side: cancel endpoint checks `bid.createdAt + 2 minutes`; client shows countdown but server enforces

### Cancel Bid — Edge Cases & UI
- **Only bid cancelled** — auction continues with zero bids; starting bid still applies; no special state
- **Anti-snipe extension** — stays in place even if the bid that triggered it is cancelled (no rollback)
- **Visibility** — Private: only the bidder who placed the bid sees the cancel button; other participants see a normal bid in history
- **Re-bid after cancel** — Allowed immediately; no amount restriction; buyer can re-place the same amount straight away
- **Seller notifications** — None; bid cancels are invisible to the seller
- **Admin override** — Only admins can cancel bids outside the 2-minute window; sellers cannot cancel bids on their own auctions
- **Cancel button UI** — Countdown button that visually drains/shrinks over 2 minutes (shown in the live auction room to the bidder who placed the bid)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/auctions/auctions.service.ts` — `maybeExtend()` (anti-snipe), `acceptBid()`, `cancel()` already exist; BIN confirm flow adds a `confirmBuyItNow()` / `declineBuyItNow()` method alongside these
- `backend/src/bids/bids.service.ts` — `create()` places bids; no cancel method exists yet — needs new `cancelBid()` with 2-min server check
- `backend/src/auctions/auctions.controller.ts` — `PATCH :id/cancel` (seller cancel at SCHEDULED) already at line 105; new endpoints needed for BIN trigger, BIN confirm, BIN decline, and bid cancel
- `backend/prisma/schema.prisma` — `Auction` model has `reservePrice Decimal` at line 707; needs new `buyItNowPrice Decimal?` field; `Bid` model needs `cancelledAt DateTime?` field for soft-cancel
- `src/app/auctions/live/` — Live auction room page; cancel countdown button goes here
- `src/lib/auctionApi.ts` — Typed API client; will need `triggerBuyItNow()`, `confirmBuyItNow()`, `declineBuyItNow()`, `cancelBid()` added

### Established Patterns
- Auction notifications: `AuctionEndPayload` broadcast via WebSocket gateway; BIN pending/confirmed events follow same pattern
- Chat thread auto-creation: `acceptBid()` already does this at line 331 via `Transaction.create()`; BIN confirm reuses same flow
- Status transitions: Auction statuses are `SCHEDULED | ACTIVE | ENDED | CANCELLED`; no new status needed — BIN pending is tracked via a new `buyItNowPendingBuyerId String?` field on the Auction model (not a separate status)
- Frontend modals: Confirmation modals exist throughout; `ConfirmModal` or inline `AlertDialog` pattern from shadcn/ui (used in offer flow)

### Integration Points
- DB migration needed: `buyItNowPrice Decimal?` on Auction; `buyItNowPendingBuyerId String?` + `buyItNowPendingAt DateTime?` on Auction; `cancelledAt DateTime?` on Bid
- BIN pending expiry: can be checked lazily on `findBySlug()` (if `buyItNowPendingAt + 24h < now`, treat as expired and clear) — no cron job needed
- Bid cancel UX: WebSocket event to update live auction room after bid cancel (remove from bid history or mark as withdrawn)

</code_context>

<specifics>
## Specific Ideas

- Cancel button: "visually drains/shrinks" countdown — a circular progress arc or a linear fill that depletes over 2 minutes works well; keep it small and unobtrusive in the auction room UI
- BIN pending state: the auction room should show a "Buy It Now pending — seller confirmation in progress" banner to other visitors while BIN is pending (bidding still open but buyers know the BIN path is in flight)
- BIN price disappears gracefully: when reserve is met by a bid, the BIN price section fades out or is hidden with a brief "Reserve met — Buy It Now no longer available" tooltip

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase 12 scope

</deferred>

---

*Phase: 12-auction-enhancements*
*Context gathered: 2026-06-21*
