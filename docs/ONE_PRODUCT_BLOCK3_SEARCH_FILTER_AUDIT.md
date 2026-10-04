# Block 3 — Native Search results correctness and website feature parity

Date: 4 October 2026. Master programme #414. **Code fix scope only**; actual signed Android/iPhone and production browser search have not been exercised.

## Confirmed source-level differences

- Website advanced search and native search expose all seven sort orders, Cat S/N/C/D and supported backend filter fields. But the native **Manual** quick chip changed the selected UI chip without sending the backend's `transmissions=MANUAL` filter: its `buildParams` omitted `qf.params.transmission`. Corrected: quick chip now populates the real multi-transmission backend field unless an explicit advanced transmission selection takes precedence. Switching quick chips clears the prior explicit transmissions.
- Website `getListings` throws a failed fetch into its own error UI. Native shared `searchListings` swallowed all fetch failures as `{listings:[], total:0}`, and SearchScreen also discarded thrown errors. It therefore misreported connection failures as genuine zero cars. Corrected: public Search calls the native listing API's opt-in strict mode so error conditions are visible and retryable without changing best-effort behaviour in other existing callers.
- Concurrent native text, sort, filter and pagination requests could finish out of order, overwriting newer results with older inventory and duplicate pagination. Corrected using a request epoch and in-flight-page guard; the latest reset invalidates older page requests; a query change invalidates old text requests immediately during the debounce window. Backend `pagination.total`, rather than a fixed full-page heuristic, determines whether another page exists.

## Regression and release evidence

The real `src/screens/main/SearchScreen.tsx` nested `buildParams` function is executed under deterministic state in `scripts/test-search-results-parity.test.mjs`, testing Manual and advanced transmissions, alongside executable native API strict/best-effort/error behaviours. Source contracts check backend-param serialization, stale-response gates, all seven sort values, write-off filter choices and retry UI. All nine tests run in Mobile Listing CI, One Product Parity and Release Certification. Exact-head CI results must be appended to PR review before claiming code verification.

**Known remaining Block 3 issues, not fixed by this patch:** Website and native 'Near Me' distance filtering currently operate only on a fetched page, not over the full available inventory, and the displayed backend count is not an accurate count of nearby results. A shared backend-geospatial search contract, accurate radius counts and real coordinates require separate audited work. Result cards, seller contact visibility, exact listing data, saved-car web-to-app cross-device synchronization, guest flows and installed universal/app links still require signed iPhone/Android and website end-to-end acceptance.

## Rollback

Independent draft from main; do not merge/publish with earlier Block 1 #413, Block 2 #419/#422 or Block 3 Saved Cars #423 until each is reconciled and approved. No server migration, fees/business-rule changes, new infrastructure or production data writes.
