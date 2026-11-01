# CarMazium Market Intelligence API — v1 design and acceptance contract

**Status:** Proposed / owner-approved for staged development on 1 November 2026. This document is **not** a live API, a promise of coverage, or permission to release data. Engineering and legal/security review are mandatory before publication.

**Owner decisions preserved:** £1 retail listing per vehicle until sold for **dealers and private sellers**. Auctions free for sellers, winning verified dealer fee £125 unless a valid grant, £100 seller reward only on a qualifying completed approved handover, retail buyer fee £0; sale proceeds never pass through CarMazium.

## Purpose and factual claims

Create a free, citable CarMazium-owned UK vehicle market-statistics API, followed by an access-controlled valuation API **only after independent accuracy validation**.

- **Retail asking price** = price currently advertised by a seller. It is not proof of what a buyer paid, even if a listing later disappears.
- **Winning bid** = highest accepted/winning auction offer according to auction state; it is not automatically a completed trade transaction.
- **Verified completed trade sale** = final amount and handover, payment confirmation and subsequent cancellation/refund status validated by the appropriate workflow; never infer solely from `ENDED`, `winningBidAmount` or a `soldPrice` field.
- **Modelled estimate** = algorithmic price estimate with documented source, range, freshness, sample size and accuracy methodology, not an objective or guaranteed “actual market value”.
- Do not market CarMazium as the UK's first/only valuation API or a source for *all UK sales* without independent proof.

## Confirmed source inventory (read-only audit on 1 November 2026)

Production `public.listings`: 193 ACTIVE CLASSIFIED listing rows, 192 distinct normalised VRMs, plus 15 ACTIVE AUCTION listing rows. These are **database record counts**, not confirmed available cars, and should be remeasured before release. Production `public.auctions` has 493 ENDED rows but only two rows with `sellerFundsConfirmedAt` at the snapshot. `sales` has 56 AWAITING_CONFIRMATION and 2 CHECKS_COMPLETE; these statuses do not independently certify final payment. RLS was enabled on inspected tables.

Production `public.market_price_data` holds records tagged AUTOTRADER, MOTORS, CARGURUS, GUMTREE, CARWOW and PULSECARS, but the audit did **not** establish rights to redistribute or publish their derived data. **Block all data from this table in v1 until separately cleared by evidence and legal review**. The development project had only one listing in the schema summary and must use synthetic test fixtures.

## Proposed public endpoint

`GET /api/v1/market/stats` (HTTP GET, HTTPS, public, JSON, no mutations).

Approved query dimensions **at MVP**: `make` (canonical whitelist) and `fuel` (stable enum). A region, year range or model filter is deferred until enough distinct, verified, actively published stock is available. No arbitrary SQL/query expressions, record identifiers, VRM or VIN inputs.

**Eligibility (before every aggregate):**
1. `listings.type = CLASSIFIED`, `status = ACTIVE`, `deletedAt IS NULL`, positive retail `price`, approved public publication status (confirm source-of-truth moderation state).
2. Respect visibility, removed/hidden/embargoed listings and listing ownership permissions. Do not trust status alone before confirming moderator/public visibility checks.
3. Deduplicate latest valid listing per normalised VRM **inside the private aggregation**, or use a privacy-safe listing identity when registration is absent. Never expose VRMs, VINs, titles, exact location, URLs, seller IDs, photos, raw bids, private transaction values or individual vehicle rows.
4. Exclude clear bad-data prices and non-sale/test/spare listings according to a documented, tested rule, without arbitrary changes to public customer prices.
5. Minimum **20 distinct eligible vehicles** for *each public cohort* (initial security proposal, reviewer may require a higher limit); suppress sparse cells and potentially identifying intersections. Suppress or coarsen outputs if differencing across queries/time windows could reveal individual asking prices.
6. Prices rounded to nearest £100, counts aggregated; no precise low-sample minimum/maximum. Median and quartiles only when supported by a statistically adequate cohort; public all-UK aggregates must still state that this is *only CarMazium listings*.
7. Return freshness and generation times in UTC, clear missing/insufficient-data results, cap request parameters, bounded response, public cache with safe max age, API monitoring and abuse controls.

