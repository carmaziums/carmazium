# CarMazium valuation Block 8 — evidence strength and honest source explanation

## What this block changes

Block 8 replaces the old assumption that a greater **number** of records implies a higher validated confidence score. The new conservative `2026-10-block8-v1` rubric assesses the type and provenance of the evidence, verified vehicle identity, unique exact-model adverts, cited source diversity, timestamp validity and explicitly confirmed completed platform outcomes.

**Important:** Confidence remains an **uncalibrated descriptive indicator** of evidence strength, not the likelihood that the eventual selling price will fall within the range. **HIGH is intentionally withheld in Block 8**, even for plentiful live adverts or verified platform handovers. Block 9 must separately quantify realised-sale prediction error and determine acceptable coverage before that category can be used responsibly.

### Evidence boundaries

- `LIVE_UK_MARKET` means genuinely accepted and deduplicated current UK **advert asking prices**, not verified realised prices. `BLENDED_MARKET` combines those adverts with separate platform market signals; its source explanation must retain both counts.
- A mere successful web request or a long list of duplicated adverts does not warrant MEDIUM. For live-only evidence, require at least **three accepted exact-model adverts**, from **two identifiable cited sites**, with a valid market-evidence timestamp not older than **24 hours**, a measured normalized interquartile price spread no greater than **35% of the median**, and `MODEL_VERIFIED` registration/year/model verification. This 35% dispersion cutoff is a conservative interim operational check, not a statistically calibrated accuracy threshold. Provisional-only model labels, unverified identity, one site or sparse/stale evidence remain LOW.
- A platform cohort can also justify MEDIUM if at least **three independently eligible, completed auction handovers** or properly verified private sales exist, the corresponding Block 6 channel cohort is `OBSERVED` (not `PROVISIONAL_PROXY` due to incoherent prices), and the vehicle identity is fully verified. Auction handover includes *seller-attested funds*, not an independent bank check. Historical generic `Sale` rows and accepted offers are not automatically verified private sales or final completed transactions.
- `CARMAZIUM_MODEL` and `CARMAZIUM_MODEL_PROFILE` always remain LOW. Earlier frozen snapshots with incomplete match/site/time metadata are described conservatively instead of inheriting legacy HIGH scores.
- The legacy `confidenceScore` remains numeric for API compatibility but uses conservative rubric constants; it is never advertised as a percent chance, statistical interval or proved forecast accuracy. The customer-facing badge says **evidence strength**, not calibrated certainty.

### Customer-facing evidence

Web and native responses include a structured `confidenceAssessment` with rubric version, level, calibration status, source-specific prose, count breakdown, market check timestamp (only if valid), limited categorical reason codes and comprehensible limitations. Display identifies UK **adverts versus actual outcomes**, does not expose source-listed vehicle records, provider-licensed prices, raw reference XML, credentials, VRMs or customer data. Source domains remain counts rather than unverified click-through endorsements.

The separate Block 6 retail, private and auction channel `OBSERVED`/`PROVISIONAL_PROXY` labels remain intact. A MEDIUM general evidence grade **cannot** turn an unsupported individual auction/private channel into a measured achieved-price observation.

Specification edits under Block 7 only scale price fields against the frozen market base; source-evidence quality, matched records, timestamps and rubric version do not improve simply because a seller changes damage or trim. Partial identity can downgrade a frozen assessment but must never display a contradictory MEDIUM note beside a LOW warning.

### Required staging tests

1. Merge the earlier seven blocks **only after** their existing independent DVLA/MOT, Postgres locking, genuine provider, data-use, timeout, comparables, completed-sale provenance and web/native parity gates are satisfied.
2. Re-run all backend/web/native contract and application checks; specifically audit 0/1/2 adverts, many all-asking adverts, provisional-only matches, duplicate listings, malformed/stale future timestamps, one site, 2+ sites, identity unknown/partial, 3+ completed eligible handovers, unfinished bids, historical accepted offers and internal-only model fallbacks.
3. Compare web, iOS and Android visible source counts, quoted check time, LOW/MEDIUM label and channel-specific caution. Old snapshots and registration-free browser/native fallbacks without a saved Block 8 evidence assessment must show an explicit provisional disclaimer.
4. Ensure the service freezes this assessment **after** Block 5 dedup and Block 6 completed-sale provenance selection, and upgrades old frozen snapshots without market requery, changing monetary values or writing misleading evidence.
5. Validate source-site diversity and timestamps against authorised real UK provider samples; the OpenAI-assisted source extraction may be incomplete or stale and is not independent certification of publisher authenticity.
6. **Do not** claim the rubric is statistically calibrated or permit HIGH until Block 9 verifies error distributions, independent achieved-sale datasets and appropriate cohorts. Even after calibration, a price range is not a guarantee.
7. Keep this PR draft and unmerged. CI success is necessary but does not replace staging provider testing, security review or production sign-off. Fly.io deployment and app-store rollout are out of scope.
