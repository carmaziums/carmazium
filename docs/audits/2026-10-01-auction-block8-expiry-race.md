# CarMazium auction correction — Block 8: 72-hour unpaid-win race

This block corrects the code-level race documented in issue #341. No historical auction, buyer-fee, Sale, Stripe, payout or seller-counter data is modified by deployment.

## Production behaviour
- The hourly expiry task invokes `GuardedAuctionExpiryService`. Its candidate scan is **not** authority to cancel.
- Inside a short Prisma transaction, each candidate auction row is locked using `SELECT ... FOR UPDATE`. The canonical auction and linked listing are re-read under the lock.
- A win can expire only if ENDED, older than 72 hours from its recorded `wonAt`, has the same current winner, has no fee-paid flag/transaction link, no seller-funds attestation, no submitted/protected handover evidence, no approved £100 bonus and no recorded inspection refusal.
- Check the **current winner's** non-deleted COMMISSION transactions under the lock. A completed £125 payment, completed eligible £0 admin grant or **any unresolved PENDING checkout** prevents expiry. An unresolved pending transaction is not proof of payment; it is deliberately a fail-closed hold until its original payment provider/account is checked.
- The transaction conditionally claims cancellation and atomically restores the linked retail listing (if any), deletes only the matching Sale and decrements the seller sales count only if that Sale was actually removed. Only the successfully committed worker emits user notifications and websocket updates.
- The former unconditional `AuctionsService.revertUnpaidWins` fails closed and must not be used. Cron is wired exclusively to the guarded worker.
- Before creating a new web/mobile fee checkout, the server checks the canonical 72-hour deadline. Pre-feature historical `wonAt=NULL` records remain untouched.

## Successful Stripe callbacks
- Web and native callbacks must refer to an existing completed, non-deleted £125 COMMISSION transaction with exact listing and winning buyer identity.
- Hosted Checkout `checkout.session.completed` must also report `payment_status='paid'`. A still-unpaid completed session cannot unlock the auction.
- Applying the fee uses an atomic conditional update of the exact current ENDED auction run, winner and `wonAt`. An old checkout cannot pay a reauction, even if the same dealer later wins again.
- Duplicate callbacks only succeed idempotently if the same fee ID was already applied to this same auction run.
- If a captured fee cannot be applied because the win was cancelled/reassigned or the run changed, keep the transaction's completion record and emit a finance-review error. **Never** silently reinstate the win, invent a refund, issue a payout or reassign the fee.

## Manual operations
Unresolved PENDING records can hold an overdue win beyond its scheduled cutoff. This is intentional protection against a charge still in progress. Finance must verify the original Stripe merchant account's Checkout Session or PaymentIntent status and charge/refund history before marking any stale transaction FAILED/REFUNDED or attempting another correction. Do not blindly release held auctions. A production account different from the connected account may own historical charges.

The five pre-existing historical financial anomalies remain unchanged. The 23 matching pre-6-August auctions with no `wonAt` are grandfathered and never enter the new expiry scan.

## Required verification
Run all backend tests, web/native typechecks and release certification on the exact PR head. Verify both Vercel preview builds. After merge, require a successful main-branch Fly rolling deployment/health check and both Vercel production deployments on the exact merge commit. Confirm a production read-only audit reports no active overdue unpaid candidates or additional historical corruption before closing the block. Authenticated real Stripe charge/refund simulations require a controlled staging account; never use live payments just to exercise a regression test.
