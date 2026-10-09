# CarMazium × SimpleDMS — DPIA (draft for pre-launch approval)
**Date:** 9 October 2026  
**Status:** Draft Data Protection Impact Assessment. Production launch is blocked until this assessment is reviewed, completed and approved by the responsible data-protection/legal decision-maker.

## 1. Processing description
CarMazium proposes to provide SimpleDMS / BuySmart with a restricted authenticated feed of eligible live CarMazium auction listings. SimpleDMS will use approved data for live dealer discovery, vehicle matching, dealer research, referral and permitted historical vehicle-event evidence.

Historical functionality is integral to the pilot. From the Pilot Launch Date, SimpleDMS may capture permitted observations so a vehicle that reappears later in the pilot can be compared with earlier permitted evidence.

## 2. Data categories
### Live permitted
- auction/listing reference;
- vehicle make/model/variant/year and selected specification;
- mileage;
- fuel/transmission/body/colour/engine;
- auction start/end/status;
- starting bid;
- approved public vehicle photographs;
- registration/VRM for approved server-side matching;
- current valid observed bid where enabled;
- broad town/region;
- CarMazium source/referral URL.

### Historical permitted
- CarMazium attribution;
- non-customer auction/event reference;
- protected internal vehicle-matching identifier;
- vehicle characteristics;
- exact observed mileage;
- observation/start/end timestamps;
- broad town/region where useful;
- starting bid;
- changed timestamped observed bids;
- explicit status.

### Prohibited
- seller/buyer/bidder identity or contact data;
- reserve;
- VIN;
- exact seller address/geolocation;
- KYC, private documents or handover material;
- payment data;
- internal CarMazium valuation;
- historical photographs;
- raw VRM in retained historical event records.

## 3. Data subjects
Primarily sellers/listing owners and, indirectly, people whose vehicle can be linked to an event through registration/matching. Dealers using BuySmart are not identified in the CarMazium feed.

## 4. Purpose and benefits
- expose live CarMazium auction inventory to relevant motor-trade users;
- enable protected matching of repeat vehicle appearances;
- improve dealer research by comparing mileage and observed auction/bid evidence over time;
- reduce misleading interpretation by preserving source attribution and observation timestamps;
- drive attributable dealer traffic to CarMazium;
- evaluate the partnership using aggregate measures.

## 5. Necessity and proportionality
The design uses a strict partner-specific API rather than general scraping. The partner query is field-selected and fail-closed. Production distribution is limited to seller-acknowledged listings. Historical evidence uses a protected identifier rather than retained raw VRM. Historical photographs and person-identifying fields are prohibited.

The consolidated agreement imposes:
- approximately 2–5 minute complete reconciliation;
- 15-minute stale hide/unavailable rule;
- short operational cache only for live raw records/images;
- 36-month event-retention clock;
- correction/deletion controls;
- no clock reset on access;
- no reconstruction of expired evidence;
- credential revocation and security controls.

## 6. Lawful basis and transparency
Proposed bases are documented in the companion LIA. Final production use is conditional on:
- approved and live Privacy Policy/Terms;
- listing-level partner-distribution acknowledgement;
- documentation of party roles and any required Article 28/data-sharing terms;
- SimpleDMS corresponding transparency/lawful-basis documentation.

## 7. Risk assessment

| Risk | Initial risk | Mitigation | Residual risk |
| --- | --- | --- | --- |
| Sellers do not expect third-party distribution | High | prospective Terms/Privacy + per-listing acknowledgement; legacy rows excluded | Low/Medium |
| Raw VRM becomes a persistent cross-source identifier | High | use only for live matching; secret-backed conversion; raw VRM excluded from historical record | Medium |
| Longitudinal history creates unexpected profiling/inferences | High | narrow vehicle-event purpose; no person identity; defined fields; no sale-price inference; 36-month clock | Medium |
| Inaccurate mileage/bid evidence harms dealer decisions | Medium/High | timestamps/source attribution; observed-bid label; correction mechanism; CarMazium remains source authority | Medium |
| Stale auction remains presented as live | High | 2–5 minute full reconciliation; preserve last good snapshot on failed refresh; >15 minute stale hide/unavailable | Low/Medium |
| Excess retention or resurrection after expiry | High | fixed clocks; no access-based reset; delete/expire controls; no reconstruction from reports/backups for new research | Medium |
| Private/KYC images leak into partner feed | High | approved public image allowlist; signed/private paths rejected; max image subset; historical photos prohibited | Low |
| Credential compromise exposes feed | High | partner-specific credential; revoke/restore rehearsed; least privilege; kill switch; no-store denied responses | Low/Medium |
| Historical data used for a new incompatible purpose | High | contractual purpose restriction + change control + termination rights | Low/Medium |
| AI provider receives raw CarMazium evidence | High | Schedule C allowlist/exclusions; raw feed/VRM/IDs/photos prohibited from OpenAI requests | Low |

## 8. Required pre-launch evidence
CarMazium must not approve production go-live until:
- final legal/privacy wording is approved and deployed;
- partner-distribution acknowledgement database/client changes pass CI and release review;
- SimpleDMS supplies evidence/attestation of HMAC or equivalent protected matching;
- SimpleDMS demonstrates raw-VRM deletion from retained historical records;
- SimpleDMS demonstrates 36-month expiry logic and no access-based clock reset;
- SimpleDMS demonstrates changed-bid observation behaviour and no bidder identity retention;
- exact production feed excludes prohibited fields;
- photo allowlist/private-path controls pass;
- controller-role/data-sharing documentation is complete;
- production credential is separately issued through a private channel;
- both parties provide written go-live approval.

## 9. Consultation / decision
External customer consultation is not planned before launch because the design instead uses prospective transparent disclosure and per-listing acknowledgement. This should be confirmed by legal/data-protection review.

SimpleDMS must review the operational controls that sit within its environment. CarMazium must review the source-data, seller-transparency and partner-eligibility controls within its environment.

## 10. Decision
**DPIA remains OPEN. Production launch is HOLD.**

Residual risks appear capable of being reduced to an acceptable level if all pre-launch controls above are evidenced. Final approval must be recorded before production.

## Source
ICO recommends considering a DPIA as a first step for data sharing, even where one is not strictly mandatory, because it helps assess necessity, risk and safeguards:
https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/data-sharing-a-code-of-practice/deciding-to-share-data/
