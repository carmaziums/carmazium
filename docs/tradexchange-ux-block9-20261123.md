# TradeXchange UX — Block 9: web/native parity

Date: 23 November 2026. Continuation of draft PR #987 from a7a437b1. 90% source implementation checkpoint; production release remains separate.

- Replaced the old four-card native Services screen in place with the six-area website directory: auctions, transport, inspections, finance, warranty and business partnerships. Matching public copy, steps, partnership guidance, and identical bundled hero asset. Responsive one/two/three-column layout and one column at large font scales. Existing native routes and forms are reused.
- Direct Provider Dashboard shortcut in the authenticated directory on both clients for business owners; staff go to their existing dealership dashboard, guests and specialists can read the partner guide. Private actions stay hidden from guests. No provider job feed in the public directory.
- Signed-in native service availability is checked on focus against existing authenticated settings; unavailable services and failed checks disable new service entry from the directory, while historical requests and warranties remain accessible. Guests can explore public pages and the existing guest gate protects paid-job forms. Backend enforcement unchanged.
- Native content links retain validated transport/inspection kind, warranty listing and specialist partnership topic. An explicit request kind selects the correct option when restoring the existing account-scoped draft. No duplicate forms or new pages; the old public service hub and chooser resolve to the canonical directory.
- Auction wording explicitly restricts auction buying to verified motor traders. Canonical URL, metadata, sitemap, 308 legacy redirects and private noindex rules are preserved; source checks passed. No claims about ranking improvements or live indexing.

Verification: 204 targeted source regressions, 28 native renderer tests, web/native TypeScript checks, product parity and synchronized dashboard catalogue checks passed. All 90 MaziuM source fingerprints verified; existing hero asset hashes identical. Native renderer checks use mock navigation/settings, not actual devices. No customer transactions or deployment. CI includes new native behaviour regression tests.

Remaining release gate: end-to-end authenticated and visual verification in deployed website, original signed Android and iOS app, real navigation/deep-link behaviour, production SEO/redirect verification, device acceptance and controlled production release. Do not claim physical-device or pixel-perfect parity solely from source and renderer tests.
