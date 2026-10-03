# CarMazium valuation Block 6 — separate retail, private-sale and auction methods

## Intent and evidence limits

The original valuation engine used a shared retail-like `low/mid/high` range and derived auction opening bids/reserves using fixed 70%, 90% and 95% multipliers. This is **not** evidence that auction prices or private-sale prices consistently have those ratios. Block 6 introduces independent, explicitly labelled channel guidance. The legacy `low/mid/high` broad-market guide remains for client compatibility and the existing frozen-base contract.

**Retail asking channel**
- With **three or more** normalized, distinct `ACTIVE_ASK` listings, calculate channel-specific 25th and 75th weighted quantiles of the actual normalized *advert asking price scale*. Tag `OBSERVED` with `observedAsks`. Advert prices are **not** completed-sale prices, nor necessarily franchised-dealer adverts.
- Otherwise use the legacy `mid/high` range and mark `PROVISIONAL_PROXY`. This is a guide for a suggested asking/minimum, not a promised sale.

**Private-party channel**
- Requires **three or more explicitly identified and verified completed PRIVATE transactions** before computing sale-price quantiles and marking `OBSERVED`.
- Legacy `Sale.soldPrice` rows do **not** reliably distinguish private individuals from dealers or attest external bank confirmation. They are therefore **not** classified as verified private sales. Currently the public system usually returns an explicitly labelled `PROVISIONAL_PROXY` based on the broader market range. Never describe it as independently measured private-sale value without a provenance feed and QA.

**Dealer auction channel**
- Count an achieved auction outcome only if the auction has `status=ENDED`, linked listing `status=SOLD`, valid winner, paid buyer platform fee, approved handover (seller-bonus approved), no buyer refusal and either seller-funds confirmation or its explicit legacy exemption. Seller confirmation is an **attestation**, not an independent bank transfer verification.
- When at least three such outcomes pass, derive the 25th/50th/75th weighted *auction-only* distribution; no retail-to-auction fixed-percent conversion. The auction market value and reserve guidance are based on those outcomes. The opening-bid guide uses the observed lower-half price spread and is **not an automatic listing minimum**.
- Otherwise display `PROVISIONAL_PROXY`: market value anchored to the broader lower market guide, with spread-based indicative opening/reserve guidance and an explicit notice that the platform lacks adequate completed auction transactions for a measured auction clearing value. A winning bid without completed handover does not count.
- The broad-market calculation still contains historical approximate active-ask and auction mixing adjustments. A future evidence-calibration block will assess those coefficients; this block ensures the **channel-specific result** uses separately normalized unboosted prices and its own cohort.

**Deterministic edits**
- Once a broad base is frozen, specification/condition changes multiply each **independently calculated** retail, private and auction field by the same deterministic vehicle-spec factor. This avoids recomputing auction reserves from universal 70/90/95% ratios after an edit. The frozen base, five-live/five-blended sequence, upstream identity gates and licensed CAP HPI shadow comparison remain unchanged.
- Web/native response types are backwards-compatible: legacy cached bases may lack the new optional `privateSale` and evidence labels. UI shows the relevant retail or auction channel rather than always displaying auction market value; unobserved private-sale guidance is marked provisional.
- Browser/native registration-free local fallback is also clearly provisional and replaces its old 70/90/95% display guides with range-driven proxies. Neither fallback is used silently for a registered vehicle after backend verification failure.

## Staging/release gate

- [ ] Merge Blocks 1–5 in order only **after** their staging verification, licensing and security gates.
- [ ] Compare real retail advert snapshots, independently verified private-party sales when legally available, and genuine completed auction handovers. Do not invent a private-sale transaction cohort when source identity cannot be confirmed.
- [ ] Reconcile unverified historical winning bids, refused/cancelled sales, unpaid platform fees, pending handover photos and legacy no-confirmation cases to prove they do not inflate auction result statistics.
- [ ] Inspect test fixtures for 3+ valid examples, 0/1/2 observations, sparse and heterogeneous price distributions, and same-vehicle repeat valuations/spec changes.
- [ ] Verify websites and both native platforms show source/evidence disclaimers and always apply the *correct* selling-channel figure. Verify seller-entered asking/reserve is **not silently overridden** by indicative guidance.
- [ ] Validate numeric accuracy and confidence against verified real achieved prices; the separate completed-sale calibration/data-quality work in Block 9 remains necessary. Set minimum sample and spread policies based on that evidence, not inferred population averages.
- [ ] Review legal/privacy rights for use of sale-price evidence; confirmed funds means seller attestation only and must not be represented as bank-verified financial transfer.
- [ ] Ensure the fully stacked six-block GitHub Actions suite passes; run staging PostgreSQL concurrency and market-provider timeout tests separately. No production deployment from this draft PR.

**No guarantee:** All channel outputs remain estimates. In particular, `PROVISIONAL_PROXY` auction reserves and opening bids are advisory placeholders, not confirmed market prices and not automatically applied auction rules.
