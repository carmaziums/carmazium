# CarMazium auction correction — Block 10 final safety gate

## Baseline
2026-10-02 production main `664b59435c8c7e15cd0faad2b213c2ba7edc2a56` contains auction Blocks 1–9. This Block 10 is a final targeted payment/waiver concurrency correction and a release acceptance review, not a historical-finance repair.

## Confirmed remaining race
`FreeListingGrantsService.applyPurchaseGrantToAuctionIfEligible` previously checked only completed current-run COMMISSION fees; a current-run PENDING Stripe Checkout or native PaymentIntent was not considered. Separately, `createCheckoutSession` and `createPaymentSheet` checked the payable winner before external setup and subsequently created PENDING transactions without taking the auction-row lock. A waiver or concurrent checkout could win between the initial read and Stripe session/intent creation.

## Correction
- Hosted Checkout and native Payment Sheet both use the **same guarded fee-reservation transaction**. Lock and re-read the exact auction row; revalidate winner, status, seller-side cancellations, the fee-paid/fee-transaction flags and the existing 72-hour deadline. The PENDING £125 fee record is created inside this lock before any Stripe charge/session creation.
- Hold all additional payment requests when a current-win, non-deleted, PENDING or COMPLETED COMMISSION record exists. Existing older-run transactions are excluded by the current `wonAt`; legitimate older legacy records without `wonAt` are conservatively blocked on any pending/completed matching transaction. A grant is only created if there is **no pending or completed current-win** COMMISSION record, under that same auction row lock.
- Preserve Stripe webhook run identity and expiry CAS protections. Do not automatically mark old PENDING transactions FAILED or infer a refund; the original processor's authoritative status must be reconciled first. Cancelled/abandoned sessions may need support to release a held payment attempt.
- No modifications to customer payments, seller payouts, historical anomalies, original 23 protected legacy wins, auction policy, seller £100, HPI, retail fees or schema.

## End-to-end source acceptance matrix (code/CI, not fabricated live transactions)
1. VRM and listing submission: existing listing-readiness checks, auction moderation approval and seller authorization.
2. Dealer KYC and access: verified canonical dealership identity, staff bid/pay permissions and personal-buyer bid exclusion.
3. Live bidding and close: reserve and bid state, anti-snipe extensions, Buy It Now collision safeguards and winner identity.
4. Post-win: canonical `wonAt` + 72-hour fee deadline and reminders; expired unpaid wins guarded against webhook races and duplicate workers.
5. Payments: web/mobile server-derived £125 fee; exact matching Stripe-paid callback and atomic winner/run claim; this block serializes new checkout reservations with £0 grants.
6. Seller handover: buyer fee gate, buyer-to-seller payment (not CarMazium custody), explicit seller funds confirmation, evidence upload, admin rejection without buyer refund and corrected resubmission.
7. Seller reward: bonus only after approved handover; notification distinguishes approval from actual payment and records pending/failure accurately.
8. Historical exceptions: 23 legitimate pre-August `wonAt=NULL` auctions remain protected. The five overlapping historical payment anomalies still require manual processor-account confirmation before any repair.

## Release verification
- Execute backend Jest/test/build/typecheck, web/native checks and product/release certification on exact PR head.
- Require both Vercel preview builds READY; merge only when checks are green.
- On exact merge commit, verify Fly CI and rolling health checks, and both Vercel production deployments.
- Do not exercise charge/refund on live Stripe or mutate production financial data solely for testing. A controlled real-payment staging test and production read-only financial reconciliation remain separate operational tasks.
- A queued/unfinished current-run checkout intentionally blocks a new one until verified; this is a conservative safety gate, not automated checkout retry/resume UX.
