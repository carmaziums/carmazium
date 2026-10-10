# Mazium website/native consent and Search parity — Block 9/10

Date: 2026-10-10. Shared Android/iOS Expo source and actual website were inspected. **Code-only, unmerged draft; not customer-release certification.**

## Findings / fixes

1. Native `GlobalAIChatBot.tsx` now increments a per-component consent epoch on account change and explicit consent withdrawal. Pending AI responses and consent reads are committed only if their initiating epoch and signed-in identity still match. Native withdrawal changes UI consent state and blocks new prompts **before** the asynchronous preference deletion. It resets the pending indicator. If device storage fails, the user is warned that consent revocation may not persist across app restarts. Existing OpenAI/backend requests **already sent cannot be recalled**, so this is not a claim of network cancellation.
2. Website `MaziumWidget.tsx` likewise checks a consent epoch and persisted acceptance before showing a late AI response. Withdrawing consent stops new requests and hides stale results. Actual AI endpoints remain unchanged.
3. Native AI filter-card taps previously dispatched an unhandled top-level `Search` navigation even though the actual Search tab is under `Main > Tabs > Search`. This now uses the existing shared navigation helper to open the real nested tab, forwarding non-empty AI filter fields under `aiFilters` in the same shape the Search screen expects.
4. Native `SearchScreen.tsx` previously applied incoming `aiFilters` and then immediately cleared several values (make, minPrice, maxPrice, minYear, transmission) in the same route effect. It now resets only dimensions not supplied by the AI card. This preserves the website-equivalent intent of AI-suggested search filters.
5. Native assistant header is marked as a screen-reader heading; its chat scroll works with taps while the keyboard is visible; disabled text input has an explicit accessibility state; AI privacy and stop-sharing footer buttons have minimum 44px tap targets.

## Verification

- `scripts/test-mazium-consent-filter-parity-block9.test.mjs` contains fail-closed source regressions for epoch invalidation, consent reads/writes, late responses, nested Search, all 12 AI fields, previously reset filters and native accessibility.
- Updated the earlier shared web/native conversation test for the stricter consent-session guard.
- GitHub Release Certification and One Product Parity must pass on this draft before accepting the source changes.
- **Real Android and iPhone tests remain mandatory**: accept consent, start a long AI request, withdraw consent during the request, switch accounts, reopen the app and test every returned filter card on the Search screen. Verify sign-in and reporting. Don't use live customer accounts or production payments to generate QA traffic.

## Remaining cross-platform gaps

- Native UI still uses the app-wide canonical navy/dark design, while the website supports a separate light/dark theme system. An assistant-only OS theme override risks clashing with the rest of the native app and cannot guarantee it follows the website's independent theme preference. Full native theme parity is **not certified**.
- Guest AI: website widget renders for guests, but native AI API client deliberately requires authenticated sessions. This is a real feature gap, not permission to bypass API authentication; a new public guest AI endpoint would require separate rate-limiting and abuse controls.
- Functional and screenshot parity on real Android and iOS devices is unverified.
- Release signing certificate, real release-signed APK, independent install/security QA and first-party hosted APK hash verification remain unverified. Never enable the public website download button until those gates pass.
