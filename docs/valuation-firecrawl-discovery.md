# CarMazium optional search-engine discovery for valuations

Status: **development-only, disabled by default**. Part of draft PR #629.

## Purpose

Discover additional UK retail vehicle advertisements using the Firecrawl search API, but only treat results as evidence when the original advert page itself has been retrieved and verified. Search result snippets, articles, generic valuation pages and marketplace search result summaries are NOT observed asking-price evidence. All verified adverts remain *asking prices*, not achieved sale values.

The integration complements the existing OpenAI-backed live-market search. It does not replace DVLA, MOT, dealer transaction evidence, the retail/trade valuation methodology, or the seller's control of their asking price and reserve.

## Cost, licensing and enablement

As checked on 18 October 2026, the connected Firecrawl account reported **-16 remaining credits** (1,000 included plan credits). **No live Firecrawl search or scrape was run while developing this change.** Existing connection in ChatGPT does not install or disclose an API key in the CarMazium backend.

The backend requires ALL of the following before any paid request:

1. `VALUATION_FIRECRAWL_SEARCH_ENABLED=true` deliberately set by the owner after approving use of existing credits.
2. `FIRECRAWL_API_KEY` configured in backend secrets only; never on the client.
3. `VALUATION_FIRECRAWL_APPROVED_DOMAINS` as a comma-separated allowlist of domains for which storing and using extracted advert information for valuation has been authorised. **Do not presume Auto Trader, CarGurus, Motors or other marketplace content is licensed for this purpose.**
4. Firecrawl's `GET /v2/team/credit-usage` must succeed and report a sufficient positive buffer. An exhausted, unavailable, invalid or low balance causes an empty response and **no POST search request**.

Never set flags automatically in CI, previews or production. Do not buy credits, turn on top-ups or enter into paid supplier terms without the owner approving them. The integration does not provision keys, credit packs, recurring crawls or subscriptions.

A search is capped at one `POST /v2/search` with a maximum of five source results, and `scrapeOptions` is bounded to the returned pages. No retries or background jobs. These bounds limit **per-request** cost but are NOT a global cross-instance spending cap; before enabling for all public traffic, add a shared daily budget/rate limiting mechanism and explicit cost approval.

## Data-quality rules

- Build search queries from make, model, age, trim, fuel, gearbox and rounded mileage, without a customer registration, name or address.
- Reject URLs outside the explicitly approved HTTPS domains, as well as redirects to unapproved domains through normal page verification constraints. Results must have full scraped page text.
- Require a vehicle-specific title that confirms year/make/model, an unambiguous whole-car GBP price, explicit mileage and compatible fuel/gearbox/engine/trim where known.
- Reject mixed price pages, missing mileage, sold/unavailable listings, salvage/non-runners, wrong derivatives and distant-mileage adverts.
- Send verified rows through the shared `sanitizeLiveUkComparables` pipeline and deduplicate overlapping search providers by price, year and mileage.
- Never treat derived internal CarMazium quotations as external market evidence or observed sales. Keep independent trade prices supported by actual completed auction transactions.
- Only add safe source-domain and comparable-count metadata to quote evidence. Do not create a persistent third-party listings warehouse until retention and licensing rights are confirmed.

## Test status and release criteria

All adapter tests use **mock Firecrawl API responses** and do not consume credits. Tests cover exhausted credit balance, absent allowlist, search snippets without page content, incorrect model identifiers, wrong trim, duplicate or ambiguous prices, mileage omissions, sold vehicles and capped API result counts.

Before enabling in the live product:

1. Confirm a license/right to reuse evidence from every approved source.
2. Establish available credits, account-level daily credit budget and a traffic throttle. Review Firecrawl and OpenAI cost together; do not silently increase either.
3. Bench-test at least 20 independent cars spanning high/low mileage, trims, transmissions, petrol/diesel/hybrid/EV and age bands against independent retail/trade references.
4. Verify quote confidence, source provenance, 24-hour cache integrity and the 12-month internal valuation-audit policy.
5. Complete all GitHub CI suites and secure explicit approval to merge/deploy.

Reference case: EW19CFY, 2019 Volkswagen Golf, 112,600 miles; previously £16,320 retail and £13,600 dealer guide, both LOW-confidence, against a supplied independent benchmark of £9,324 retail and £6,215 trade. This benchmark is **not** a provider response from the Firecrawl implementation.