### Example shape — illustrative only, not observed figures

```json
{
  "version": "1.0",
  "market": "GB",
  "basis": "CARMAZIUM_ACTIVE_RETAIL_ASKING_PRICES",
  "source": "CarMazium publicly advertised retail listings",
  "scope": "Platform inventory, not all UK used-car transactions",
  "generated_at": "2026-11-01T00:00:00Z",
  "sample": { "distinct_vehicles": 100, "minimum_required": 20 },
  "currency": "GBP",
  "statistics": {
    "median_asking_price": 10000,
    "mean_asking_price": 10400,
    "p25_asking_price": 7900,
    "p75_asking_price": 12500
  },
  "methodology_url": "https://www.carmazium.com/market-data"
}
```

**The values above are fake fixtures for contract design only. Do not publish them or insert into production as real market statistics.**

For insufficient evidence, respond clearly (e.g. HTTP 200 with `status="INSUFFICIENT_DATA"` and omitted price metrics), not `0` or a fabricated average. Provide an explicit `NO_DATA` state for empty cohorts and `SOURCE_UNAVAILABLE` for a failed database fetch; do not convert a source error into fake zero supply. Restrict CORS and rate limits at the gateway, use no `service_role` secret in browsers and avoid leaking backend errors.

## Public methodology and developer docs

- `/market-data` is crawlable and explains provenance, asking-price limits, sample counts, active-listing filters, duplicate handling, outlier policy, UTC freshness, confidence and attribution.
- `/developers` contains stable endpoint syntax, examples, status codes, licensing, versioning and contact information.
- Schema.org and metadata reflect a dataset / API guide without fabricated ratings or claims.
- No external Autoza data is required; avoid licensing the competitor's API.
- Publish an open-use licence **only after** confirming CarMazium has the necessary distribution/derivative rights for each included datum. Document rate-limit and attribution rules accurately.

## Phase 2 — transaction evidence (NOT in MVP)

Maintain separate series for verified trade auctions and retail sales. Settlement signals require both parties or other independently reliable evidence; flag negotiation after winning bid, cancellation/refund/dispute state, seller reward eligibility, free purchase grants and known delays. Never publish individual bid histories, winner details, money movements or uncensored records. Apply much higher cohort thresholds and security review to aggregated hammer/final prices.

## Phase 3 — controlled valuation endpoint (NOT in MVP)

`POST /api/v1/valuations` for authenticated, rate-limited integration partners. Return `trade_value_range`, `retail_asking_range`, `private_sale_range` only where data support each type, with `as_of`, confidence, cohorts, observed vs modelled basis and caveats. Observe user privacy rights and source-licensing terms. **Do not launch until** exact derivative/age/mileage/condition inputs are validated, staleness/caching is corrected, and hold-out error metrics for completed sales are documented. Account for existing quote persistence and valuation work (#629, #757).

## Implementation and release checklist

- [ ] Claude: audit backend API location, public listing filters, RLS, settlement status semantics, third-party data rights, external valuation data origin; report evidence in #763.
- [ ] ChatGPT: design read-only aggregation with synthetic test fixtures and response/schema contract, public docs and SEO, then review with Claude.
- [ ] Reconcile active listing counts against actual public website, sitemap, GSC and moderators; never assume DB rows = indexed/listed stock.
- [ ] Test 0/1/19/20/21 eligible vehicles, duplicate VRM, pending/draft/sold/rejected/unlisted vehicles, deleted stock, sparse make and fuel combinations, outliers, source outage, cached/stale response, private-field leak, enum abuse, pagination/query abuse, rate limits.
- [ ] Independent security and data licence sign-off, CI, preview and rollout plan; owner-visible demo.
- [ ] No production SQL writes, schema migrations, API keys issued, real money operations, merges or deployments from this document.
- [ ] After approved release, monitor uptime, sampling bias, external API consumption, referrals, indexation and contribution to dealers/auctions/retail sales.

Coordination: #763, #764, #568, #716. Existing structured-data work #688 is already merged; only patch proven regressions.
