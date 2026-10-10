# Native ↔ website visual parity review — 10 October 2026

## Evidence reviewed

The user provided two recordings:
- `az_recorder_20261010_140222.mp4` — installed CarMazium native Android app, showing logged-in motor-trade dashboard, drawer, account pages, auctions, Watchlist, Pricing, and other screens.
- `az_recorder_20261010_141055.mp4` — mobile web `carmazium.com` showing the dealer portal, Stock, Customers/CRM, trade Buy & Bid, account settings, web header, More panel and business portal.

**Observed mismatch:** Native bottom navigation was `HOME / BUY CARS / AUCTIONS / SAVED / DASHBOARD` across all roles, even on a dealer account. The *website dealer portal* is `Home / Stock / Customers / Buy & Bid / More`. The native dealer entry point initially showed the public shopping home, and each native dealer page had its own title/hamburger/notification layout rather than the website's consistent top bar. The native bar was a floating pill; the website uses an edge-to-edge navy footer tab bar. Native drawer prioritised public market pages rather than dealer operations.

## Corrected in the first visual-parity integration

1. **Dealer-specific bottom navigation**: `DealerHome` → existing dealer analytics dashboard, `DealerStock` → dealer inventory, `DealerCustomers` → CRM, `DealerBuyBid` → live dealer auctions, `DealerMore` → actual drawer. Tab names/icons match website. Any role using personal buyer preview continues to get the five consumer routes.
2. Preserve existing `Home`, `Search`, `Live`, `Saved`, `Profile` routes for consumer deep links and drawer navigation. Do not rename or remove existing paths.
3. **Permissions**: Stock, Customers and Buy & Bid shortcuts are hidden until the dealer permission provider confirms `VIEW_INVENTORY`, `MANAGE_CRM`, `VIEW_TRADE` respectively. Dealer Home and More stay accessible.
4. **Drawer**: dealer workspace starts with Home/Stock/Customers/Buy & Bid, with public marketplace pages behind *Marketplace & information*. The long duplicate Stock and Customers entries are removed from Dealer Controls; existing approved secondary features remain available.
5. **Shared header**: logo, notification bell, account shortcut, hamburger in a consistent slate/navy bar across Dealer Home, Stock, Customers and Buy & Bid. The role and authentication status are always taken from the existing auth store. The header account shortcut opens the central Settings page rather than changing role without consent.
6. **Design**: flatten the native tab bar to the website's full-width `#243047` dark navy with red `#ED1C24` active icons and safe-area spacing; no floating capsule. Source theme colours already match the website's dark CSS variables, so no global recolour is necessary. The installed native APK seen in the recording may predate these source palettes.

## Verification and limits

- New `scripts/test-native-website-ui-parity.test.mjs` locks website → native dealer tab semantics and surfaces.
- Release certification retains existing business rule tests plus native/backend/web typechecks.
- Isolated read-only QA Android builds and emulator screenshot run after the PR merges to `main` (using no EAS token).
- **Visual parity is not yet certified** from source changes alone. Remaining browser-native UI comparisons include page-by-page card spacing, Stock list/grid, Customers/CRM charts, TradeXchange tabs, more-menu expansion, dealer Account Settings controls and MaziuM AI placement. Authenticated test-account screenshots and iOS device review require an approved separate synthetic backend/data setup.
- No customer production transactions, Play Store upload, iOS IPA release, live OTA publish, KYC or payment workflow changes are authorised by this PR.

## Manual acceptance sequence

On a verified owner dealer account, compare (1) website dashboard Home ↔ native Dealer Home; (2) Stock inventory with the same sample listing; (3) Customers empty/count states; (4) Buy & Bid live-auction badges and details; (5) More and Account Settings. Check widths 360dp and 390dp, light/dark backgrounds, Android back gesture, accessibility labels, tap targets, and role switching. Report any missing route or misleading status before wider deployment.
