# Valuation Block 4 — search resilience and request reuse

This block is stacked on valuation Blocks 1–3. It does not modify customer pricing formulas, source priority, identity safeguards, the licensed CAP HPI shadow integration or the 24-hour frozen-vehicle base.

## Execution policy

1. Run the first distinct LIVE web-search plan. When it already returns at least three usable distinct comparables, stop without spending on additional searches.
2. If fewer than three are available, execute the remaining four independent LIVE plans concurrently. One or two usable live comparables still take priority over blended/internal evidence after these five passes.
3. Only if all five LIVE plans found **zero usable live comparables**, start BLENDED. Try its first plan and, if still empty, its remaining four independent plans.
4. Use existing first-party comparables/model fallback only after all five LIVE and five BLENDED plans fail to produce usable live results.

Each plan is at most one external SDK call with SDK retries disabled; it has a configured per-attempt timeout plus an independent AbortController deadline. The timeout setting `OPENAI_WEB_VALUATION_TIMEOUT_MS` defaults to 18000 ms and is clamped to 10000–22000 ms. Attempts 2–5 are concurrent by design, so worst-case raw external-search time can be roughly four timeout windows plus the first-party and registration-service time. This is a limit, **not** a guarantee for whole-endpoint latency.

## Cache boundaries

- The existing 24-hour database snapshot remains authoritative for a verified VRM, unchanged make/model/year/mileage and an immutable journey ID. That is the main reuse path.
- Identical, overlapping external search plans also share an in-flight call on the **same backend instance**. Separate LIVE/BLENDED plans never share each other's results, and different model families, generations, variants, gearboxes, fuel types, write-off filters, mileage, model configuration or year never share requests.
- Search results are discarded immediately when an in-flight call completes by default. Failed/empty searches are never retained.
- A separate, **disabled-by-default** option retains only positive, already-sanitized public-advert comparable results for 60 seconds, per process, with a 256-entry memory bound. Turn it on only when marketplace/provider use agreements permit such temporary metadata retention. Both `LIVE_MARKET_SHORT_CACHE_ENABLED=true` and `LIVE_MARKET_RESPONSE_CACHE_RIGHTS_CONFIRMED=true` are required.
- No CAP HPI provider valuation or subscriber data uses this broker. Backend credentials, registration and owner details are not included in cache keys, browser responses or broker metrics. The number of network starts, coalesced calls and short-cache hits can be read in per-instance broker diagnostic counters; they are not a global distributed metric.

## Operational checks before merging

- [ ] Finish Blocks 1–3 staging gates and merge in dependency order.
- [ ] In staging, verify a first LIVE pass with ≥3 comparables exits after one request; sparse passes execute five distinct LIVE plans before proceeding; five empty LIVE and five empty BLENDED plans reach the fallback.
- [ ] Simulate a web-search hang and confirm the abort watchdog bounds each attempt; provider rejection must not suppress later plans.
- [ ] Fire simultaneous **identical** vehicle requests against a single backend process and confirm fewer external calls, equal quotes and correct immutable snapshots. Then test different instances: the in-flight broker is *per process*, while the Block 2 PostgreSQL frozen-base lock works *across instances*.
- [ ] Check external API cost, p50/p95/p99 end-to-end latency, and `marketEvidence.searchDurationMs` in saved snapshots using synthetic/staging vehicles. Do not print VRMs or subscriber details in runtime logs.
- [ ] Leave short caching OFF until retention rights are expressly confirmed in writing. If enabled under an approved agreement, test 60-second expiry, cache isolation, stale-data display and memory eviction.
- [ ] Verify no new price discrepancies between the same vehicle's repeated journeys; investigate any change independently from this block.

**Release policy:** PR remains draft. CI success validates code and regression tests but does not constitute staging provider or production sign-off. No Fly.io deployment or app-store rollout is authorised by this block.
