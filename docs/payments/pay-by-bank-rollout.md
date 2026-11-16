# Pay by Bank and seller bank payouts

Status: prepared changes; provider activation and end-to-end bank testing are outstanding. No real payments or payouts were initiated during development.

## Incoming platform payments

The £125 GBP winning dealer fee and service-job hosted checkouts now use Stripe's configured eligible payment methods rather than a card-only restriction. Retail listing fees and warranty Checkout already use dynamic methods. HPI checkouts use the same setting. The dealer checkout explicitly names CarMazium as the payee. Vehicle purchase funds remain outside CarMazium.

All hosted products handled by the payments webhook must have payment_status=paid before fulfillment. Existing signed webhooks handle later success and failure events. Existing auction eligibility, winner authorization, fee reservation and payout duplicate guards remain in place.

Provider status checked on 16 November 2026: the connected Mazium live account has Pay by Bank set off/unavailable in its default payment-method configuration. No v2 money-management financial accounts were returned. The Stripe Dashboard requires sign-in; activation was not attempted with fabricated details.

Before release:

1. Sign in to the Mazium Stripe Dashboard and activate Pay by Bank in Payment methods, completing any provider requirements.
2. Review the other enabled methods because dynamic Checkout can display other eligible Dashboard-enabled methods. Card payment remains available.
3. In an authorized Stripe sandbox, test paid, pending, cancelled, failed and duplicate webhook cases for the £125 dealer fee, listing fees, warranties and service jobs. Verify exact amounts, payee, receipt and auction status. A checkout return URL alone is never proof of payment.
4. Deploy through the normal repository CI and verify that live Checkout offers Pay by Bank to an eligible UK customer. Do not create real fees or charge customers merely for QA.

## Seller bonus payouts

The existing manual bank-transfer path remains available: sellers save their account holder name, six-digit sort code and eight-digit account number in Profile > Payouts. The fields now appear before Stripe Connect and are validated server-side as well as in the web form. Format checks do not verify ownership or account existence. Saving details never records a payout.

The existing Stripe Connect automatic payout path remains unchanged. Direct automated payouts to recipients without Stripe accounts are NOT implemented or enabled by this change.

To complete that requested path, the account owner must activate an eligible UK Stripe financial account/Global Payouts setup and confirm the intended seller promotional-bonus use case with Stripe. Use a sandbox for development. Keep existing manual transfers available while activation is outstanding.

The subsequent integration needs provider-hosted recipient collection or verified recipient details, a funded GBP source account, recipient and payout-method references, explicit outgoing payout records, stable per-auction idempotency, concurrency protection across manual/Connect/bank routes, and verified provider reconciliation for processing/paid/failed/returned statuses. Retain handover approval, paid buyer fee, cancellation/refusal and proof gates. Do not reuse a Connect transfer identifier as evidence of a completed bank payout. Do not collect bank login credentials in CarMazium.

Sources:
- https://docs.stripe.com/payments/pay-by-bank
- https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods
- https://docs.stripe.com/global-payouts

## Validation

182 tests passed across payments, service-job payments, warranties, payout idempotency and bank-detail validation. Frontend and backend TypeScript checks passed. Live bank authorization and direct automated seller payouts have not been tested.
