# CarMazium native UI — Block 10/10 device QA and release handoff

Date: 11 October 2026. Tracking: GitHub Issue #502. Source baseline: draft PR #511, including Blocks 1–9.
Release decision: **NO-GO pending actual Android, iPhone and theme-switching evidence.**

This is a source-review document and test plan. Ten source blocks do not mean ten fully verified phone releases. Screenshots, signed binaries, usable Theme switching and owner approval have not been independently supplied by GitHub source CI.

## Block 10 required gates

1. Full Release Certification, One Product Parity, Mobile Listing CI and Mobile Chat CI on the exact final Block 10 source SHA.
2. Native screen coverage audit: `node --test scripts/test-native-theme-qa-block10.test.mjs` for safety invariants; `node scripts/audit-native-theme-qa-block10.mjs <exact-source-sha>` for an inventory and conservative NO-GO report. The inventory intentionally exits code 2 and must never be treated as a failed code migration, an approved install or a release pass.
3. Independently verify actual screenshot PNG bytes through the existing private offline checker, not declarations in an evidence file. It requires 16 buyer/trader/seller/provider scenarios, two mobile viewports, and corresponding web/Android/iPhone captures with a separate reviewer:
   `node scripts/verify-native-visual-acceptance.mjs --manifest /private/qa/issue477.json --sha <exact-reviewed-sha>`
4. For a public release separately use the existing customer acceptance auditor, and independently verify a production-signed Android binary and direct first-party download bytes. No source PR, PNG manifest or QA screenshot can activate the download flag by itself.
5. Actual owner release approval must identify the precise verified Android SHA-256 and merged source SHA. iPhone TestFlight/public invite has a separate approval.

## Private Samsung QA build procedure — manual action

The existing standalone debug-signed Android QA workflow is https://github.com/carmaziums/carmazium/actions/workflows/carmazium-android-offline-qa-apk.yml

- Open Actions > CarMazium Android standalone QA APK > Run workflow. Choose the final Block 10 branch explicitly, not the stale main branch. The workflow selector must display that branch. If GitHub refuses branch selection, stop rather than building an older APK.
- Verify the run's actual source SHA matches the latest reviewed PR. Both build-qa and emulator-smoke must pass before calling the artifact installable.
- Download the private CarMazium-Android-QA artifact ZIP from the successful run, extract CarMazium-QA-Android.apk and SHA256SUMS.txt, and independently compare the APK hash to the manifest.
- The package is uk.carmazium.qa and therefore separate from the installed production CarMazium app. Its Expo update channel is disabled. Its signing key is an ephemeral debug signer. The artifact expires after seven days. This is NOT a customer-signed APK.
- Install privately on the owner Samsung for logged-out navigation and screen review. For auth, data mutation or payment flow tests, first establish an isolated synthetic staging backend. The existing QA workflow includes a read-only UI guard but its public preview API configuration may still connect to live services. A client-side flag is **not a security sandbox**. Do not use real customer records, money, bids, chat, KYC or uploads.
- A differently signed previous QA installation might not update in place. Only after preserving private evidence should a tester uninstall the separate QA package for clean-install testing; never uninstall the user's real CarMazium app.

## Required real-device website parity matrix

All cells remain **PENDING**, not passed.

| Journey/state | Website | Samsung Android QA | Physical iPhone | Theme coverage |
|---|---|---|---|---|
| Guest home and Login/Signup | Reference needed | Pending | Pending | Dark / Light / System |
| Buyer Search, Saved Cars and retail vehicle details including transmission | Reference needed | Pending | Pending | Dark / Light / System |
| Dealer dashboard, Stock, Customers/CRM, Buy and Bid and restricted staff | Reference needed | Pending | Pending | Dark / Light / System |
| Sell valuation, DVLA, photos, declarations and handover information | Reference needed | Pending | Pending | Dark / Light / System |
| Auction details and £125 buyer fee disclosure | Reference needed | Pending | Pending | Dark / Light / System |
| Chat, notifications, MaziuM consent/privacy/reporting | Reference needed | Pending | Pending | Dark / Light / System |
| Account/settings, appearance, role switching and restart | Reference needed | Pending | Pending | Dark / Light / System |
| Provider verification, quotes and jobs | Reference needed | Pending | Pending | Dark / Light / System |

Use at least 360×800 and 390×844 representative mobile viewports, matching the same synthetic vehicle/role/visible state across platforms. Keep private screenshots and video outside Git, redact sensitive records, note reviewer/tester identities and exact binary hashes. Cover 200% system text, keyboard avoidance, safe areas, TalkBack, VoiceOver, tap targets and back gestures.

### Must retest the previously reported defects

- Top-right question-mark icon must be an identifiable menu, not a mystery control.
- Bottom-right close must work; no duplicated menu/close actions, clipped menu or inert lower drag handle.
- Account avatar opens consolidated account/settings rather than disconnected options.
- Transmission visible on vehicle cards and details.
- MaziuM website and native feature entry, privacy/consent and filter routes match.
- Appearance must really switch Light/Dark/System on all relevant screens, with contrast preserved through restart/account transition and OS colour changes. **The selector is still disabled in Settings, so this gate is currently blocked.**

## Independent acceptance status

| Evidence | Current status |
|---|---|
| Automated source tests | Requires final exact PR CI |
| Standalone Android QA APK for final source | Not yet independently verified |
| Isolated synthetic backend | Not confirmed |
| Android real-device installation, screenshots and taps | Pending |
| Light/Dark/System picker and persistence test | Blocked: customer picker disabled |
| Apple-signed TestFlight beta and iPhone QA | Pending |
| Original release signing provenance and APK source hash | Not verified |
| Public APK hosting and website download feature flag | Disabled |
| Explicit owner per-binary public-release signoff | Not provided |

**The next action after source CI is owner-run private QA artifact generation, then screenshots/videos for Samsung and a real iPhone. Never infer a public release from green GitHub checks.**

Do not merge older overlapping draft PRs separately. No production roles, bidding, fee, database, authentication, signing keys, hosting, TestFlight or public downloader changes are authorised by this checkpoint.
