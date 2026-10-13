# CarMazium × SimpleDMS — Legitimate Interests Assessment (draft)
**Date:** 9 October 2026  
**Status:** Internal pre-launch compliance record. Requires final legal/data-protection review before production.

## Processing assessed
CarMazium sharing a restricted set of active auction/listing information with SimpleDMS / BuySmart for:
- live dealer discovery and referral;
- protected vehicle matching;
- permitted historical vehicle-event evidence and repeat-appearance research;
- BuySmart vehicle-history analysis and dealer-facing reports;
- aggregate partnership measurement.

The approved field set and historical exclusions are controlled by the consolidated agreement. Seller/buyer/bidder identity, reserve price, private KYC/handover material, payment data, exact seller address and internal CarMazium valuation are prohibited.

## Proposed lawful basis
CarMazium proposes to rely on:
- **contract / steps at the seller's request** only for processing genuinely necessary to operate and distribute the seller's live listing where this forms part of the disclosed listing service; and
- **legitimate interests** for proportionate partner distribution, protected vehicle matching, repeat-appearance research and related dealer-facing vehicle-history analysis where contract is not the appropriate basis.

This record concerns the legitimate-interests element.

## 1. Purpose test
The interests are:
- improving legitimate exposure of active CarMazium auction stock to relevant motor-trade buyers;
- enabling dealers to identify repeat vehicle appearances and compare permitted historical observations such as mileage and observed bid values;
- improving marketplace efficiency, research quality and fraud/inconsistency detection without disclosing seller or bidder identity;
- evaluating the commercial partnership through aggregate metrics.

These are commercial interests of CarMazium, SimpleDMS and relevant dealers. ICO guidance recognises that commercial interests can qualify as legitimate interests, provided the three-part test is satisfied.

## 2. Necessity test
The proposed processing is limited to fields reasonably required for vehicle discovery, matching, freshness, historical comparison and referral.

Controls reducing unnecessary processing:
- seller/buyer/bidder identity excluded;
- reserve, VIN, exact address, KYC/handover and payment data excluded;
- raw VRM used only for approved live server-side matching and removed from retained historical records after protected identifier conversion;
- historical photographs prohibited;
- current bid retained only when changed and always labelled as an observed bid rather than sale price;
- broad town/region only;
- 36-month fixed event clock that is not restarted by access/use;
- report-retention boundary separate from source-evidence expiry;
- partner feed revocable through dedicated credentials and kill switches.

A less intrusive design that removes vehicle matching would materially defeat the stated purpose of repeat-appearance research. The protected identifier model is therefore preferred over persistent raw VRM retention.

## 3. Balancing test
### Reasonable expectations
Safeguards intended to support reasonable expectations:
- updated Terms expressly disclose approved automotive partner syndication;
- updated Privacy Policy explains the partner feed, categories of data, matching, historical evidence and retention;
- seller declaration records acknowledgement per listing before partner distribution;
- legacy listings remain excluded unless the acknowledgement is recorded;
- SimpleDMS is contractually restricted to defined purposes and fields.

### Nature of the data
The feed is vehicle/listing data rather than special-category data. A registration number or pseudonymous matching identifier may still be personal data in context and is treated accordingly.

### Potential impact
Potential risks include:
- unexpected third-party sharing;
- creation of a longitudinal vehicle history that a seller did not expect;
- inaccurate historical evidence affecting a dealer decision;
- excessive retention or reconstruction after expiry;
- re-identification through raw VRM or combined data;
- stale listings continuing to appear as live.

### Safeguards
- prospective seller acknowledgement;
- data minimisation and explicit prohibited fields;
- raw-VRM deletion after matching conversion;
- secret-backed protected matching identifier controlled by SimpleDMS;
- fixed 36-month event clock;
- correction/withdrawal mechanism;
- stale-stock 15-minute fail-safe;
- complete feed reconciliation every approximately 2–5 minutes;
- no historical photos;
- no sale-price inference from observed bids;
- documented access/security controls;
- contractual suspension/termination rights;
- right to object and data-rights handling through CarMazium privacy channels.

## Outcome
**Conditional PASS for launch planning**, provided the following are completed before production:
1. final Terms/Privacy wording is approved and live;
2. seller partner-distribution acknowledgement is persisted per eligible listing;
3. full DPIA is completed and approved because the design includes longitudinal data matching and 36-month historical evidence;
4. SimpleDMS demonstrates protected matching and raw-VRM deletion controls;
5. controller/processor or independent-controller roles are documented by processing activity;
6. production field exclusions, retention and deletion controls pass acceptance;
7. both parties provide written go-live approval.

If any of these safeguards materially change, repeat the LIA.

## Sources
- ICO — Legitimate interests: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/legitimate-interests/
- ICO — Fairness and transparency in data sharing: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/data-sharing-a-code-of-practice/fairness-and-transparency-in-data-sharing/
- ICO — Deciding to share data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/data-sharing-a-code-of-practice/deciding-to-share-data/
