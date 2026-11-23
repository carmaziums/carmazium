# TradeXchange UX — Block 3: auction and trading journey
Date: 23 November 2026. Continuation of draft PR #987.

- Replaced the old auction guide in place. Both seller and verified-dealer journeys render on the canonical public page, with direct auction listing, dealer browsing, retail browsing and Partner Account guide links.
- Corrected Buy It Now acceptance deadline, below-reserve provisional offers, late-bid extension, standard £125 fee and waiver, 72-hour fee deadline, direct vehicle payment and conditional £100 seller incentive. Updated the general marketplace guide, native guide data and MaziuM knowledge.
- Existing won-auction delivery and inspection actions retain the original purchase-linked APIs. Hide refused-purchase actions and inspection after approved handover; honour service feature flags; distinguish fee refunds from waivers; validate transport postcode. Back navigation returns to dealer purchases.
- Preserved auction engine, fee collection, existing job records and provider onboarding. No backend transaction changes, no new public route.
- Local verification: 235 targeted automated tests passed, native guide content check, auction fee deadline and sequencing guards, product parity and 75 knowledge source fingerprints passed. Fixed pre-existing Windows newline mismatch in purchase snapshot test without weakening assertions.
- Local public browser checks: 1440, 390 and 320 px in both themes; HTTP 200, canonical route, both seven-step journeys, working anchor navigation, no overflow or page errors. Real authenticated transactions and physical-device tests remain release gates. No production deployment.
