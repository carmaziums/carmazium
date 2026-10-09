# SimpleDMS privacy and photograph-rights review — 9 October 2026

**Status:** Internal launch-control review. Not legal advice and not a substitute for counsel approval.

## Decision

CarMazium should not rely on the legacy User Content wording alone to syndicate seller photographs or vehicle-identifying data to SimpleDMS.

The production design will therefore be prospective and fail closed:

1. Updated Terms and Privacy wording must be live before production partner distribution begins.
2. Each eligible listing must carry a recorded partner-distribution acknowledgement timestamp.
3. Existing/legacy listings without that timestamp are excluded from the SimpleDMS feed by default.
4. Approved public vehicle photographs may be shared only for the live integration and short operational cache; historical photograph retention remains prohibited.
5. Schedule B historical vehicle-event retention is separately activation-gated. Signing the main agreement does not by itself activate historical retention or historical matching.

## UK privacy basis — live partner feed

For the limited live feed, CarMazium may be able to rely on contractual necessity for elements genuinely forming part of the seller-requested listing-distribution service and/or legitimate interests for proportionate marketplace/dealer distribution. The final basis must be documented by activity rather than stated generically.

If legitimate interests is used, CarMazium must keep a written LIA covering:
- purpose: increase legitimate exposure of active seller listings to approved motor-trade discovery channels;
- necessity: only the minimum fields required for vehicle discovery/matching/referral are shared;
- balancing: sellers are told before distribution, legacy listings are excluded unless acknowledged, sensitive/private fields are prohibited, feeds are revocable, stale stock is removed, and users can contact CarMazium about objections/data rights.

ICO guidance states that legitimate interests may support third-party sharing, but requires the three-part purpose/necessity/balancing test, appropriate safeguards and transparency. It also states that people should be told what will happen to their data before sharing.

Sources:
- ICO, Legitimate interests: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/legitimate-interests/
- ICO, Fairness and transparency in data sharing: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/data-sharing-a-code-of-practice/fairness-and-transparency-in-data-sharing/

## Vehicle registration / matching

A raw registration number or persistent matching identifier should be treated as potentially personal data where it can be linked to an individual or vehicle history.

Production controls:
- raw VRM is supplied only when the matching field is contractually approved and technically enabled;
- SimpleDMS converts the live VRM to its protected internal matching identifier;
- raw VRM is removed from retained historical records;
- matching secrets/tokens are not sent to OpenAI or returned to CarMazium;
- historical matching cannot start until Schedule B activation.

## Historical evidence and DPIA screening

Historical matching combines or compares vehicle-event records over time and may involve data matching across sources. ICO DPIA guidance identifies data matching/combining datasets as a high-risk indicator and recommends a DPIA where processing is likely to result in high risk; where no mandatory trigger is found, the screening decision should still be documented.

For CarMazium:
- complete a DPIA or documented DPIA-screening assessment before Schedule B activation;
- record the lawful basis, purpose, data fields, 36-month event clock, report-retention boundary, matching design, correction/erasure path and residual risk;
- keep Schedule B OFF until written activation.

Source:
- ICO, When do we need to do a DPIA?: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/

## Photograph rights

UK copyright guidance states that use of copyright material generally requires permission/licence and that a licence may be limited to specified purposes.

The legacy CarMazium User Content licence permits publishing the Listing, operating the Platform and marketing the Vehicle, but does not expressly name third-party marketplace/partner syndication. To avoid relying on an ambiguous extension of that licence:

- updated Terms expressly include display/transmission/syndication through CarMazium-approved automotive marketplace/dealer-research/referral partners;
- the listing declaration expressly tells the seller that approved public listing details and vehicle photographs may be distributed while the listing is live;
- the backend records the acknowledgement per listing;
- old listings without acknowledgement remain out of the partner feed;
- historical partner photo retention remains prohibited.

Source:
- GOV.UK / Intellectual Property Office, Using somebody else's intellectual property — Copyright: https://www.gov.uk/using-somebody-elses-intellectual-property/copyright

## Technical implementation prepared

### Draft PR #444 — legal/front-end disclosure
Branch: `legal/simpledms-partner-disclosure-20261009`

Prepared, not deployed:
- updated web Terms;
- mirrored native Terms;
- updated Privacy Policy partner-feed disclosure;
- web and native seller declaration wording;
- listing payload sends `partnerDistributionAccepted` only when the required seller declaration is checked.

### Production-consent integration branch
Branch: `integration/simpledms-production-consent-gate-20261009`

Prepared:
- nullable `Listing.partnerDistributionAcceptedAt`;
- existing rows remain NULL by default;
- creation/update can record the acceptance timestamp;
- SimpleDMS production query requires `partnerDistributionAcceptedAt IS NOT NULL`;
- no legacy listing is automatically grandfathered into partner distribution.

## Launch rule

**Do not enable the production SimpleDMS feed until the legal wording is approved and live, the consent/acknowledgement migration and clients have passed CI/review, and the final production release checklist is signed off.**

**Do not activate Schedule B historical retention until CarMazium separately issues the written Schedule B activation notice defined in the consolidated agreement.**
