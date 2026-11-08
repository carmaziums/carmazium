# CarMazium native app — store-payment compliance assessment
**Date:** 25 October 2026  
**Scope:** UK Google Play and Apple App Store, Android + iOS native Expo app. Development / launch-readiness assessment only.  
**Status:** RELEASE HOLD — classifications involving digital purchases require implementation and/or written store-policy clarification. This document is not a determination by either store, tax or legal counsel.

## Source-of-truth business rules
- Auction seller listing: **FREE** (£0).
- Retail BASIC listing: **£1** one-off until sold. STANDARD **£10** includes vehicle history. PREMIUM **£25** includes vehicle history and a 28-day Featured Boost; separate Featured Boost **£25** for 28 days.
- Auction buyer fee: **£125** (CarMazium platform charge), paid to unlock winner contact after a completed auction.
- Retail buyer fee: **£0**.
- Vehicle purchase funds go directly from buyer to seller, not through CarMazium.
- The existing website's Stripe integrations and these fees are NOT to be silently changed by mobile-store work.

## Evidence in current native code (main on 25 October)
- `src/hooks/useListingFeePayment.ts`: Stripe PaymentSheet for retail BASIC/STANDARD/PREMIUM listing fees.
- `src/screens/sell/SellCarFlowScreen.tsx`: native Stripe PaymentSheet for listing fee and £9.99 HPI/vehicle-history report.
- `src/screens/seller/SellerListingsScreen.tsx`: Stripe for publishing drafts, plus POST `/featured-boost/:listingId` followed by a Stripe Checkout URL in the embedded `StripeCheckoutModal` WebView.
- `src/screens/main/PurchaseFlowScreen.tsx`: native Stripe PaymentSheet for the auction buyer's platform fee.
- `src/constants/pricing.ts` and `src/screens/main/PricingScreen.tsx`: native pricing and boost descriptions.
- Release package and bundle identifiers: `uk.carmazium.app`.

## Platform policy sources (reviewed 25 October 2026)
1. Apple, UK App Review Guidelines, 3.1.1, 3.1.3(e), 3.1.3(g): https://developer.apple.com/app-store/review/guidelines/uk/
2. Google Play Payments policy, especially paragraphs 2, 3, 4: https://support.google.com/googleplay/android-developer/answer/9858738?hl=en
3. Apple EU-specific alternative payment options: https://developer.apple.com/support/payment-options-on-the-app-store-in-the-eu/ — **do not assume EU entitlements apply to the UK storefront**.

## Fee-by-fee classification / decisions required
| Native transaction | Current method | Google Play UK assessment | Apple UK assessment | Release decision |
| --- | --- | --- | --- | --- |
| Free auction seller submission, £0 | No fee | No IAP purchase to classify | No IAP purchase to classify | Preserve free UX; test |
| Retail BASIC £1 | Stripe PaymentSheet | In-app listing visibility/digital service strongly indicates Play Billing unless a specific physical-marketplace exception is confirmed | Listing placement visible within the app may require IAP; request a documented classification if treating as real-world sales service | **BLOCK native paid retail store release until resolved** |
| Retail STANDARD £10 | Stripe PaymentSheet | Same issue, with additional vehicle-history component | Same issue; paid placement/report may have distinct rules | **BLOCK** |
| Retail PREMIUM £25 | Stripe PaymentSheet | Includes an in-app Featured Boost — strong Play Billing risk | Apple explicitly requires IAP for ads/boosts displayed inside the same app | **BLOCK** |
| Separately purchased 28-day Featured Boost £25 | Stripe Checkout in embedded WebView | Digital in-app promotion likely requires Play Billing; WebView checkout is prohibited unless a documented exception/programme applies | Apple 3.1.3(g) directly identifies boosts in same app as IAP goods | **BLOCK** |
| Auction winning buyer fee £125 | Stripe PaymentSheet | Google explicitly excludes online auctions from mandatory Play Billing. Document commercial structure to distinguish from generic premium digital feature | Likely part of physical vehicle acquisition/service outside the app (3.1.3(e)); must verify the actual seller-contact unlock and payment value proposition | Review, then test |
| Separate £9.99 vehicle-history report | Stripe PaymentSheet | Downloadable/viewable report delivered in app is likely digital content; physical-vehicle due diligence exception not established | Report consumed inside app likely digital content; physical service exception not established | **BLOCK pending classification** |
| ID/address verification £1 check (if charged) | Verify actual native implementation | Verification/authentication fee is not automatically an exempt physical-good payment | Requires factual determination whether charge is refundable card verification or purchase of an in-app feature | Verify before submission |
| Delivery / physical inspection (if native payment exists) | Verify each flow | Generally physical services and not Play Billing | Generally services delivered outside app under 3.1.3(e), not IAP | Verify use and payment recipient |

