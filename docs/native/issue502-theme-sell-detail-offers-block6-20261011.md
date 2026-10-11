# CarMazium native theme parity — Block 6 of 10 (60% source checkpoint)

Date: 11 October 2026. Parent: GitHub Issue #502. Stacked source branch based on Block 5 draft PR #507; includes prior Blocks 1–5 and original menu repair. Do not merge overlapping drafts separately.

## Seller and purchasing UI migrated

- `SellLandingScreen.tsx`: correct semantic background, valuation forms and market valuation results, the free-auction red action and the £1-retail neutral action. On red auction CTA the description remains white; the £1 retail action uses readable dark-on-light secondary text. No marketing fees, valuation calls or DVLA query logic changed.
- `SellCarFlowScreen.tsx`: wizard page and header, shared form inputs, type pickers, chips, Yes/No, photo sections, damage/valuation/retail-pricing, declaration labels/check borders, section boxes, review pages and fixed bottom buttons use semantic palette. Registration field deliberately remains yellow/black. Affected values and upload flows are unchanged.
- `VehicleDetailScreen.tsx`: retail listing title/price/specifications, dealer/seller trust and business details, history/reviews, delivery and finance *illustrations*, and buyer offer sheets use semantic dark/light surfaces. Fullscreen photo viewer retains its black background for photo contrast; image gesture and chat callback paths untouched.
- `AuctionDetailScreen.tsx`: auction header/cards/specs, buyer fee notice, bid console/input, seller contact, Buy It Now panels and status follow semantic palette. **£125 auction buyer fee, bidder permissions and reserve enforcement are unchanged.** Auction sellers receive payment from buyers directly.
- `BuyerOffersScreen.tsx`, `SellerOffersScreen.tsx`: offers and counter-offer forms use light/dark-aware rows, headings and inputs. No offers, sold-confirmation, delivery or counter payloads changed. React memoised card renderers update with the palette.
- `CounterLedger.tsx`, `Price.tsx`, `StripeCheckoutModal.tsx`: offer amount/timestamps, generic price and hosted checkout *shell* use readable foregrounds and backgrounds. **The Stripe WebView itself, success/cancel interception, secrets and native PaymentSheet configuration were not changed.**

## Source certification and release gates

- Added `scripts/test-native-theme-sell-detail-offers-block6.test.mjs` to Release Certification to assert semantic styling, actual price display, role and offer boundaries, fee disclosure, original Stripe callbacks, and disabled Appearance switch.
- Full CI (source contract, native/web/backend TypeScript, backend test/build, One Product Parity, Mobile Listing CI) must succeed at the final PR SHA. A passing test suite **does not** constitute visual screenshot or physical-device proof.
- Remaining Blocks 7–9: dealer workspaces, messaging/MaziuM, profile/settings, verification and remaining modal interiors, with eventual controlled visible Appearance picker. Final Block 10: real Samsung + iPhone light/dark/system tests, screenshots, accessibility, back/menu navigation, and verified release candidate requirements.
- No new release-signed APK, customer download activation, iOS distribution, DB/roles/auctions/fees/transactions change, or production release. Public website APK remains explicitly disabled.

**Stop at 60% and request explicit owner `proceed` before Block 7.**
