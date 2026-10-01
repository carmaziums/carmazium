# CarMazium auction correction — Block 9: bind fee evidence to the current win

## Finding
The Block 8 expiry worker rechecked the winner's fee records under an auction-row lock but searched all historical COMMISSION transactions sharing the listing and user IDs. A relisted/reauctioned vehicle may be won a second time by the same dealer. An earlier COMPLETED £125 fee, £0 admin grant or abandoned PENDING checkout could falsely hold the newer overdue unpaid win. Separately, free-purchase grant application queried earlier completed fees across all runs, preventing a valid prospective grant on a later win.

## Scoped correction
- Under the existing auction-row lock, expiry considers only non-deleted matching COMMISSION transactions created **at or after the current win's persisted `wonAt`**. The pure payment-evidence guards enforce the same provenance even when passed an unfiltered record set.
- Earlier £125 payments, old £0 grants and abandoned pending checkouts no longer hold a later unpaid win. A pending £125 checkout created for the current win still blocks expiry until authoritative Stripe/finance reconciliation; a current completed £125 payment or eligible completed £0 grant still protects the win.
- Apply the same `createdAt >= wonAt` and `deletedAt: null` scope to the current-run duplicate-fee check inside admin free-purchase grant application. A completed fee for this same win still prevents double grants.
- Preserve previous blocks: 72-hour deadline, atomic payment-vs-expiry and duplicate-worker locks, mandatory seller funds confirmation, handover rejection/resubmission, £100 reward and legacy win protection.
- No historical financial rows, Stripe transactions, payout records, seller counters or database schema are edited by this change; the five existing anomaly records remain for manual review.

## Regression
- Pure guards: prior-run paid/granted/pending records ignored; current-run legitimate paid/granted/pending records honoured; unverified timestamps fail closed for payment evidence.
- Scheduled worker: earlier fee and pending checkout do not prevent a genuine newer expiry; current pending checkout still holds the win.
- Free-purchase service: older record does not consume a new valid prospective grant; current record prevents duplicate application.
- Run backend tests, typechecks, parity/release CI and preview builds on the exact PR head, followed by controlled production deployment verification. Live Stripe payments/refunds are excluded from test execution.

## Boundary
This is Block 9 only. It does not auto-expire or change status of any current-win unresolved checkout, does not silently refund captured fees and does not perform historical financial repair.