# CarMazium Android parity — Block 1 implementation and verification

**Date:** 21 November 2026
**Scope:** P0 correctness and first-party native navigation for the original customer Android package `uk.carmazium.app`, compared with the logged-in mobile website.

## Baseline observations

- In the earlier same-account audit, the website labelled a £7,900 received offer as **WITHDRAWN** while customer Android build 111 displayed **PENDING**. No offer was accepted, rejected, or changed during testing.
- The Android app's original dealer Saved card was observed displaying **0** saved auctions while the website showed **3**. A repeat test verified that the old Saved card remained native; an earlier Chrome handoff could not be reproduced consistently. Do not claim the card always opened Chrome.
- Original build 111's Saved view used a generic watchlist rather than the separate dealer auction feed. The canonical website uses `/watchlist/auctions` for dealer auctions and `/watchlist?type=retail` for retail listings.
- At a subsequent live test, dealer offers showed **Access Check Unavailable**. The app did not bypass the permissions check. No account access, backend offer state, or signed-binary parity was verified during this condition.

## Changes (first-party native source)

1. Dealer Saved dashboard card now opens an explicit **DealerSaved** stack screen, rendered by `DealerSavedScreen` rather than the hidden generic Saved tab. This reads the dealer-specific auction and retail saved feeds.
2. Native guided-tour routing and React Navigation links for `/dashboard/dealer/wishlist` and `/dashboard/dealer/offers` now resolve to real first-party screens. Android HTTPS intent filters include these routes for both `carmazium.com` and `www.carmazium.com`.
3. Dealer received offers use one authoritative `/offers/received` snapshot. Invalid statuses do not become PENDING, and the app hides stale rows while refreshing on screen focus and when Android resumes.
4. Before an offer accept/decline/counter write, the app refetches the current server offers and blocks the write if the status, counter turn or updated timestamp changed, the offer is missing, or the listing is no longer active. Double actions are prevented locally.
5. No backend schema, transaction amounts, listing fees, buyer/seller incentives, payout settings, legal agreements, or production environment configurations were changed.

## Verification

- New tests cover withdrawn and other terminal states, concurrent buyer withdrawal during dealer confirmation (no PATCH), native Saved screen navigation, exact dealer Saved watchlist endpoints, native tour path, Android intents, and caller-side refresh behaviour.
- Existing dealer offer, saved-car, dashboard, tour, role-permission and navigation tests run alongside the new tests.
- The change has to pass the full native automated suite, TypeScript compilation and `git diff --check` before merge.
- **Manual signed APK verification remains outstanding** until the new customer candidate is built and installed over the existing signed app with data preserved.

## Required device acceptance before customer publication

- Keep package `uk.carmazium.app` and the original release signing certificate. Confirm in-place install over the customer's APK; do not clear app data.
- On the same logged-in dealer account, the Saved card must remain inside the original Android app, show the same three saved auctions as the website (unless the authoritative data has changed), and support the retail tab and vehicle/auction details.
- On the same account, confirm received offer status matches the website after a fresh read, including the withdrawn example; PENDING must not be shown for a withdrawn offer, and no stale accept/decline/counter write is possible.
- Verify both host variants of the deep links and the guided tour destination. Verify all 21 dealer dashboard card destinations remain native.
- If account permissions cannot be checked or the backend is unavailable, keep the screen fail-closed and mark live acceptance **blocked**, not passed.

**Release policy:** This block alone does not establish full website/app UI parity. Do not silently replace the customer APK without binary signing, version, same-account manual QA, and release acceptance.
