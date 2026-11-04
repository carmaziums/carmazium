# CarMazium — Meta events and conversion setup
Date: 4 November 2026
Official Meta Pixel dataset: `4508142069469203`

## Purpose
Accurately measure UK seller acquisition without counting abandoned checkout,
general website traffic, buyer enquiries or repeated submissions as newly
completed vehicle listings.

**Do not create a second Meta Pixel or duplicate browser events through the
Event Setup Tool or Google Tag Manager.** The web app emits these events already.
Most events below exist; the two marked NEW are proposed in the related PR.

## Event taxonomy

| Meta event | What it means | Classification | Optimise seller ads for it? |
|---|---|---|---|
| PageView | A consented website page view | Traffic | No |
| SellerStartListing | Seller entered the listing process | Funnel start | No |
| RegistrationStarted | Signup form interaction | Funnel start | No |
| ViewContent | Vehicle detail viewed | Engagement | No |
| SellerCompleteListing | **Legacy:** listing wizard submitted; retail may still be awaiting payment; repeat submissions possible | Funnel step, **not a true completed paid retail listing** | No |
| Lead | Existing deduped-by-listing seller submission signal; legacy definition includes retail before payment | Legacy acquisition event | Retain until new goal validated; not primary long-term |
| AuctionListingCreated | Successfully created/submitted auction, awaiting review; new implementation dedupes per listing | Verified auction submission | Yes, if auction-specific campaign |
| Search | Vehicle or site search | Engagement | No |
| Purchase | Confirmed paid **retail listing fee** in the browser code, with `content_name=LISTING_FEE` | Real payment | Yes, if paid listings are the campaign objective |
| CompleteRegistration | Backend-confirmed newly created account | Registration | Registration campaign only |
| KycVerificationPaid | Confirmed verification payment | Payment, non-seller acquisition | No |
| DealerRegistration | Confirmed new dealer account | Dealer acquisition | Dealer campaign only |
| VehicleEnquiry | Buyer-to-seller enquiry/chat, kept distinct from seller leads | Buyer interest | No |
| RetailListingFeePaid (NEW) | Confirmed retail listing fee with actual GBP value; once per listing in browser | Paid retail listing | Yes, paid retail campaign |
| QualifiedSellerListing (NEW) | Verified auction accepted for review **or** paid retail submitted successfully for review; once per listing in browser | Strongest cross-channel seller acquisition | Candidate for primary optimisation after validation |

**An auction listing being submitted for review is NOT the same as an auction
being won, paid, collected or completed.** The latter need separate transaction
events from backend-confirmed handovers before they can become conversions.

## Meta Custom Conversions to configure in Events Manager

Data source: **Carmazium Official Pixel** (`4508142069469203`).
Create exact-event custom conversions (not a URL contains rule).

1. **CarMazium — Auction Listing Submitted**: event `AuctionListingCreated`. Category Lead.
2. **CarMazium — Retail Listing Fee Paid**: event `RetailListingFeePaid` (available after the new code is live). Category Purchase. Use event value and GBP from verified Stripe data.
3. **CarMazium — Qualified Seller Listing**: event `QualifiedSellerListing` (available after the new code is live). Category Lead.
4. Optional **CarMazium — Dealer Registration**: event `DealerRegistration`. For dealer campaigns only.

Use **only one primary optimisation event per ad set**. Do not add both
`Purchase` and `RetailListingFeePaid` as separate primary conversions for
the same payment, or add both `AuctionListingCreated` and
`QualifiedSellerListing` as separate primary conversions for the same auction.
The new events improve segmentation and audience rules; they do not represent
extra sales.

The old audience **CarMazium - Completed Listings - 30 Days** uses
`SellerCompleteListing`, which can include unpaid retail submissions. Do not
publish that exclusion. After the new code is deployed and tested, build a
30-day audience using `QualifiedSellerListing` for recently qualified sellers
and apply it only to new-seller acquisition ad sets. Do not exclude all website
visitors or all people who started listing.

## Diagnostics and reliability

- Lead diagnostics currently say 100% missing currency in both browser Pixel
  and Conversions API samples. The related PR adds `value: 0`,
  `currency: GBP` to **browser seller Lead** by default. A lead is not £1 in
  earned revenue. Real `Purchase` revenue remains the confirmed listing fee.
- **Server-side CAPI sender is not identified in the web repository.** The
  screenshot shows `Multiple` integrations and CAPI samples, so someone must
  inspect that sender (e.g. partner/GTM server) before claiming browser/server
  parity. It should set GBP + truthful value and use the same
  `event_name` / `event_id` as the matching browser event for deduplication.
  Do not create a second CAPI sender.
- The Meta diagnostics domain warning is an Events Manager traffic-permission
  setting. Confirm `carmazium.com`/`www.carmazium.com` under the official
  dataset; this is **not** fixed by a GitHub code deployment.
- One signed-in user may list more than one vehicle. Counts should be
  distinct by listing ID, not user ID. Browser localStorage guards repeat
  visits on the same device; it does **not** prove global deduplication across
  devices or against a partner's CAPI stream.
- Meta's conversion reporting is consent/attribution dependent. For a
  definitive completed-listings KPI, reconcile with unique listing records and
  actual Stripe payment records in the backend.

## Test and rollout checklist

- Run `node --test scripts/test-meta-lead-currency.test.mjs`.
- Run `node --test scripts/test-meta-qualified-listings.test.mjs`.
- Run `node --test scripts/test-google-ads-qualified-seller.test.mjs`.
- Pass typecheck and web build. Do not release if required checks fail.
- After release, test browser events only on the **live** site, per owner policy,
  with valid consent. Avoid fake payments and do not leave test cars visible.
- Confirm a **new genuine auction** emits `AuctionListingCreated` and
  `QualifiedSellerListing` only once, without a paid retail fee event.
- Confirm an **unpaid retail draft** does not emit
  `RetailListingFeePaid` or `QualifiedSellerListing`.
- Confirm a **verified paid and successfully submitted retail listing** emits
  `RetailListingFeePaid` with the actual GBP amount and
  `QualifiedSellerListing` once.
- Confirm KYC/deposit/buyer-fee payments never emit retail-listing purchase.
- In Events Manager > Test events/Overview, verify Pixel source, parameters,
  recent receipt, browser/server event IDs and diagnostics. Then create custom
  conversions and migrate seller exclusion audiences.
- Do not switch existing ad-set optimisation from legacy `Lead` until the
  new conversion is observed consistently with enough volume for delivery.
