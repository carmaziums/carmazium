# Auction Block 7 — historical financial reconciliation
Date: 1 October 2026. Production project: CarMazium. Scope: audit and protected manual review, **not** speculative financial correction.

## Verified production baseline (read-only, 338 non-deleted auctions)
- 23 pre-6-August winners have no `wonAt`; all 23 have the matching canonical Sale buyer and sold price. **PRESERVE** their null `wonAt`; backfilling would make the current 72-hour expiry cron able to cancel real historic sales.
- 0 winners created since the 6 August feature have missing `wonAt`.
- 0 stale `wonAt` without a winner; 0 winnerless auctions with winning amount.
- 5 auctions have handover and seller-bonus approval recorded but `buyerFeePaid=false`. Those are the **same five cases**, not ten separate cases:
  - 3 ENDED auctions: each has a matching Sale but only PENDING or FAILED £125 COMMISSION records. Each has a recorded manual seller-bonus payment. There is **no** completed linked £125 transaction or recorded admin waiver.
  - 2 CANCELLED auctions have handover and bonus-approval markers but no current winner or Sale. One has a manual seller-bonus payment marker; the other does not. One has a failed £125 transaction; the other has no transaction.
- 0 current bonus-approved auctions have an inspection refusal marker.

## External payment corroboration
The connected live Stripe account named Mazium could not retrieve any of the three recorded historic payment-intent IDs. That negative lookup does **not** establish that charges failed; the historic records may belong to a different Stripe account. Do not issue a refund, mark a payment complete, reinstate a pending/failed payment or repeat a £100 payout from this evidence alone.

## Safe outcome
1. Retain all 23 original legacy `wonAt = NULL` fields and matching Sales.
2. Leave the five historical buyer-fee, handover, payout and cancellation records exactly as found. Never overwrite a financial audit trail to make a dashboard appear consistent.
3. Provide an ADMIN-only, READ-ONLY reconciliation queue (GET /admin/auctions/historical-reconciliation and its admin UI). Highlight both cancelled records, transaction status evidence and genuine manual-payment markers.
4. For each manual-review case, an authorised finance/admin operator should match the original correct Stripe merchant account's charge, capture/refund history, corresponding bank record and seller bonus payout evidence before deciding whether any specific data correction is permissible. Separately verify any manually marked paid £100 amount before repeating a payout.
5. Any subsequent historical financial correction requires a separate guarded, per-record proposal with immutable corroborating evidence. Never bulk-backfill old `wonAt`, never assume a `pi_` or `cs_` reference proves a paid fee, and never combine evidence rejection with a buyer-fee refund.

The production historical reconciliation page is intentionally view-only. It is not an authorization to alter balances, customer payments, fees, bonuses or Sale history.
