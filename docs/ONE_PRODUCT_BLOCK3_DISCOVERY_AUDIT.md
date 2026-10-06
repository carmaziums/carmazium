# One Product Block 3 — Search, vehicle details and saved-car discovery

Date: 4 October 2026. Work tracked by #414. This draft covers the first concrete high-priority Block 3 issue: native Saved Cars' account isolation, freshness and offline behaviour. It is **not** proof that the entire search/detail journey is certified.

## Feature inventory

| Surface | Website | iOS / Android native | Evidence / current status |
| --- | --- | --- | --- |
| Search and filters | `src/app/search/page.tsx` | `src/screens/main/SearchScreen.tsx` | Source mappings present; full filter-by-filter same-inventory comparison and physical device QA pending |
| Retail vehicle details | `src/app/buy-cars/[slug]/page.tsx`, shared detail components | `src/screens/vehicle/VehicleDetailScreen.tsx` | Source mappings present, including HPI, finance, contacts; actual data-level and signed device comparison pending |
| Saved Cars (new explicit registry item `marketplace.saved_cars`) | `src/app/dashboard/buyer/watchlist/page.tsx`, `src/lib/listingApi.ts` | `src/screens/main/SavedScreen.tsx`, `src/store/watchlistStore.ts`, `src/lib/watchlistApi.ts` | Concrete gaps corrected in isolated draft PR: see below. Web/native mappings are required, not merely a footnote of search |

## Verified saved-car gaps corrected in this draft

1. **Account privacy:** The original global native Zustand saved-car store had no account owner; ordinary/forced signout did not clear the previous account's saved vehicles. App now binds the store to the authoritative authenticated backend user's ID; binding a different user or signing out immediately discards previous state and invalidates in-flight callbacks.
2. **Transient errors:** The native API used to convert **any** watchlist fetch error to `{items:[], total:0}`, indistinguishable from a truly empty account. It now surfaces the failure; the store preserves existing entries and Saved displays an accessible retry.
3. **Cross-device freshness:** Saved previously fetched only on initial component mount. It now refreshes on tab focus, enabling newly saved/removed website cars to appear without restarting the app.
4. **Race safety:** Older requests from another user, overlapping focus refreshes and late optimistic-write rollbacks must not replace newer state. Writes for the same listing are serialized to preserve a rapid save-then-remove action on the backend. A backend 'Listing not in watchlist' DELETE is treated as idempotent success.
5. **Dead control:** The Saved list displayed a clickable `Change` sort control without an onPress handler. It is removed; the current backend-sorted 'RECENTLY SAVED' label is truthful until real sorting has backend parity.

No backend endpoints or financial/trade access rules were changed. Trade auction shortlist from draft #413 has its own verified-dealer rules; this draft does not replace it.

## Automated tests and remaining release proof

`scripts/test-saved-cars-account-isolation.test.mjs` runs executable native-store regressions against transpiled TypeScript plus API mocks for switching users, pagination, duplicate items, network errors, cross-user request races, overlapping refresh, rapid save/remove serialization, failed writes and optimistic update protection. Source checks verify auth identity binding, focus refresh and UI retry. Run in Mobile Listing CI, One Product Parity and Release Certification against the **exact current PR head**.

Still **NOT TESTED**: real same-account saved-car updates from browser to signed iPhone and Android; different-user signout/login on the same signed device; guest save prompt; physical airplane/offline behaviour; 100+ item pagination and concurrent physical sessions; complete search filters, result count, same listing details, contact visibility and web-to-app Universal Links. All remain unchecked in master #414 until signed test evidence exists.

## Merge/rollback

This PR is based directly on main and independently reversible from the unmerged Block 1 shortlist PR #413 and the separate Block 2 PRs #419 and #422. **Concurrent manifest edits:** #413 adds `dealer.auction_shortlist` and this PR adds `marketplace.saved_cars`; both entries must be preserved if merged together. Neither branch may be overwritten or force-rebased over the other without reconciling `product-parity.json` and re-running exact-head CI. No paid infrastructure, database migrations, production credentials, store publication or unrelated integration changes.
