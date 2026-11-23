# TradeXchange UX — Block 10: final integration and release preparation

Date: 23 November 2026. Completes the ten source implementation checkpoints in PR #987, following `83c611fb2074b6e7016058a836991845f5e632f8` and integrating main `9b2406de69a93c3a2b8a948931ebf754961ae33b` (messaging PRs #988 and #989). This document records the implementation and QA checkpoint before rollout; signed builds, deployments and physical-device acceptance are separate evidence.

## Result

- Provider Dashboard remains a direct operational destination from the account/header menus, dealer dashboard and eligible TradeXchange account actions. The dealer shortcut remains visible when saved dashboard preferences hide the provider/setup cards. Service Setup stays separate. Original provider approvals, staff permissions, accounts and payment rules remain authoritative.
- Original native Android and iPhone source now routes cold and warm TradeXchange URLs through the existing content mapper. The retired `/services/jobs/new` URL opens the directory instead of a fictional job named `new`. Existing request kinds and bounded linked-vehicle context survive navigation into the existing forms.
- Dealer owners who also have staff memberships, and contractors with memberships, retain the appropriate Provider Dashboard shortcut. Staff-only accounts keep dealership navigation. Ownership is hydrated from the existing authenticated profile rather than inferred from a URL.
- Android intent declarations and Apple association paths cover implemented native destinations. Exact public paths exclude unsupported descendants and `/services/warranty/order`, preserving existing Stripe success/cancel browser returns. Original package and bundle identity remain `uk.carmazium.app`; no second app was introduced.
- Integrated current main's full-width/full-height messaging. Runtime QA caught and fixed a missing personal Messages render branch during conflict resolution. Full-screen mobile conversations now have an opaque body background in dark mode, so underlying navigation and the assistant do not show through.
- Corrected an unescaped apostrophe that prevented the iOS candidate workflow's generated Info.plist validation script from parsing. The validation remains intact; a regression parses every inline Node script before a signed build is requested.
- Updated obsolete auction-guide and customer-request tests to exercise the current direct journeys, FAQ behavior, filters, history and availability controls. Normalized checkout line endings in the vehicle-feature comparison fixture. New native entry and association tests run in existing CI workflows.

## Verification at the source checkpoint

| Check | Result |
| --- | --- |
| Website/release regression suite on Windows | 846 passed, zero failed/skipped |
| Four unchanged POSIX release fixture suites on Linux | 18 passed, zero failed/skipped; ten copied source files hash-matched before/after |
| Full native interaction suite | 239 passed, zero failed/skipped |
| Backend service, payment, lifecycle and notification suites | 98 passed across six suites |
| Web and native TypeScript | Passed |
| Final optimized Next.js production build | Passed, including the personal Messages and opaque mobile portal fixes |
| Product parity, shared dashboard catalogue and marketplace-guide generation | Passed |
| Reviewed MaziuM knowledge fingerprints | All 90 verified |
| Whitespace/conflict checks | Passed |

The Windows run initially exposed eight Linux-specific release-fixture failures involving SDK executable naming, POSIX permissions and symlink privileges. The four complete suites passed unchanged on Linux; no release guard was weakened. Separate obsolete test fixtures and the CRLF-sensitive catalogue test were corrected and rerun.

Browser QA used the optimized local production build and isolated synthetic accounts. All external HTTP/WebSocket traffic was mocked or blocked; no live messages, payments, refunds, jobs, reviews or customer notifications were created.

- Sixteen directory cases cover guests, customers, contractors, dealers, staff, owner-plus-staff and specialists at desktop/mobile widths, including 320 pixels. Direct provider navigation and the dealer shortcut with hidden saved cards passed. A final three-width dealer/provider smoke passed after the last build.
- Six personal/dealer/admin messaging cases passed at 1440 and 390 pixels. Desktop inboxes fill the 1440-by-770 area beneath the 80-pixel header. Mobile conversation dialogs fill 390-by-850, with opaque `rgb(27, 37, 56)` dark backgrounds and no horizontal overflow or uncaught page errors. Room links, filters and legacy redirects remain usable.
- Ten public/private SEO HTTP checks passed, including public canonical/schema and private noindex behavior. Three legacy URLs return actual permanent 308 redirects to the canonical destinations.
- Initial development-server hydration stalls disappeared in the optimized production run. An incomplete dashboard fixture was corrected; those fixture/HMR failures are not represented as production bugs.

## Native identity and rollout evidence

Read-only ADB inspection confirmed the original app installed in BlueStacks: `uk.carmazium.app`, version 1.0.1, build 126, Android 9. Its extracted 103,020,948-byte APK exactly matches the existing CI/public artifact:

- APK SHA-256: `c0ac76a6a14cba1e52558beb310dbbe515400e17eaf19a8acd0e711fc655a5a1`
- Signer SHA-256: `ea9b8d6733ee68d6e36ce092e81c0e360330a56dde9ed0b4edb2c421c8600f24`

Existing signed iOS build `b2a6e3d5-2a85-4ecd-9c9e-75c698d77693` confirms Apple Team `7TX7C837ZF` and original bundle ID. Its earlier upload is not evidence of a new 1.0.2 build or physical iPhone acceptance.

The live association endpoints initially returned 503 for missing identity configuration. Verified server-only Android signer and Apple Team ID variables have been staged on the existing `carmazium` Vercel project for its next preview/production deployment. Live HTTP and installed-device association verification must follow deployment; apex URLs currently redirect to www.

The local signing-properties backup failed private key/password verification, and no Android SDK was found. No key was replaced, no credentials were printed, and app data was not cleared. Existing protected GitHub signing workflows are the verified build route. Their branch/source/identity controls remain unchanged.

A source checkpoint and emulator inspection do not certify a new installed binary, physical Android/iPhone accessibility, TestFlight availability or public distribution. Record each subsequent build, source SHA, artifact fingerprint, deployment and actual device acceptance independently. Retain the existing exact-artifact acceptance controls; never substitute old build-126 evidence for the new candidate.
