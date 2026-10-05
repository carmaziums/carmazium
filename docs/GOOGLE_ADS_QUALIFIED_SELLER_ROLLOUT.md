# Qualified Seller Listing — Google Ads rollout

Implemented: 3 October 2026. This change is deliberately **two-stage** so existing Google Ads bidding does not lose its only proven primary signal during migration.

## Current state

- Website sends confirmed retail `listing_fee_paid` to the existing live **Listing Fee Paid** action. This event and its label are unchanged. When the seller has explicitly accepted tracking and Stripe returns a customer email, the Ads-only path also supplies the normalised email through Google's `user_data` interface for Enhanced Conversions; the email is never added to GA4, GTM dataLayer events or CarMazium's generic analytics payload.
- Website sends `qualified_seller_listing` to first-party analytics, GTM's consent-gated dataLayer and GA4 when either:
  1. A non-admin **auction** listing has successfully been submitted to the actual admin-review queue by the backend `publishListing` call; or
  2. Stripe session status returns **paid** and its metadata identifies a **retail listing fee** and a listing ID.
- Do not count generic form submissions, valuations, registration, failed submits, unpaid checkout attempts, admin listings, or auction buyer fees.
- For Google Ads, the qualified event always uses `transaction_id=qualified_listing:<listing_id>`, so rejections, resubmissions, page refreshes and auction-to-retail conversion cannot create multiple new Ads conversions for the same vehicle. Google Ads uses transaction ID to deduplicate repeated hits for the same action. The immediate-page guard also prevents repeats while mounted. GA4 raw event reporting can have repeat lifecycle entries; analyse distinct listing IDs for unique-vehicle reporting.
- `NEXT_PUBLIC_GADS_LABEL_QUALIFIED_SELLER` is **deliberately blank** until the corresponding Google Ads conversion action exists and is ready for test. Until then, the qualified event does not emit an Ads hit and cannot change bidding.

## Account configuration needed (Google Ads account 699-823-8086)

The connected Windsor.ai and Supermetrics integrations expose conversion-action *reads* and campaign updates, but neither currently exposes creation/editing of Google Ads conversion actions. Complete this part in Google Ads' conversion-goal UI:

1. Goals → Conversions → create a **new website conversion action**. Name it **Qualified Seller Listing** and categorise it as **Submit lead form**. Do not reuse the removed old `Seller Listing Submitted` action or create a page-view-based action.
2. Use **Count: Every** with the stable per-vehicle `transaction_id` supplied by this code: the same vehicle must deduplicate, while two genuinely different vehicles submitted from one ad click should count as two listings. Use a consistent non-revenue count-based value rather than inventing a purchase amount, with a suitable lookback window. Configure the action as **Secondary** initially, so current bidding remains on `Listing Fee Paid` while testing.
3. Select manual setup / code snippet and capture the **conversion label only** (the part after `AW-18328618718/`). Existing GTM is the only base-tag loader; do **not** add a second base tag or duplicate GA4/GTM event tags. The site will send the correct event with the new label once configured.
4. **Configured 4 October 2026:** New Google Ads conversion action `Qualified Seller Listing` (ID `7817991549`, label `jIu4CP2q9I8dEN6N4qNE`) was confirmed directly in the connected Ads account. `NEXT_PUBLIC_GADS_LABEL_QUALIFIED_SELLER` has been added to Vercel **Production only**. This documentation update initiates a new production build to bake the label into the Next.js client bundle. Preview/development environments must never fire production conversion tags. Keep the action Secondary until a verified real event is recorded.
5. Verify the new action's destination in a live, consensual test for a **genuine** non-admin auction submission to review and a **genuine paid** retail session with different listing IDs. Check the Ads/Tag Assistant diagnostics, the exact `send_to` value, valid transaction IDs, and that the old paid-retail hit still fires exactly once. Never fabricate live customer conversions or claim that a test conversion is organic revenue.
6. Ensure both Search and Performance Max campaigns use the intended *account-default* qualified goal, or their own intentionally selected goals. Only **after** the action is receiving real valid conversions, change the **new action to Primary** and **Listing Fee Paid to Secondary** in one coordinated rollout. Otherwise every retail payment will count twice in Maximise Conversions.
7. Allow normal attribution/reporting delay and monitor paid clicks, qualified conversions (split auction/retail in GA4), spend per qualified listing, conversion diagnostics and Smart Bidding's learning status. Compare with server-created listings; a user who pays but never returns from Stripe may not trigger client-only conversion tracking.


## Account audit — 5 October 2026

- **Qualified Seller Listing** is now **ENABLED + Primary** and has recorded a real conversion.
- **Listing Fee Paid** is also still **ENABLED + Primary**. This is no longer the intended end state: a paid retail listing emits both `listing_fee_paid` and `qualified_seller_listing`, so keeping both Primary can train Maximise Conversions on two outcomes for one retail seller. Once Qualified Seller Listing is the chosen optimisation signal, change **Listing Fee Paid to Secondary** while leaving it enabled for reporting/value measurement.
- Google Ads shows **"Issues detected with your enhanced conversion setup"** on Listing Fee Paid. The root cause in the application was that the conversion event carried value/currency/transaction ID but no first-party `user_data`. This branch supplies a consented Stripe customer email only to the Ads conversion call. Google hashes it before transmission.
- Enhanced-conversion diagnostics are delayed and based on recent eligible conversion volume. After deployment, validate with a genuine consensual paid listing and allow reporting time before judging the diagnostic as cleared.

## Known limitation and follow-up

Client-side Google Ads/GA4 emissions require the user's browser to reach the successful auction or paid checkout page. Stripe can receive payment without the customer returning to the site. Full attribution for that case requires a separate, consent-respecting backend/Google Ads offline conversion or enhanced-conversion workflow with stored click identifiers, a secure API integration and transaction-id idempotency. Do **not** claim this rollout has solved missing-return conversions until that separate pipeline exists.

## Rollback

The legacy `listing_fee_paid` action and label have not changed. To disable only the new Ads event immediately, remove `NEXT_PUBLIC_GADS_LABEL_QUALIFIED_SELLER` from Vercel and redeploy; then switch Google Ads Primary back to `Listing Fee Paid` if it had been changed. The feature branch/merge commit can be reverted independently without data migrations.

## Google Tag Manager ownership migration — 4 October 2026

- The owner created and published the replacement container **GTM-KK242C67**, version **2** ("CarMazium Google Tracking V1"). It contains a Google Tag for the existing GA4 measurement `G-MR12LCBSXY` using `send_page_view=false`, firing on **Initialization — All Pages**, and a Google Ads Conversion Linker firing on **All Pages**.
- Vercel's `NEXT_PUBLIC_GTM_ID` environment value was updated from **GTM-PVHM3RR2** to **GTM-KK242C67**, retaining both original environment targets (production and preview). This documentation commit forces a fresh Next.js deployment so the new public GTM ID is embedded in the generated JavaScript.
- Retain old **GTM-PVHM3RR2** as the exact rollback value until live Tag Assistant confirms the new container and Google Ads/GA4 destinations. Do not delete the old container until the replacement is verified.
- The existing qualified seller Google Ads conversion ID/label and existing paid-listing conversion remain unchanged. The new action must stay **Secondary** until real successful seller listing signals are verified. No test or artificial listing should be counted as a business conversion.
- After the new deployment is READY, check Tag Assistant using the owner's account, validate that both GA4 `G-MR12LCBSXY` and Google Ads `AW-18328618718` destinations load once and consent defaults precede tags, and confirm Google Ads reports a real qualified seller listing. A published GTM version and a READY deployment alone do **not** prove the entire attribution pipeline.
