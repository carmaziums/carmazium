# Pay by Bank and seller bank payouts

Status: code prepared and automated checks passed; Pay by Bank is enabled in the actual Carmazium live account. End-to-end bank testing is outstanding. No real payments or payouts were initiated during development.

## Incoming platform payments

The £125 GBP winning dealer fee and service-job hosted checkouts now use Stripe's configured eligible payment methods rather than a card-only restriction. Retail listing fees and warranty Checkout already use dynamic methods. HPI checkouts use the same setting. The dealer checkout explicitly names CarMazium as the payee. Vehicle purchase funds remain outside CarMazium.

All hosted products handled by the payments webhook must have payment_status=paid before fulfillment. Existing signed webhooks handle later success and failure events. Existing auction eligibility, winner authorization, fee reservation and payout duplicate guards remain in place.

Provider status checked on 16 November 2026: Pay by Bank is ENABLED in the actual Carmazium live account's default payment-method configuration. An earlier connector read referred to a different account named Mazium; it is not evidence about production Carmazium and no settings were changed in that account.

The existing production Fly webhook was verified active with 75 deliveries and zero failures for the displayed week. Its subscriptions were extended from four to eighteen events, retaining the original four and adding checkout.session.async_payment_succeeded/failed, payment_intent.succeeded/canceled, refund.created/updated/failed, transfer.created/updated/reversed, charge.dispute.created/updated/closed and charge.refunded. The endpoint URL, signing secret and API version were not changed.

Stripe Checkout branding was updated with the repository's official CarMazium logo, a white background, accessible red button (#c91620), Inter typography and rounded controls. Customer support email/URL and existing terms/privacy URLs were supplied and enabled on Checkout. The generic statement descriptor is now CARMAZIUM instead of CARMAZIUM SELLER FEE.

Release validation:

1. Deploy through the normal repository CI and verify that live Checkout offers Pay by Bank to an eligible UK customer. Do not create real fees or charge customers merely for QA.
2. In an authorized Stripe sandbox, test paid, pending, cancelled, failed and duplicate webhook cases for the £125 dealer fee, listing fees, warranties and service jobs. Verify exact amounts, payee, receipt and auction status. A checkout return URL alone is never proof of payment.

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
