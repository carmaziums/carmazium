# Buyer warranty checkout

13 November 2026. Implements the buyer form and instant tariff quote requested after the previous release left a contact-admin placeholder. This document supersedes the old implementation-status/payment-route sections of `WARRANTY_RETAIL_LAUNCH_REVIEW.md`; the observed supplier account options and tariff remain unchanged.

## Customer flow

`/services/warranty?listingId=...` prefills an active retail listing. The existing combined `/dvla/lookup` supplies official DVLA and MOT information; the customer confirms missing fields, current mileage, service history, category, purchase/start dates, known faults, contact details and residential address. Historical MOT mileage is labelled and never used as current mileage.

Get a Quote saves a validated, immutable 30-minute retail quote. Standard 12-month cover is £360 car / £445 SUV including VAT, £2,000 per repair and £75/hour labour. £1,000 repair limit subtracts £30. Labour upgrades add 50%, 75% or 100% of the original standard price for £100, £150 or £200/hour. Airbags, driver assistance and emissions add £20 each; multimedia adds £80. No £5,000 or £125/hour options.

The website’s existing Stripe platform account receives the customer payment, following the latest instruction to collect money first and pay the supplier separately. There is no Connect transfer, supplier payment or automatic issuance. Pulse Cars Limited is described as the warranty broker, Warrantywise as the warranty provider, and CarMazium as the platform. None of this changes finance branding or routing.

Hosted Checkout uses the server quote total, GBP and VAT-inclusive pricing. Creating a checkout locks the payment parameters for one hour. Retries use the same order/session/idempotency key. The signed existing `/payments/webhook` handles success, asynchronous success/failure, expiry, refund and dispute events. Returning from Stripe also retrieves its canonical session. A URL flag never proves payment. Only matched paid evidence can set **Paid — awaiting warranty issue**.

Guest orders require a random 256-bit access token stored only in the originating browser; the database stores its SHA-256 hash. Signed-in orders are also accessible to their owning account at `/dashboard/warranties`. An email address alone never grants access. Guest emails identify the order and explain how to reopen it in the original browser.

## Admin fulfilment

`/dashboard/admin/warranty-orders` shows status filters, full saved details/declarations, itemised selections, Stripe references and email delivery status. Admin arranges and pays Warrantywise separately. The issue form requires an actual supplier reference, confirmed dates, and confirmation that the selected cover was issued and documents supplied. The API rechecks Stripe settlement and atomically changes only a paid, unissued order. Supplier eligibility is not claimed to have been decided automatically by this retail calculation.

Unissued paid orders support a full Stripe refund with a recorded reason and admin actor. Uncertain refund requests remain pending and retry the same idempotency key. Refunds/disputes block issuance. Issued warranty cancellations require review, not the unissued-order refund button. The outbox durably queues buyer/admin emails and in-app notifications with retries; email outages do not lose paid orders.

Dealers, including Pulse Cars, retain no warranty-provider dashboard controls. Only admin appoints providers. The public provider partnership contact remains below the buyer form. Seller finance defaults and all finance routing remain unchanged.

## Deployment and verification

Apply `backend/prisma/migrations/20261113203000_warranty_checkout/migration.sql` before deploying the backend. It adds two tables, enables RLS and revokes direct anonymous/authenticated Data API access. Do not run `prisma db push` on production.

Unit coverage includes all 256 tariff combinations, missing form sections, consent, token/owner boundaries, amount/currency/account/mode mismatches, unpaid and delayed payments, duplicate callbacks, stale failures/expiry, issuance, disputes and uncertain refunds. The isolated PostgreSQL workflow runs concurrent quote/checkout/webhook, issue, refund and outbox retry checks using synthetic Stripe responses. These are not live card payments or real supplier-issued warranties.

Browser acceptance must verify buyer form/lookup/options/quote/checkout/cancel and account order visibility, plus admin list/filters/details and dealer exclusion. Real success/decline/refund browser testing requires a separate Stripe test setup; never change the production Stripe key or fabricate paid/issued rows in the live database to claim a pass.

Supplier channel/eligibility observations in the prior review remain for the business to resolve operationally. The checkout explicitly describes an order awaiting issuance and a full refund if the selected cover cannot be arranged. It must not display supplier cost as the retail price or promise automatic cover activation.
