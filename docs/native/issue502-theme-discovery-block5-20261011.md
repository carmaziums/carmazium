# CarMazium Light/Dark/System parity — Block 5/10: discovery screens

Date: 11 October 2026 · Issue #502. **50% of gated SOURCE-development blocks, not phone/customer-release readiness.**

This is a stacked review branch based on Block 4 draft PR #506 (itself based on #505/#504/#503/#501). Do not merge overlapping drafts independently.

## Scope of source changes

- Buyer `HomeScreen.tsx`: website semantic body background, hero greeting, Buy Cars entry point, live/upcoming auction rail surfaces, retail cards, make/body-type cards, section titles, recent listing prices, search field and inline AI response card. Branded red/white CTA and photograph overlays remain fixed contrast on purpose.
- Buyer `SearchScreen.tsx`: dynamic background and status bar; listing/filter/search headings, auction discovery banner, search field, price/make/transmission/body filters and chips, sort/menu controls, filter modal, search input and readable labels. AI search filter logic, back-end query semantics, result count and client-side sort remain untouched.
- `LiveScreen.tsx`: live/upcoming auction cards and listing metadata, bid amounts, countdown digits, filter search, auction navigation and empty states use the selected semantic palette. Own-auction labels, protected dealer bidding permission checks, reserve restrictions and transaction paths are unchanged.
- Shared `VehicleCard.tsx`, `HorizontalVehicleCard.tsx`, `LiveBidCard.tsx`: card surfaces, borders, titles, prices and specification text; lightbox/watchlist functions preserved. Shared `SpecBadge.tsx` and `AuctionCardBadges.tsx` use semantic fills and text without changing gearbox/trust definitions.
- Native home screen virtualised `Rail` still uses `FlatList`, stable data selectors, and account-role store selectors; a source review caught/removed unintended style-identifier substitutions before the PR was opened.
- `scripts/test-native-theme-discovery-block5.test.mjs` tracks semantic styling plus existing search/filter/role/watchlist behaviours; wired to Release Certification.

## Verification requirements and boundaries

1. GitHub release-contract tests, native TypeScript, website/backend typechecks, backend tests/build, One Product Parity and Mobile Listing CI must pass on the exact final branch SHA.
2. Run buyer retail, Search, Make/Model/Transmission/Body filters, dealer Live Auctions, own listing, bidding permission denial, save/unsave and loading/empty states on actual Samsung + iPhone before visual signoff. Compare each against the corresponding live website, including large text and keyboard.
3. No current release-signed customer APK, iPhone TestFlight build, app store release, on-phone light-mode acceptance or public website download was produced by this change. Public `/download-app` remains gated OFF.
4. User-facing Light/Dark/System picker stays unavailable until Blocks 6–9 migrate Sell, detail, dealer, account, MaziuM, messages and remaining screens. Some deeply nested screen-specific notices and photographic overlays still use original branded static colours; Block 10 must catch real-device contrast issues.
5. No role/access permissions, customer transactions, bidding/reserve logic, payments, KYC, credential or database changes.

**Stop at 50%**. Next Block 6 only after explicit owner `proceed`: selling flows, vehicle detail and offer surfaces.
