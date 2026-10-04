# Block 3 combined non-production integration — PRs #423, #424 and #426

4 October 2026. One Product programme #414. **This is a TEST/INTEGRATION draft**, not a substitute for any individually reversible feature PR and not a production release.

## Explicit branch composition

- Base branch: exact, previously seven-workflow-pass head of full-inventory radius-search [draft #426](https://github.com/carmaziums/carmazium/pull/426), including 8,400-row disposable PostgreSQL and genuine NestJS HTTP/privacy checks.
- Saved Cars [draft #423](https://github.com/carmaziums/carmazium/pull/423) copied unchanged at its last independently verified head: native account-bound Zustand saved-car store and App auth binding; API fetch failure propagation; refetch-on-tab-focus/retry UX; account/optimistic concurrency regressions; its `marketplace.saved_cars` registry entry.
- Search and Manual chip [draft #424](https://github.com/carmaziums/carmazium/pull/424): copied Manual-filter tests and discovery audit. **Overlapping native SearchScreen manually reconciled**: effective backend Manual transmission fallback; reset all quick/keyword/advanced transmission filters; strict errors for *all* public searches, not just radius; reuse #426's more complete request-epoch, global-radius/pagination, back-end-count and latest-postcode guards; single accessible retry/error state. The #426 native listings API already supported optional strict HTTP error propagation and retained original non-radius best-effort contract for other callers.
- All three pre-existing executable regression suites run on this **single** branch, plus `scripts/test-block3-integrated-journey.test.mjs` (actual transpiled nested SearchScreen query builder, actual native HTTP adapter and real native saved-car store under mock transport) demonstrating Manual + 25-mile filtering, save, tab refresh, logout/account switch and All-chip inventory recovery.

## CI and mergerules

Mobile Listing CI, One Product Parity and Release Certification execute all relevant native test suites and the integrated journey on the same combined revision; radius PostgreSQL acceptance remains attached to backend code. The integration branch is intended to catch semantic conflicts *before* any individual feature PR merge. An independent draft PR will be opened against main; **do not merge it**. For eventual release preserve three separate original PRs or explicitly plan granular reversions; do not directly copy an unverified combined head into live main.

## Still unverified

Installed/signed iPhone and Android native app flows, same-account real backend cross-device watchlist updates, actual live location permission handling, registered universal/app links, externally hosted staged API/session auth and full combined-head release certification remain open until genuine evidence exists. The native integrated source test uses fake transport and cannot establish physical-device correctness. The original radius PR's disposable 8,400-row PostgreSQL test validates backend behavior but is independent from installed-app QA.