A published listing is still an in-app digital display, even where the underlying sale involves a physical car. Do not conflate the physical vehicle sale with the separate listing-advertising purchase. Do not classify the £125 auction fee automatically as the same service as a listing/boost.

## Safe engineering implementation sequence
1. **Document store determination** for each paid purchase (especially BASIC, STANDARD, PREMIUM, boost, and history report). Record permitted purchase methods by platform and storefront. Do not rely on EU-specific payment-programme exceptions for UK users without explicit applicability.
2. **Preserve catalogue price/rules** in a single backend entitlement model; store billing is an alternative payment rail, not a change to CarMazium’s £0/£1/£125 business contract. Confirm taxes/store tier pricing before committing displayed prices.
3. For digital purchases requiring it, implement **Apple StoreKit IAP and Google Play Billing** on native, with server-side signed transaction/receipt validation and asynchronous store notifications. Use stable product IDs and prevent purchase replay, concurrent duplicate transactions, delayed approval, refund/revocation, restoration, and cross-account entitlement leaks.
4. The backend is authoritative: never unlock `PENDING_REVIEW` or `ACTIVE`, badge, boost, history report, or seller contact merely because a client callback says "success." Only a validated, idempotent, non-refunded entitlement can unlock the corresponding product/service. Admin approval remains required for listings.
5. **Remove prohibited native Stripe and WebView checkout entry points** *only for classified digital products* after the supported store replacement is implemented. Maintain the website payment service and Google/Apple permitted physical-sale/auction-fee flows. Do not merely link native customers to the existing website checkout as a workaround.
6. Use store sandbox transactions and signed Android/iOS testing builds: purchase success, user cancel, pending, duplicate tap, replay, webhook outage, app restart, refund, chargeback/revocation where applicable, store account switch, existing paid web entitlement, and listing approval state. Never charge a real card or use a real customer's listing during QA.
7. Confirm App Store Connect seller legal entity, paid-app agreements where necessary, EU trader disclosures, age/data/privacy forms, test account, review notes; verify Google Play developer identity and phone verification. No customer rollout before sign-off.

## Must NOT happen
- Do not switch production Stripe products off, change production prices, rotate the intentionally configured API keys, or add fallback paid external checkout links to bypass store rules.
- Do not merge a billing change without backend/server review, a documented store classification and sandbox evidence.
- Do not treat a source/CI pass as equivalent to store approval or a real-device acceptance pass.
- Do not trigger a potentially billed EAS build, live purchase, live bid, public APK/OTA rollout, App Store Connect submission or Google Play rollout without separate release approval.

## Open decisions and next evidence
- [ ] Store-specific written decision for £1/£10/£25 listing tiers and in-app boost.
- [ ] Store-specific written decision for HPI/report payments.
- [ ] Check any country-specific entitlement programme actually available to CarMazium, **with proof**, before implementing alternative payments.
- [ ] Decide product identifiers, tax/display rules and verification backend architecture; implement native billing where required.
- [ ] Signed test builds plus test-device runs on both platforms.
- [ ] Update launch issue #653 and close blocker #652 only after actual implementation/compliance evidence.

**Tracking:** #652 (payment blocker), #653 (signed-build customer QA), #656 (native DVLA identity correction).
