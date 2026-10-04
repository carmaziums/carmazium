# Block 3 — Complete-inventory radius search correction

4 October 2026. Master issue #414, technical issue #425. **Draft, no production migration, no deployment.**

## Original verified defect

Website and mobile fetched an arbitrary page of vehicles from `GET /listings` **before** using client-side haversine distance. Genuine nearby cars on later pages disappeared, backend counts remained unfiltered and the same radius gave inconsistent results between web and mobile.

## Reversible correction (existing infrastructure)

- `ListingFilterDto` accepts optional decimal latitude/longitude and maxDistanceMi (strictly positive, max 200), all required as one group if any is specified; the service checks bounds and rejects invalid input with HTTP 400. Ordinary no-radius requests retain their original query path.
- The backend combines **existing** visibility, text, vehicle, sale status, retail classification and other user filters with a conservative latitude/longitude bounding rectangle. It scans **id and coordinates only**, in batches of 400 using a cursor. Every candidate is then checked with accurate spherical distance; false positives at bounding-box corners are excluded. Searches crossing longitude 180° and searches near poles are supported.
- A 20,000-candidate protection limit returns an explicit HTTP 503, not a false partial count, if the existing database cannot safely handle a very broad search. This limit should be load-tested before any deployment.
- Matching IDs constrain the final **existing** Prisma listing query and count before pagination. Non-geographic ordering continues to respect current business ordering. Optional `sortBy=distance_asc` sorts the complete matching set globally and then fetches the selected page. No trade-auction access is added.
- Both clients send the exact same search centre/radius to the backend, use its prefiltered pages and authoritative counts and offer closest-first search. The website automatically refetches if a postcode resolves after the filters were selected; native uses the already-available voluntary postcode lookup and exposes a retry if coordinates are missing.
- No PostGIS, third-party paid location provider, paid Supabase branch, destructive migration, additional production permissions or production credential changes.

## Automated acceptance

`backend/src/listings/listing-radius-search.spec.ts` checks complete/malformed coordinate grouping, radius safety, spherical circle vs rectangle, UK prime meridian, longitude/dateline boundary and poles.

Additional tests in `backend/src/listings/listings.service.spec.ts` verify the full eligible-inventory scan across more than 400 records, exact circle exclusion, existing public-only filters, complete pagination, global nearest-first ordering, invalid-input rejection, and the unchanged no-radius query.

`scripts/test-radius-search-parity.test.mjs` enforces web/native query serialization and server-side filtering/count contracts. These checks are wired into Mobile Listing CI, One Product Parity and Release Certification.

## Remaining proof before approval

The draft is **code-only** until exact-head CI and real production-equivalent DB load tests pass. Required non-production acceptance: UK test coordinates/postcodes in both clients, 10/25/50/100/200-mile choices; verify matching IDs, result counts and page 2+ against the same backend seed; combined model/price/condition/seller filters; default and closest-first ordering; absent listing coordinates; signed Android/iPhone; GPS/postcode consent and failed geocoding; multi-thousand inventory performance and concurrent writes.

Potential concern: broad-radius scanning and large `id IN (...)` lists may not scale indefinitely. If the 20k safety threshold is approached, optimize on existing PostgreSQL using a reviewable, parameterized database query rather than silently truncating results. The result's physical distance is derived from listing-level general coordinates; never reveal private seller address/contact through this endpoint.

## Independent rollback

Based directly on main, independent of draft #413, #419, #422, #423 and #424. In eventual combined merges preserve those PRs' manifest entries and one-product parity tests and repeat all workflows. No release or live data operation requested.
