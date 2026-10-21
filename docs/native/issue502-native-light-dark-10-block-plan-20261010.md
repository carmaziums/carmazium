# Native visual fixes and full Light/Dark/System mode — 10-block programme
2026-10-10 · Issue #502 and screenshot-led menu repair PR #501

This programme is distinct from the previous ten-block PR #500 release-safeguard programme. **A green source build is not screenshot parity or customer release approval.** Android QA APK and iPhone TestFlight remain PRIVATE until separate real-device/signing authorisation.

## Scope and checkpoints

| Block | Reviewable outcome | Independent acceptance |
|---|---|---|
| **1/10 — menu diagnosis + canonical theme tokens** | Inherit CI-green #501 fixed menu glyph/unclipped drawer; immutable native website-token palettes and tests | GitHub PR CI, exact token comparison, accessibility contrast; no pretend theme switch |
| **2/10 — persistent preference and OS System support** | ThemeProvider, safe startup hydration and persisted Light/Dark/System choice | Test restart/account transition and OS scheme notifications, race/failure handling |
| **3/10 — app container and navigation** | React Navigation, StatusBar, safe-area background, header, tab and dealer modal respond to active mode | No invisible icons in either mode; back/gesture/menu navigation preserved |
| **4/10 — shared UI components** | BottomSheet, cards, inputs, banners, buttons, error/skeleton states, icon colours and text dynamic | Shared component colour and screen-reader checks |
| **5/10 — buyer home, search, retail/auction discovery** | Hero, filters, chips, listings and Search support two themes | Website/native reference screenshots, loading and error states |
| **6/10 — selling, vehicle detail and transactions** | Selling flow, detail/spec cards, offers, saved items and disclosures theme-aware | No pricing, KYC, auction rules or payment behaviour change |
| **7/10 — dealer navigation and workspace** | Dealer Home/Stock/Customers/Buy & Bid/More and permissions visual parity | Dealer/staff role & large-text verification; no permission bypass |
| **8/10 — unified account Settings and Appearance** | Genuine accessible Light/Dark/System control, immediate change across converted screens | Persist through relaunch/logout/login, system dark/light, no stale half-theme |
| **9/10 — MaziuM, notifications and ancillary screens** | AI chat, privacy/consent, report panels, messages and remaining surfaces dynamic | Consent, account isolation, read-only QA, overlays and accessibility |
| **10/10 — QA + release-review handoff** | Android & iPhone screenshot matrix, QA APK evidence, final blockers | All CI, real-device install, screenshot parity; public website APK remains gated |

### Design and safety rules

- **Website is the colour source of truth:** default light `:root`, dark `.dark` in `src/app/globals.css`. Light Cool Sky ground is `#eef5fb`; dark navy ground `#1b2538`; primary red is `#ed1c24`.
- **Do not mutate** `Colors` or rely on static `StyleSheet.create` to recolour during runtime. The app has many static styles; migrate explicitly through context and memoised dynamic styles.
- **Do not expose an Appearance toggle early.** Until every relevant screen has been converted, enabling Light mode would show dark-only components on light surfaces and could hide text/controls. This first block defines the contract, not the switch.
- **Preserve permissions and transactions**: no API, Supabase, KYC, bidding, fee, finance, signing, store, domain or production release changes.
- **Private QA only**: public `/download-app` disabled. Never test real bids/payments or mutate customer data through the QA build.
- **Source tests are not screenshot sign-off**. Use actual Samsung screenshots and physical iPhone for final acceptance. Track blocks separately and do not mark theme parity complete until Block 10 evidence.

## Block 1 result
- Fixed menu/question-mark fallback, removed inert drag handle and replaced clipped dealer bottom drawer with a full-window modal in stacked review PR #501.
- Added `src/theme/nativeTheme.ts`: immutable semantic website-matched light/dark palettes plus fail-closed appearance resolver (unknown = dark). App still uses the prior dark mode until navigation/screen migration is complete.
- Added `scripts/test-native-theme-website-tokens-block1.test.mjs`: checks CSS token equality, minimum text/background contrast and prevents fake mutation of legacy static colour values.
- No public download, signing or customer binary change.
