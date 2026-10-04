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

## Real isolated PostgreSQL acceptance (4 October 2026)

[GitHub Actions PostgreSQL acceptance run](https://github.com/carmaziums/carmazium/actions/runs/37230421663) **PASSED** using `.github/workflows/radius-postgres-ci.yml`. This pull-request workflow provisions a disposable PostgreSQL 16 service on the GitHub runner, `prisma db push` from **the current branch schema into that disposable DB only**, and seeds **8,400 fictional/geocoded listings** using `backend/scripts/radius-postgres-load.ts`. The script refuses any non-loopback host, non-test database name, nonempty starting table, or absent explicit `RADIUS_LOAD_TEST=ephemeral-postgres-only` guard. It reads no Supabase secret, existing customer data or live database.

The exact production `ListingsService.findAll` and Prisma client were exercised against that real PostgreSQL schema; an **independent spherical law-of-cosines oracle**, not the backend's Haversine code, checked full-inventory counts and global closest-first vehicle IDs. **All 16 scenarios passed**: London, Birmingham and Manchester across 10, 25, 50, 100 and 200 miles, plus a combined Honda / £10,000 filter; page 2+ contained eligible, nonduplicated results. Missing coordinates, sold/draft/auction/deleted listings and featured records are present in the synthetic dataset. Previously added isolated Jest tests separately cover >20,000 candidate safety failure.

GitHub runner measurements, **not production latency guarantees**:
- 8,400 synthetic rows; busiest measured case: Manchester at 200 miles, **7,089 matching vehicles**; first page **228 ms** and closest-first page **218 ms**.
- Additional broad-radius cases: London 200 miles, 5,906 matches and 187 ms first page; Birmingham 100 miles, 5,142 matches and 181 ms first page.
- Sampled PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` candidate query: **3.625 ms execution**, 0.089 ms planning, 323 shared cache hits, 0 shared reads on the small ephemeral test.

**Remaining real release acceptance:** test the exact *combined* PR code on an installed signed Android build and signed iOS build against the same known nonprivate dataset as a staging/browser session; verify postcode/GPS privacy, denied/invalid location recovery, backend 503 retry UI, correct page 2 counts and contact privacy. Confirm likely production-sized volume, concurrent writers and real query-plan/index behaviour in a schema-compatible non-production environment. The currently connected CarMazium Development Supabase database has only one row in `public.listings` and no latitude/longitude columns, so it is not suitable for this test without prohibited schema changes. Do not infer production SLOs or sign off a store release from ephemeral CI results.

## Remaining proof before approval

**Code and disposable database acceptance are complete.** Physical-device and production-equivalent operational acceptance above remains outstanding.

Potential concern: broad-radius scanning and large `id IN (...)` lists may not scale indefinitely. If the 20k safety threshold is approached, optimize on existing PostgreSQL using a reviewable, parameterized database query rather than silently truncating results. The result's physical distance is derived from listing-level general coordinates; never reveal private seller address/contact through this endpoint.

## Independent rollback

Based directly on main, independent of draft #413, #419, #422, #423 and #424. In eventual combined merges preserve those PRs' manifest entries and one-product parity tests and repeat all workflows. No release or live data operation requested.
