# Valuation Block 3 — licensed market-data reference (disabled by default)

## What this release adds

The backend has a fixed-host CAP HPI **VRMValuation** adapter for UK cars. It requests one licensed provider benchmark when all gates below pass. The response returns separate `Retail`, `Clean`, `Average` and `Below` amounts. These are **provider valuation bands, not individual live adverts, completed sales or CarMazium transaction prices**.

This block is a *shadow comparison*. It does **not** alter live-first market search, the five-live/five-blended fallback policy, customer-visible low/mid/high values, retail suggested pricing, auction starting bids or reserves. Provider amounts are ephemeral and are not included in valuation snapshots, browser/native responses, or analytic events. An internal event only records whether the market mid was broadly aligned with the licensed provider's retail benchmark (`ALIGNED` versus `REVIEW_REQUIRED`) or whether the source was unavailable or the vehicle identity mismatched. Internal comparison alone is not evidence that the customer-facing value is wrong.

## Activation prerequisites

1. Obtain a direct agreement from CAP HPI covering this specific CarMazium platform use, including any storage, caching, derived analysis, audit logging and downstream/public display rights. A CAP account alone is **not** evidence those uses are permitted. Confirm this in writing.
2. Deploy provider secrets **only** as backend environment secrets. No Vercel public prefix, web/mobile env variables, repository values or client telemetry.
3. Set these backend environment variables, only after the corresponding conditions are met:

```sh
CAP_HPI_VALUATION_ENABLED=false
CAP_HPI_INTERNAL_COMPARISON_RIGHTS_CONFIRMED=false
CAP_HPI_SUBSCRIBER_ID=
CAP_HPI_PASSWORD=
```

The flags must both be the literal string `true` and both credentials must exist before an external request is made. With flags unset or false, the existing valuation system runs unchanged. **Never set rights confirmed based solely on the availability of technical credentials.**

## Data flow and boundaries

- Only a verified VRM with a verified model/year reaches the optional provider. Where a requested derivative cannot be independently confirmed, the check is skipped. A returned CAP make, model, derivative or registration year that conflicts with the request is excluded.
- One optional HTTPS POST to the pinned `https://soap.cap.co.uk/vrm/capvrm.asmx/VRMValuation` endpoint per new eligible valuation journey. No redirects; bounded request time and response size; reject DOCTYPE/ENTITY; do not log response XML, credentials, vehicle identifiers or price bands.
- External provider failure is isolated. The existing five live then five blended attempts remain in control, with the current fallback only when these paths are exhausted.
- The provider's four bands are kept distinct from live advert evidence; no CAP price is faked as a comparable, sold price or dealer auction outcome. Provider differences are a **diagnostic review signal** only until later blocks separately model auction, private-sale and retail pricing.
- Provider rights and any use of a distinct provider (including Auto Trader Connect) must be independently reviewed. Do not harvest commercial marketplaces by scraping, proxying or treating public search results as permission to cache licensed data.

## Required staging sign-off before activation or merge

- [ ] Block 1 and Block 2 staging gates pass and their PRs merge in dependency order.
- [ ] Legal/commercial team confirms permitted CAP subscription uses and signs the internal comparison switch.
- [ ] Configure staging-only CAP credentials through backend secrets; the feature remains OFF in production.
- [ ] Replay a recognised VRM, incorrect make/model/trim, absent credentials, expired subscription, timeout, HTTP 429/503 and malformed or oversized XML.
- [ ] Verify successful reference check event contains **only** non-numeric provider status and check time, and no CAP amounts or identifying vehicle data.
- [ ] Verify identical customer figures/attempt counts with the feature disabled and in shadow mode using fixed live advert fixtures.
- [ ] Measure licensing cost, response latency, request concurrency and divergence frequency; establish contract-approved TTL before considering persistent provider caching.
- [ ] Review privacy notices and the provider contract before extending this diagnostic integration into customer-facing valuation calculations.

Useful implementation reference: https://developer.cap.co.uk/webservices (VRMValuation). Auto Trader Connect data/redistribution rights differ, and require a separate written integration licence and approved use case.
