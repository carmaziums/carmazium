# Valuation Block 5 — comparable-model integrity and advert deduplication

## Scope

Block 5 corrects how search results become **individual usable UK advert comparables**. It does not change retail/private/auction pricing formulae, the five-LIVE/five-BLENDED sequence, the Block 2 frozen-base rule, CAP HPI licensing gates or marketplace scraping rights.

### Model and derivative checks

- Match the stated make using a canonical manufacturer alias (including Volkswagen/VW). A contradictory make or explicit model is rejected; a matching substring in the title cannot override the conflict.
- Preserve explicit generations and performance-model distinctions: **Sportage2 ≠ Sportage3**, **Fiesta ≠ Fiesta ST**, **Golf ≠ Golf GTI**, **A1 ≠ A3/A10**. Where the model field is missing, require the manufacturer and unambiguous model in the title; a title-only match is provisional.
- Preserve common source presentation differences such as X-Trail/X Trail/E-Power labels. A named generation without one on the other side or one controlled spelling edit (e.g. TIGGA4/TIGGO4) may be accepted **only provisionally**, never labelled as an exact model match.
- Explicit high-risk derivative conflicts such as ST versus ST-Line are excluded when both derivatives are present. Other unspecified trim differences remain comparables with the existing weighting rules; exact derivative confirmation still depends on reliable vehicle identity and future data-provider permissions.
- A quote using only provisional **LIVE** advert matches is labelled LOW confidence with a capped confidence score; its numeric price formula is unchanged.

### De-duplication and source evidence

- Do not infer a car's identity from price, year, mileage or trim alone. Two cars can match all of these details and still represent independent adverts.
- Canonicalise direct advert URLs for host, harmless tracking parameters and fragments. The same advert page counts once even when a later search finds a different price. Reposts on different marketplaces count once only when **both source-listed dealer identity and sufficiently specific dealer stock reference** agree and the year, mileage, variant, gearbox, fuel and asking price are compatible.
- A search/results page can list multiple vehicles under one URL. Treat it as a collection, retaining distinct advert titles and specifications instead of collapsing all entries on that page. One identical result-page row repeated on another pass is counted once.
- Model-only or short/contradictory dealer-stock identifiers never support cross-market de-duplication. Marketplace data might lack trustworthy stock references; without them, separate URLs remain separate evidence and should be manually reviewed if duplicates are suspected.
- Merge concurrently completed passes in deterministic **planned attempt order**, not network completion order. Within a single request, an advert cannot inflate the model's count by appearing in several different search attempts.
- Snapshot audit evidence includes `exactModelComparables`, `provisionalModelComparables`, `duplicateLiveAdvertRowsRemoved` and the existing total `liveUkComparables`. The duplicate counter reflects deduplication **across accepted search results** (not every rejected raw AI row).

### Staging release gates

- [ ] Finish Blocks 1–4 staging requirements and merge the stacked PRs in order.
- [ ] Replay the historical vehicles from the valuation audit: inconsistent Audi A1 labels, Fiesta versus Fiesta ST, Sportage generation suffix, X-Trail powertrain naming, Chery TIGGA/TIGGO 4, and registration mistakenly used as a model.
- [ ] Verify a mismatched model does not pass via title substring. Review cases where a source omits model/trim, and audit the precision/recall trade-off before allowing provisional comparables at scale.
- [ ] Verify actual marketplace results pages and direct-advert URLs, changed tracking parameters, amended prices, independent vehicles with the same price/mileage, and evidence from overlapping attempts.
- [ ] Confirm the new output schema's nullable `dealerName` and `stockReference` fields are reliably returned, and manually verify a sample of **source-present** stock references before enabling cross-market dedup assumptions.
- [ ] Compare matching and rejected/duplicate counts and p95 search latency before/after in staging; confirm customer-visible amounts change only when invalid or duplicate comparables are correctly excluded.
- [ ] Respect marketplace usage rights. Neither the new stock-reference field nor URL canonicalisation authorises scraping, persistent storage or republication.

PR remains draft, not deployed. Complete staging against genuine source data and obtain approval before production release.
