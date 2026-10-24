# CARMAZIUM × SIMPLEDMS — CONSOLIDATED EARLY-LAUNCH INTEGRATION, LIVE-FEED AND HISTORICAL-EVIDENCE LICENCE
**Fixed execution-review signing copy — version 24 October 2026, Revision 3. UNSIGNED. Updated after SimpleDMS's 24 October agreement in principle to the narrowly scoped initial-pilot-only CarMazium recovery/security variation. Prepared for Patricia Jean Abel's and CarMazium's final review; NOT approved for signature or production use until outstanding Schedule C account-specific provider, privacy and qualified legal/data-protection confirmations are resolved and both parties approve this exact version.**

This document is intended to replace, on signature, the earlier pilot-data-licence and historical-data proposal drafts. Until signature, the existing production API remains disabled and no production credential or live-data permission is granted. Synthetic staging may continue under separate test-only controls.

## Parties

**(1) CARMAZIUM LTD** ("CarMazium"), company number **17053307**, registered office **181 Hunters Road, Birmingham, United Kingdom, B19 1ES**, acting through its director **Afaq Iftikhar**.

**(2) SIMPLEDMS LTD** ("SimpleDMS"), company number **17167272**, registered office **Brightfield Business Hub, Bakewell Road, Orton Southgate, Peterborough, Cambridgeshire, England, PE2 6XU**, acting through **Patricia Jean Abel, Director**, as its intended authorised signatory.

Technical/security contact for SimpleDMS: **Stephen Abel — info@simpledms.co.uk**.

## 1. Effective date, launch and pilot period

1.1 This agreement takes effect on the date of the final signature ("Effective Date").

1.2 The **Pilot Launch Date** is the date on which:
(a) both parties have completed their agreed production acceptance checks;
(b) the privacy, lawful-basis, protected vehicle-matching, raw-VRM deletion and other safeguards required for the Schedule B historical functionality have been completed and verified;
(c) CarMazium has enabled the dedicated production partner API and issued the separate production credential;
(d) BuySmart is displaying the approved CarMazium live integration to eligible dealers and the licensed Schedule B historical capture/matching functionality is enabled and ready from the beginning of the pilot; and
(e) both parties confirm in writing that the complete integration — live and historical — is live and working.

1.3 The initial pilot runs for **90 calendar days from the Pilot Launch Date**, unless ended earlier under section 13.

1.4 Synthetic staging and test-key work may continue before signature using fictional/non-production data only. Synthetic staging does not start the 90-day pilot.

## 2. Commercial basis

2.1 SimpleDMS waives the previously proposed **£5,000 integration and launch fee**. Development of the agreed integration and the initial 90-day pilot are free of charge to CarMazium.

2.2 CarMazium will charge SimpleDMS **no fee for the agreed initial partner API access, approved live-feed licence or Schedule B historical-evidence licence** during the pilot or for the surviving fixed-duration historical rights created from observations legitimately obtained during the licence period.

2.3 There is no automatic renewal, subscription, exclusivity, minimum-usage commitment, revenue share or post-pilot financial commitment. Any later commercial arrangement must be separately agreed in writing.

2.4 Each party bears its own internal and third-party costs and may not incur charges on the other's behalf without prior written approval.

2.5 Neither party guarantees any minimum number of auctions, impressions, dealers, registrations, bids, purchases, reports or conversions.

## 3. Integration model and control boundaries

3.1 The integration is a **one-way, read-only partner feed** from CarMazium into BuySmart. SimpleDMS has no authority to bid, transact or act as CarMazium.

3.2 CarMazium retains exclusive control of:
- account creation and identity/dealer verification;
- bidding and auction rules;
- seller communications;
- vehicle inspections and handover;
- buyer/seller payments and CarMazium platform fees;
- disputes, cancellations and transaction completion.

3.3 SimpleDMS will display CarMazium as the source of live CarMazium inventory and deep-link interested dealers to the relevant CarMazium auction.

3.4 Neither party obtains access to the other's source code, source repositories, internal administration systems, database credentials, cloud credentials, secret-management systems, internal endpoints, proprietary scoring logic or confidential analytical methods.

3.5 SimpleDMS will not provide CarMazium with Autotrader-derived valuation data, Autotrader-derived datasets or other third-party derivative data that SimpleDMS is not entitled to sublicense.

## 4. Live partner API licence

4.1 During the licence period CarMazium grants SimpleDMS a non-exclusive, non-transferable licence, **revocable in accordance with the suspension and termination provisions of section 13**, to access the dedicated partner API solely for:
- live BuySmart auction discovery;
- vehicle matching and BuySmart analysis;
- dealer-facing research/reporting;
- outbound dealer referral to CarMazium;
- agreed aggregate partnership reporting.

For clarity, "revocable" does not create a separate right to terminate ordinary live access immediately for convenience outside section 13: the **30-day written convenience notice** in section 13.1, proportionate urgent suspension rights in section 13.2 and accrued historical/report rights that survive under sections 13.4–13.6 remain applicable, subject to section 13.5 and applicable law.

4.2 The approved live-feed fields are listed in **Schedule A**. CarMazium may temporarily disable a field for a genuine technical, security, rights or legal reason while working in good faith to restore agreed functionality where appropriate.

4.3 The API will never intentionally provide:
- seller or buyer identity/contact data;
- bidder identity;
- reserve price;
- exact seller address;
- identity/KYC documents;
- private handover evidence;
- payment information;
- account/session credentials;
- internal CarMazium valuations;
- VIN unless later expressly added by signed amendment.

4.4 SimpleDMS must use the dedicated authenticated API and must not scrape other CarMazium endpoints to reconstruct restricted fields.

4.5 Live API responses may be cached only to operate the agreed integration. Cache permission does not create historical rights except as expressly stated in Schedule B.

## 5. Live synchronisation and operational cache

5.1 SimpleDMS will normally perform a complete authenticated paginated reconciliation approximately every **2–5 minutes**, subject to agreed rate limits and reasonable service availability.

5.2 After a successful complete snapshot, a vehicle that no longer appears as live must be removed promptly from the BuySmart live marketplace.

5.3 If a refresh fails, a CarMazium listing older than **15 minutes** since its last successful refresh must be hidden or clearly unavailable for a dealer purchase decision until freshness is restored.

5.4 Raw live records, raw registrations and any temporary live image copies may be kept while needed for the live integration plus an internal reconciliation buffer of up to **24 hours** after removal from the live feed. They must not remain dealer-facing as live inventory after removal.

5.5 On ordinary termination or pilot expiry, live access stops and the operational live cache, raw live registrations and temporary live image copies are deleted within **7 calendar days**, subject only to protected provider backup residuals that expire under the documented provider retention cycle and are unavailable for ordinary use.

## 6. Production photographs

6.1 Reliable approved vehicle photographs are a production-launch requirement for the agreed BuySmart experience.

6.2 CarMazium will confirm that it has the rights necessary to syndicate each photograph made available through the partner feed for the live-display purposes in this agreement.

6.3 SimpleDMS may use live photographs only for the live BuySmart integration and the short operational cache. **Historical photograph retention is not licensed.**

6.4 If CarMazium receives a credible rights complaint or identifies an image it is not entitled to syndicate, SimpleDMS will remove the affected image promptly after notice or feed withdrawal.

## 7. Historical vehicle-event evidence — Option A

7.1 Subject to the safeguards in this section and Schedule B, CarMazium grants SimpleDMS the right to retain approved minimum historical vehicle-event evidence that SimpleDMS legitimately receives while this agreement is in force.

7.2 Each approved historical event record may be retained for up to **36 months from that vehicle's last permitted CarMazium observation**.

7.3 During that fixed retention period, the approved historical evidence may continue to be used, including after the 90-day pilot or ordinary termination, solely for:
- vehicle matching;
- repeat-appearance research;
- BuySmart vehicle-history evidence;
- market analysis;
- generation of new BuySmart reports;
- accuracy/correction work and agreed aggregate analytics.

7.4 The surviving historical licence does **not** permit continued collection of new CarMazium data after live access ends. On expiry/termination SimpleDMS must remove CarMazium as a live source and stop polling the live API.

7.5 Accessing an historical record, matching a vehicle, generating a report or reopening a report **does not restart or extend the underlying event-retention clock**.

7.6 Expired historical event evidence must not be recovered from an older dealer report, backup, cache or derived record to seed new matching, research or report generation.

7.7 Properly anonymised, non-reconstructible aggregate analytics that do not identify or permit reconstruction of a specific vehicle, auction, registration, seller, bidder or substantial CarMazium source dataset may be retained after the relevant event records expire.

7.8 The retention, deletion and expiry restrictions in this agreement apply to **CarMazium-sourced evidence and records derived from that evidence**. They do not restrict data that SimpleDMS independently and lawfully obtains from another source under separate rights. SimpleDMS must not relabel CarMazium-sourced evidence as independently sourced, use another source as a pretext to preserve expired CarMazium evidence, or reconstruct expired CarMazium records from reports, caches or derived CarMazium datasets.

## 8. Historical permitted fields and practical evidence rules

8.1 The historical field set is intentionally narrower than the live feed. Schedule B permits:
- CarMazium source attribution;
- a CarMazium event/auction reference that does not expose a customer identity;
- a SimpleDMS-controlled protected internal vehicle-matching identifier;
- vehicle make, model, variant and model year;
- fuel type, transmission, body type, colour and engine size where supplied;
- **mileage as observed at the relevant event** rather than only a mileage band;
- observation timestamp and relevant auction start/end timestamps supplied by CarMazium;
- broad town/region where supplied and useful;
- starting bid where supplied;
- **changed, timestamped valid current-bid observations** received during the normal live synchronisation cycle;
- explicit auction/listing status supplied by CarMazium.

8.2 Historical evidence must not include:
- raw registration number after the operational conversion period;
- historical photographs;
- reserve price;
- seller, buyer or bidder identity/contact information;
- exact address or precise geolocation;
- VIN;
- private inspection/KYC/handover material;
- payment data;
- CarMazium internal valuation;
- full private notes or internal admin records.

8.3 Bid observations:
(a) SimpleDMS may retain a changed valid bid value when the live API reports a different current valid bid from the last stored value for that event;
(b) SimpleDMS need not store repeated identical bid snapshots;
(c) each stored value must retain its observation time;
(d) it must always be described as an **observed bid**, never a confirmed final bid, sale price, realised transaction price or proof that the vehicle sold.

8.4 The parties agree that exact observed mileage is useful to vehicle research and may be retained under the same fixed event-retention period, subject to the data-minimisation and correction obligations below.

## 9. Protected vehicle matching and raw registration handling

9.1 Live registration data may be supplied for the approved matching purpose in Schedule A.

9.2 SimpleDMS may convert the registration into a secret-backed internal matching identifier using a cryptographically strong keyed construction such as **HMAC-SHA-256** with a secret held only in SimpleDMS's controlled secret-management environment.

9.3 SimpleDMS retains ownership and control of its matching secrets, internal identifiers and matching methods. CarMazium is not entitled to receive SimpleDMS's secret key or proprietary matching implementation.

9.4 Raw registration must not form part of the retained historical event record. After a vehicle ceases to be live, SimpleDMS must remove the raw registration within the operational reconciliation period in section 5.4 once the protected matching identifier and necessary correction references have been established.

9.5 The protected identifier is pseudonymous rather than automatically anonymous. It remains subject to the agreed purpose, security, correction and deletion controls.

9.6 SimpleDMS must maintain a secure method to action a verified CarMazium correction/deletion request by event reference or by transiently recomputing the matching identifier from a securely supplied registration, without disclosing the SimpleDMS matching secret to CarMazium.

9.7 Secret rotation must not be used to extend event retention. If identifiers are re-keyed, the original event expiry date remains unchanged.

## 10. Dealer reports and separate report-retention clock

10.1 A BuySmart report legitimately generated while its underlying source evidence is within its permitted retention period may remain accessible to the authorised dealer account to which it was issued for up to **36 months from the report's generation date**.

10.2 The report-retention period and the underlying event-retention period are separate. A fixed report may therefore remain accessible after an underlying event record has reached its deletion date.

10.3 Once an underlying historical event record expires:
- that event may remain only as content already fixed within a legitimately issued report;
- it may not be extracted from the report to repopulate the historical event store;
- it may not be used to create a new report, refresh a later report or drive new repeat-appearance matching.

10.4 Reopening a report does not restart its 36-month clock.

10.5 Dealer-report access must be limited to the authorised BuySmart dealer/user population for which the report was legitimately generated. No public historical CarMazium mirror, bulk export or resale of source records is permitted.

10.6 A valid legal, accuracy, rights or deletion request may require correction, suppression or deletion of affected evidence inside an existing report. SimpleDMS will maintain a reasonable correction mechanism and preserve an audit trail of the correction without retaining deleted source data beyond what lawfully remains necessary.

## 11. OpenAI and other AI-provider processing

11.1 SimpleDMS has disclosed that OpenAI forms part of its existing technology arrangements for BuySmart explanatory/reporting functionality and that SimpleDMS does not propose changing its provider data-sharing configuration solely for this partnership.

11.2 CarMazium agrees in principle to a **limited, expressly scoped CarMazium-derived AI input set**, provided this section and Schedule C are satisfied before production use.

11.3 Permitted AI inputs are limited to the minimum non-identifying vehicle facts and structured BuySmart assessment inputs required to generate an explanation. They may include agreed vehicle characteristics such as make, model, variant, model year, fuel, transmission, body type, engine size and a suitably minimised mileage/market assessment input.

11.4 The following must **never** be submitted to OpenAI under this licence:
- registration/VRM;
- the SimpleDMS protected matching identifier or matching secret;
- CarMazium event/auction identifiers where they would act as stable matching identifiers;
- seller, buyer or bidder data;
- reserve prices;
- photographs;
- raw API/feed responses;
- credentials or API keys;
- private documents;
- exact location;
- CarMazium source code or internal-system data.

11.5 OpenAI's currently published API data-control policy states that API data is **not used to train or improve models by default unless the customer explicitly opts in to sharing**. SimpleDMS has stated that its existing provider configuration may enable such sharing. This agreement does not require SimpleDMS to change that configuration; if that opt-in/sharing configuration is enabled, CarMazium expressly permits it **only for the approved minimised AI input set above**, not the raw feed or excluded fields. Before signature, SimpleDMS will record the relevant account setting in Schedule C. Reference: https://developers.openai.com/api/docs/guides/your-data

11.6 Before signature/production use, Schedule C must record in proportionate, redacted form:
- the OpenAI product/API pathway used;
- whether SimpleDMS's relevant account has enabled optional sharing of API inputs/outputs for model/service improvement;
- the applicable provider retention arrangements reasonably known to SimpleDMS;
- applicable DPA/contract and international-transfer safeguards;
- the technical control that prevents excluded CarMazium fields from entering prompts.

11.7 A provider-configuration or retention change that materially expands the CarMazium-derived information exposed to the provider requires prior written agreement. A change that merely alters provider infrastructure without expanding the permitted CarMazium data set requires notice where contractually material.

11.8 Nothing in this section authorises SimpleDMS to upload CarMazium's complete feed, raw historical event store or private customer records to an AI provider.

11.9 **Provider-deletion boundary and continuing obligations.** Optional, expressly permitted model-improvement sharing may be subject to the provider's own retention and model-improvement processes; the parties do not represent that such shared information can always be deleted from previously trained model weights or that it will be automatically erased on a fixed date. This limited provider-side technical boundary **does not waive** applicable data-protection obligations, lawful erasure/correction requests, or SimpleDMS's duties to correct, suppress, expire or delete CarMazium-sourced records and derived evidence under sections 7.5–7.8, 10.6 and Schedule B. SimpleDMS must prevent excluded fields from being submitted in the first place; remove or correct records and derived outputs within its own systems; use reasonably available provider-side deletion and suppression mechanisms where applicable; and apply appropriate documented mitigation where deletion from provider model weights is not technically available. Changes to sharing or retention require **the contractual notice or prior written agreement, as applicable**, under sections 11.7, 12.5 and 20 **before the changed arrangement is relied on for CarMazium data**. Routine model, security and infrastructure changes within the approved data scope remain permitted under sections 11.7 and 20.2, subject to any required notice.

## 12. Infrastructure and subprocessors

12.1 SimpleDMS has stated that its production application runtime is configured in **London with Vercel** and its production Supabase project is also hosted in **London**.

12.2 The parties acknowledge that support operations, control-plane functions, security/logging systems, backups and provider subprocessors may involve processing outside a primary UK application/data region. This agreement therefore makes **no blanket UK-only processing representation**.

12.3 Before production launch, SimpleDMS will provide a proportionate provider schedule identifying:
- provider and purpose;
- primary application/data region where applicable;
- role and relevant DPA/contract;
- material international-transfer mechanism;
- material retention/deletion treatment;
- incident/security contact pathway;
- any material subprocessor information reasonably required for the parties' compliance.

12.4 The provider schedule may be redacted to protect security and confidential information and need not include credentials, private infrastructure identifiers, internal endpoints, source code, network diagrams or proprietary configuration details.

12.5 The Schedule C provider record must accurately describe the account-specific arrangements and be completed and confirmed by the relevant party **before signature** and, in all events, before production use. Any genuinely unavailable item may be marked **"to be confirmed before signature"** only during draft review. If a material provider, configuration, subprocessor, region, retention, transfer or data-sharing arrangement changes, the party relying on it must update the provider record and give the required contractual notice or obtain prior written agreement under section 11.7 and the applicable change-control provisions **before relying on the changed arrangement for CarMazium data**. No unverified draft statement is a production approval.

## 13. Termination and survival

13.1 Either party may terminate for convenience on **30 days' written notice**.

13.2 Either party may immediately suspend affected processing or access where reasonably necessary for a genuine security incident, legal/regulatory concern, source-rights problem or imminent material risk. The suspension should be proportionate to the issue and the parties will cooperate promptly on remediation.

13.3 For a remediable material breach, the non-breaching party should normally give written notice and **10 business days** to cure before termination. No cure period is required for fraud, deliberate misuse, serious credential compromise, unlawful disclosure or another breach that cannot reasonably be cured.

13.4 On pilot expiry or ordinary convenience termination:
- SimpleDMS stops new collection and CarMazium live-source display;
- production credentials are revoked;
- operational live data is deleted under section 5;
- **lawfully obtained Schedule B historical event evidence continues until each record's original 36-month expiry date**;
- legitimately issued reports continue under section 10.

13.5 The surviving historical rights in section 13.4 do not override a legal obligation, valid data-rights request, source-rights failure or termination for material misuse of CarMazium data. In those circumstances the affected historical use may be suspended, corrected or deleted to the extent reasonably necessary.

13.6 Sections concerning confidentiality, IP, liability, accrued rights, permitted historical/report retention, correction/deletion, and governing law survive to the extent their purpose requires.

## 14. Reciprocal aggregate reporting

14.1 During the pilot, the parties will exchange an aggregate partnership summary approximately **monthly**.

14.2 SimpleDMS will provide reasonably available aggregate counts for:
- CarMazium auction impressions;
- individual vehicle views;
- BuySmart reports generated using CarMazium live/historical evidence;
- outbound clicks to CarMazium.

14.3 CarMazium will provide reasonably and lawfully attributable aggregate counts for:
- dealer registrations attributed to SimpleDMS;
- qualified bids on the relevant referred auctions;
- handover-approved completed purchases on the relevant referred auctions.

14.4 Reports will not exchange dealer names, customer email addresses, telephone numbers, seller identities, payment records or other unnecessary person-level data.

14.5 Both parties acknowledge attribution limitations, including consent choices, cross-device activity, unclaimed referral sessions, dealer/staff role ambiguity, ad blockers and technical outages. Aggregate attribution is evidence for partnership evaluation, not guaranteed causation.

## 15. Confidentiality

15.1 Each party must keep the other party's non-public commercial, technical, security and business information confidential and use it only to perform this agreement.

15.2 Confidential information does not include information that:
- is lawfully public without breach;
- was already lawfully known without a duty of confidence;
- is independently developed without use of the other party's confidential information; or
- is lawfully obtained from a third party without confidentiality restriction.

15.3 Disclosure is permitted to personnel, professional advisers and approved service providers who need the information and are subject to appropriate confidentiality obligations, or where legally required.

15.4 Ordinary confidentiality obligations survive for **5 years** after termination. Trade secrets, credentials and proprietary source code/methods remain protected for so long as they retain their confidential/trade-secret character.

## 16. Intellectual property

16.1 CarMazium retains ownership of its platform, brand, API, source auction data and other pre-existing IP.

16.2 SimpleDMS retains ownership of its software, BuySmart product, scoring, matching methods, matching secrets, internal identifiers, report structures, analytical methods, models and independently developed outputs.

16.3 SimpleDMS ownership of a report or analytical method does not enlarge the licence to underlying CarMazium source evidence. Embedded CarMazium evidence remains subject to this agreement's field, purpose and retention limits.

16.4 CarMazium receives no ownership or access right in SimpleDMS's proprietary analytical methods, source code, matching secrets or third-party licensed data.

16.5 SimpleDMS receives no ownership or access right in CarMazium's source code, administration systems, credentials or restricted internal datasets.

16.6 During the live integration, each party grants the other a limited, revocable right to use its name/logo solely as reasonably necessary to identify the integration and source, subject to supplied brand guidelines and withdrawal for misuse.

16.7 After live access ends, SimpleDMS may continue to use the **CarMazium name in factual source attribution only** for CarMazium evidence that remains lawfully retained under sections 7 and 10. This surviving attribution right lasts only for the permitted historical/report-retention period, must not imply that CarMazium remains a current live source or partner, and does not include continuing logo/brand-mark use unless separately agreed.

## 17. Data protection, correction and security

17.1 Each party will comply with applicable UK data-protection law for the processing it controls. The parties will document their controller/processor or independent-controller roles by processing activity before production launch and enter any Article 28 or data-sharing terms that are legally required.

17.2 The parties recognise that a registration number or pseudonymous matching identifier may remain personal data in context. Pseudonymisation is a risk-reduction control, not automatic anonymisation.

17.3 SimpleDMS will maintain documented retention/deletion controls implementing the clocks in sections 5, 7 and 10 and will not extend a clock because a record was accessed.

17.4 Each party will take reasonable technical and organisational security measures appropriate to the data it handles, including least-privilege access, secure secrets, encryption in transit, access logging where appropriate and prompt credential revocation.

17.5 Each party will inform the other **without undue delay and, where practicable, within 24 hours of discovery** of a confirmed incident materially affecting licensed data, and will cooperate with legally required notifications and remediation.

17.6 CarMazium may send a documented correction/withdrawal notice for materially inaccurate source evidence. SimpleDMS will propagate a validated correction to active historical records and, where necessary for accuracy or law, to affected accessible reports.

## 18. Warranties and disclaimers

18.1 Each party warrants that it has authority to enter this agreement.

18.2 CarMazium warrants that, to the best of its reasonable knowledge and subject to individual takedown rights, it has sufficient rights to license the API fields and photographs it enables for the purposes expressly granted here.

18.3 SimpleDMS warrants that it has or will have the contractual rights necessary to use its named providers for the permitted purposes and will not intentionally submit excluded CarMazium fields to those providers.

18.4 CarMazium marketplace data, observed bids and vehicle information are supplied as source observations and may contain seller-entered or third-party inaccuracies. Unless expressly stated otherwise, neither party warrants that a bid observation is a completed sale price or that historical evidence is suitable as a valuation.

18.5 Except for express terms in this agreement and rights that cannot lawfully be excluded, neither party gives an implied warranty of uninterrupted availability, fitness for a particular purpose, traffic volume or commercial result.

## 19. Liability

19.1 Nothing limits liability for:
- fraud or fraudulent misrepresentation;
- death or personal injury caused by negligence;
- deliberate unlawful disclosure or deliberate misuse of the other party's credentials/data;
- any liability that cannot legally be limited.

19.2 Subject to 19.1, each party's aggregate liability for **ordinary breaches** of this agreement is subject to a **£25,000 sub-cap**.

19.3 Subject to 19.1, claims involving breach of confidentiality, data-protection obligations, security obligations or misuse of licensed intellectual property/source data are subject to the higher **£50,000 cap**.

19.4 The liability caps operate **across this agreement as a whole and are alternative, not cumulative**. Subject to 19.1, each party's total aggregate liability for all claims arising out of or in connection with this agreement will not exceed **£50,000 in total**. The £25,000 ordinary-breach cap sits within, and does not add to, that £50,000 overall cap. Splitting related events into separate claims, claim categories, reporting periods or legal causes of action does not create additional caps.

19.5 Subject to 19.1, neither party is liable for indirect or consequential loss, or for loss of anticipated profit, revenue, goodwill or business opportunity, except to the extent such loss forms part of a third-party claim for which liability is otherwise established under this agreement.

19.6 The parties acknowledge that this is a free early-launch collaboration and that the liability allocation is intended to be proportionate to that commercial context. Both parties should obtain legal advice before signature.

## 20. Governance and changes

20.1 Material changes to the live field set, historical purposes/fields, retention clocks, AI input scope, provider use, reporting, or commercial terms require written approval by authorised representatives.

20.2 Routine security patches, infrastructure replacements or implementation changes that do not expand licensed data/purpose may be made without amendment, subject to any required notice.

20.3 Neither party may assign this agreement to an unrelated third party without the other's prior written consent, not to be unreasonably withheld, except as part of a genuine sale/reorganisation of substantially all of the relevant business where the successor assumes the obligations.

## 21. Governing law and dispute resolution

21.1 This agreement is governed by the law of **England and Wales**.

21.2 Before issuing proceedings (except urgent injunctive relief), the parties will first escalate the dispute to Afaq Iftikhar for CarMazium and Patricia Jean Abel or another authorised director for SimpleDMS and allow at least **10 business days** for good-faith resolution.

21.3 The courts of England and Wales have exclusive jurisdiction.

---

# SCHEDULE A — APPROVED LIVE PRODUCTION FEED

The following are approved for the initial production integration, subject to technical availability and rights verification:

| Field/category | Initial status | Conditions |
| --- | --- | --- |
| Auction/listing reference | YES | Partner feed reference only |
| Vehicle title/specification | YES | Published auction fields |
| Make/model/variant/year | YES | Published fields |
| Mileage | YES | Current published mileage |
| Fuel/transmission/body/colour/engine | YES | Where supplied |
| Auction start/end/status | YES | Live source remains authoritative |
| Starting bid | YES | Not reserve |
| Public vehicle photographs | **YES — production requirement** | Only images CarMazium is entitled to syndicate |
| Registration/VRM | YES | Server-side matching; historical raw VRM prohibited |
| Current valid bid | YES | No bidder identity; observation only |
| Broad town/region | YES | No exact address; approved broad location only |
| Direct CarMazium URL/referral URL | YES | No secret in URL |
| Seller/bidder/buyer identity | NO | Prohibited |
| Reserve price | NO | Prohibited |
| VIN | NO | Prohibited unless later signed amendment |
| Private documents / KYC / handover | NO | Prohibited |
| Internal CarMazium valuation | NO | Prohibited |

Live reconciliation target: **2–5 minutes**. Stale threshold: **15 minutes**.

---

# SCHEDULE B — HISTORICAL VEHICLE-EVENT EVIDENCE

## B0. Binding licence and pre-launch safeguard condition
This Schedule B forms a **binding part of this agreement from the Effective Date**. It defines the agreed historical-evidence licence that is required for the complete BuySmart integration and the 90-day pilot.

The parties agree, however, that **no CarMazium-sourced historical event may be captured, retained or matched in production until the following safeguards have been completed and verified as part of the joint production-launch approval**:
- the applicable privacy notice/transparency update is live;
- the lawful-basis assessment for the historical purpose is complete;
- any required DPIA, or a documented DPIA-screening decision concluding that a full DPIA is not required, is complete;
- the protected vehicle-matching design and raw-VRM deletion controls have been verified;
- the relevant production feed fields, retention/deletion controls and historical-field exclusions have passed final acceptance; and
- both parties confirm in writing that the licensed historical functionality is ready to operate from the Pilot Launch Date.

These safeguards are **conditions to production launch, not a later optional activation**. The Pilot Launch Date cannot occur until both the approved live integration and the licensed Schedule B historical capture/matching functionality are ready and confirmed working by both parties.

Once those pre-launch conditions are satisfied and the Pilot Launch Date occurs, SimpleDMS may begin capturing permitted Schedule B evidence from the start of the pilot under the limits in this Schedule. No historical rights apply to observations made before the Pilot Launch Date unless CarMazium later expressly agrees otherwise in writing.

## B1. Purpose
Permitted only for vehicle matching, repeat-appearance research, market analysis, BuySmart vehicle-history evidence, new BuySmart reports while evidence is in term, corrections and agreed aggregate analytics.

## B2. Event retention
**36 months from the vehicle's last permitted CarMazium observation.** Access/use does not restart the clock.

## B3. Historical fields
Permitted:
- CarMazium source attribution;
- non-customer event/auction reference;
- SimpleDMS secret-backed internal matching identifier;
- make/model/variant/year;
- fuel/transmission/body/colour/engine size;
- exact mileage at observation;
- relevant observation/start/end timestamps;
- broad town/region where useful;
- starting bid;
- changed timestamped valid bid observations;
- explicit status supplied by CarMazium.

Not permitted historically:
- raw VRM after operational conversion;
- photographs;
- seller/buyer/bidder identities;
- reserve;
- VIN;
- exact address/location;
- private documents;
- payment data;
- CarMazium internal valuation.

## B4. Bid interpretation
Historical bid values are **observed bid values only** and must not be represented as final bids or sale prices unless CarMazium later supplies a separately licensed confirmed outcome field.

## B5. Reports
An authorised dealer report may remain accessible for **36 months from report generation**, even if an underlying event record expires earlier. Expired source evidence cannot be recycled from the report into new research/reports.

## B6. Termination
These fixed-duration rights survive ordinary pilot expiry/termination for lawfully captured records until their original expiry, but remain subject to law, correction/deletion rights, source-rights issues and material-misuse remedies.

## B7. Historical photographs
**NO.**

---

# SCHEDULE C — APPROVED PROVIDERS AND PROCESSING

## C1 — Vercel

**Provider and purpose:** Vercel Inc., providing application hosting and server-side processing for the agreed integration and BuySmart functionality.

**Reported account observations (16–18 October 2026, SimpleDMS redacted closeout):** The held Preview runtime was observed in **London, UK**, while a separate recovery build ran in the **United States**. The existing Pro account showed **no configured drains** and **Observability Plus unchecked**. These are observations of identified test/account surfaces, **not independent certification of every production runtime or a UK-only processing guarantee**. Provider support, security and control-plane operations may occur elsewhere.

**Processing terms and transfers — pending account-specific evidence:** Applicable Vercel service terms, DPA, contracting entity and any necessary restricted-transfer safeguards and subprocessors must be confirmed by SimpleDMS before signature. Public terms alone do not prove acceptance by its account. Reference: https://vercel.com/legal/dpa

**Logging and retention — distinguish observed from draft:** No configured drain was reported in the inspected Pro account. An earlier draft referred to one-day runtime-log retention; this specific active retention setting, and provider-side metadata/security retention, **still require account-specific confirmation**. The absence of a configured drain does not establish erasure of all provider logs. Reference: https://vercel.com/docs/logs/runtime

For the CarMazium integration, application logging will be restricted to necessary operational and diagnostic information. Raw feed payloads, credentials and excluded source fields will not intentionally be written into application logs. Any application caching remains subject to the agreement's cache, expiry and deletion requirements.

## C2 — Supabase

**Provider and purpose:** Supabase Pte. Ltd., providing the production database and supporting backend services used for the agreed integration and BuySmart.

**Reported account observations (16 October 2026, SimpleDMS redacted closeout):** The SimpleDMS **CarMazium child** was shown in the **London** region; **eight physical database backups** were displayed and **point-in-time recovery was off**. These observations relate to the SimpleDMS child/source environment, **not independent evidence of CarMazium Ltd's own production backup, Storage or restoration readiness**. Provider support, control plane, logs and backups may involve other regions.

**Processing terms and transfers — pending account-specific evidence:** The applicable Supabase service terms, DPA, entity and UK/international transfer arrangements, including subprocessors, require account-level confirmation before signature. A public DPA page alone does not show an individual account's acceptance. References:
- https://supabase.com/legal/customer-resources/data-processing-addendum
- https://supabase.com/legal/customer-resources/subprocessor-list

**Backups and logs:** The public Pro policy is described in the SimpleDMS closeout as providing approximately **seven-day backup/log access**; this is distinct from the eight backups actually displayed on 16 October. **Database backups do not include Storage object bytes**, and the held SimpleDMS source had **no Storage objects**. The separate live production namespace, exact backup coverage, deletion/purge timing, and successful isolated restore must be verified before use. No point-in-time recovery is asserted. References:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/pricing

**Licensed-data retention:** Live data, permitted historical evidence and issued reports remain subject to their separate retention periods in the agreement. Provider backup arrangements do not extend the permitted commercial use of expired evidence.

Where a deleted or expired record remains temporarily in a protected backup, it will remain unavailable for ordinary use and expire through the normal backup cycle. If recovery is necessary, applicable correction, deletion, suppression and event/report expiry controls will be reapplied and verified before the restored data returns to ordinary use. **This covers managed database backup copies only to the extent described above; independent recovery and Storage-object copies require the separate verified record in **C5, C6 and Schedule D**.**

## C3 — OpenAI

**Provider, proposed product and purpose:** OpenAI OpCo, LLC. The prior draft identified the **Responses API** as an optional future server-side explanatory-text pathway for BuySmart. The SimpleDMS 18 October closeout records that the **currently tested CarMazium path makes no OpenAI requests**. The initial proposed production operation uses the existing calculation engine and **deterministic explanation text**; optional AI dispatch stays disabled unless separately approved under this agreement.

**Permitted input scope:** Only the minimum expressly approved, non-identifying information necessary for that explanation may be submitted:
- general vehicle characteristics, such as make, model, age, fuel type and transmission;
- suitably minimised mileage information, using a band where exact mileage is unnecessary;
- non-identifying assessment values, bands, confidence indicators, risk indicators and aggregate observations required to explain the report.

These inputs must not contain sensitive, confidential or proprietary CarMazium source material, or combinations of detail that unnecessarily identify a particular vehicle, person or auction event.

**Excluded information:** Raw vehicle registrations; stable vehicle or auction-event identifiers; internal matching identifiers or secrets; seller, buyer or bidder information; reserves; photographs; raw feed records or API responses; unfiltered source notes; exact locations; unnecessary precise event timestamps; credentials; private files; source code; and proprietary analytical methods are excluded.

No historical dataset, source document, photograph collection, fine-tuning dataset or evaluation dataset will be uploaded to OpenAI as part of this integration.

**Input controls:** Before production use, SimpleDMS will implement and test a server-side allowlist permitting only the agreed fields, together with validation and rejection of excluded content. Raw source records and uncontrolled source text will not be passed directly into explanation requests. Inputs that cannot meet these restrictions will not be submitted.

The analytical calculations and matching methods remain within SimpleDMS; OpenAI receives only the approved information needed to express the explanation.

**Sharing and model improvement — reported account configuration, not a CarMazium dispatch:** SimpleDMS confirms its existing account sharing preference is **enabled and unchanged**, and that the inspected project was set to **Global/Standard Retention**. The tested CarMazium integration has made **no OpenAI requests**. For any later separately approved CarMazium AI sender, optional input/output sharing is **currently enabled** for the relevant OpenAI API usage. Such sharing is **permitted, but not required** by this agreement, solely for the expressly approved minimised inputs and resulting outputs, which may be used by OpenAI for service improvement and model training when sharing is enabled. SimpleDMS may disable that optional sharing without an amendment; this clause does not oblige SimpleDMS to keep it enabled indefinitely. Any material expansion beyond the agreed permitted scope remains subject to sections 11.7, 12.5 and 20.

CarMazium's permission for that sharing is limited to the expressly approved input scope above. It does not authorise submission of any excluded information or wider disclosure of the feed.

**Retention and deletion:** The service is not operated on a zero-data-retention basis. OpenAI's published standard Responses API application-state policy says that when responses are stored by default or with `store=true`, response data is retained for **at least 30 days**, subject to documented exceptions and account settings; **30 days is not a guaranteed deletion date or maximum retention period**. The published standard abuse-monitoring retention is generally up to 30 days, subject to the provider's stated legal, safety and security exceptions. The specific CarMazium project/API pathway, explicit Responses `store` setting, applicable terms, privacy/transfer controls and approved technical field allowlist must be confirmed **before any future AI dispatch**; the reported Global/Standard Retention setting is not a zero-retention or training-opt-out representation. The initial CarMazium route remains non-dispatching. Reference: https://developers.openai.com/api/docs/guides/your-data

Those operational retention periods are separate from the expressly permitted model-improvement use. No fixed deletion deadline is represented for information incorporated into that process, and no guarantee is given that information can be removed from trained model weights.

SimpleDMS will comply with the agreement's deletion and expiry obligations for records within its control and use reasonably available provider-side deletion or suppression mechanisms where applicable. The limited technical boundary in **section 11.9**, read together with **section 7.8**, does not authorise retention, reuse or reconstruction of expired CarMazium source evidence or the submission of excluded inputs.

**Processing terms and transfers:** OpenAI's applicable service terms, data-sharing terms and DPA govern the relevant processing. The DPA includes contractual safeguards for restricted transfers, including the UK Addendum to the Standard Contractual Clauses. Processing may occur outside the UK; no UK-only or European-only processing commitment is made. Reference: https://openai.com/policies/data-processing-addendum/

**Model changes:** SimpleDMS may select, replace or upgrade models within the approved OpenAI service without amending the agreement, provided the permitted purpose, input scope and agreed protections remain unchanged. Any material expansion of data use, sharing, retention or transfer arrangements remains subject to the agreement's applicable notice and approval requirements.

## C4 — Security, confidentiality and contact

These disclosures are limited to information necessary to assess the agreed processing. They do not require disclosure of credentials, account or project identifiers, private endpoints, repositories, source code, detailed system configuration, proprietary prompts, analytical methods or matching secrets.

Each provider will receive only the information needed for its approved role. Any material additional recipient or processing purpose will be addressed under the agreement's change-control requirements.

SimpleDMS's operational contact for provider, security and incident coordination is **Stephen Abel — info@simpledms.co.uk**. Any notification concerning an incident affecting licensed data will follow the agreement's notification requirements.

## C5 — Cloudflare (reported existing recovery components)

**Provider and reported purpose:** SimpleDMS reports using existing **Cloudflare Workers and D1** for encrypted recovery instructions, protected checkpoint coordination and limited encrypted evidence copies. The report describes these as existing resources used on behalf of **SIMPLEDMS LTD**; it does not grant CarMazium access to SimpleDMS's internal systems.

**Reported account observations:** D1 was recorded with **EU jurisdiction**, **read replication disabled** and **seven-day Time Travel**. The existing **encrypted logical evidence copies expire seven days after creation**, separately from any receipt expiry; retrying a copy must not reset that clock. SimpleDMS reports completed key-custody and recovery-copy checks **within the stated test environments**. This is neither an assertion of physical erasure from all provider backups nor a certification of the future production namespace or full disaster recovery.

**Processing and transfer terms still to verify:** Exact Cloudflare entities/service scope, Workers/D1 regions, processor terms, relevant contractual acceptance, access/key custody, any cross-border transfers and independent-backup deletion/purge/recovery controls require account-specific redacted evidence before signature. Source and report expiry clocks remain fixed, and no historical photographs or their URLs may be kept.

## C6 — Independent backup, Storage copies and unverified provider particulars

**Each party's relevant systems and initial-pilot-only variation:** Each party remains responsible for appropriate security and recovery arrangements in its own systems. Before signature and production approval, SimpleDMS will provide a proportionate, redacted account-specific record of its own recovery/backup measures protecting CarMazium-licensed data in its control, including the applicable provider, access restrictions, retention, deletion, restore quarantine, correction and expiry-replay controls. This does not grant either party access to the other's internal systems, private backups, credentials, network diagrams or source code under section 3.4.

**CarMazium managed database evidence and recorded gaps:** CarMazium's owner supplied a Supabase dashboard screenshot on 18 October 2026 showing eight listed physical managed database recovery points dated 11–18 October, latest 18 October 2026 at 03:08 UTC. No isolated production-equivalent restore of CarMazium's own database has been demonstrated; Supabase managed database backups do not include the bytes of Storage objects. No new independent backup of CarMazium's public listing photographs or private documents has been established or represented as complete.

**Limited condition-precedent variation for the initial free 90-calendar-day pilot only:** The parties agree that the following **additional CarMazium-owned engineering programmes are not prerequisites to the Pilot Launch Date for that initial pilot**: (i) creating a new separate/independent backup of CarMazium's own Storage objects or commissioning a separate backup runner; (ii) performing an additional full isolated production-equivalent restoration of CarMazium's database and Storage; and (iii) implementing a broad, platform-wide database-role, public-schema grants, GraphQL/RLS or privileged-function hardening/migration programme. These activities **have not been completed**, and neither party warrants or implies that they have. This exclusion is limited to **the initial 90-day pilot** and is not a perpetual exemption, an automatic renewal term, or a representation of full disaster-recovery readiness.

**Non-waiver and allocation:** CarMazium still must maintain technical and organisational measures appropriate to the live service and law, meet any objectively necessary restricted-partner-feed access and security safeguards, and satisfy data protection, licence, seller/photo-rights and listing-eligibility obligations. SimpleDMS's separate backup, recovery, source correction, historical retention/expiry, deletion and access-control obligations for CarMazium-licensed data in its systems remain unchanged. This adjustment does not transfer work, liability or costs between the parties, create a new commercial fee, or waive applicable law. Any later arrangement after the initial pilot must be separately agreed in writing under section 20.

**No extension of licensed data rights:** Neither provider-managed nor independent backups or Storage copies extend the live-cache deadline or the original Schedule B event/report expiry clocks. They do not create a right to retain historical vehicle photographs. Any restored copy must remain unavailable to ordinary users, reports, analysis, matching and collectors until applicable source corrections, erasure, suppression and event/report expiry have been reapplied and independently checked. Expired CarMazium evidence may not be reconstructed from a report, backup or cache.

**Verification outstanding:** The reported Vercel/Supabase/Cloudflare settings above have **dated and limited scope**. Account contracting entities, accepted DPAs/transfer terms, material logging/purge settings, the actual SimpleDMS production namespace, licensed live/historical datasets and SimpleDMS-controlled recovery protections, the optional OpenAI future pathway/`store`/sharing controls and **any further vehicle-data recipient** still require the responsible party's redacted confirmation under sections 12.3–12.5. As recorded above, CarMazium's separate new Storage backups, broad platform-hardening programme and full isolated recovery drill are not initial-pilot launch prerequisites, but remain expressly **uncompleted**. Neither draft/provider statements nor that narrow exception constitute approval of live data sharing.

## C7 — Proposed DVLA/DVSA, Autotrader and licensed-catalogue recipients (NOT YET AUTHORISED)

The SimpleDMS **disabled preparation path** can make proposed **DVLA/DVSA** requests using registration, **Autotrader** requests using registration, mileage and tenant-bound access, and separately licensed auction-catalogue research. These are **proposed downstream recipients/processors for separately authorised vehicle-check/valuation operations**, **not accepted or tested live external-provider calls for this CarMazium integration**. Additional identity-provider enrichment is expressly excluded from the CarMazium route.

Before any such data sharing, SimpleDMS must provide a provider-by-provider scope covering entitlement and contract/licence terms, controller/processor roles, registration/mileage necessity, permitted use and onward disclosure, operational cache/log retention and deletion, transfer safeguards and minimum-field allowlists; CarMazium must approve any required downstream disclosure and lawful basis through the section 20 process. In particular, section **3.5's restriction on sublicensing Autotrader-derived data to CarMazium** is unchanged. A **24-hour live source-cache ceiling does not imply that independent third-party provider logs are purged within 24 hours**.

## C8 — Distinct evidence, analysis and live-data expiry (INITIAL OPERATING CHOICE SUBJECT TO APPROVAL)

**Source evidence** remains licensed for up to **36 UTC calendar months from the last permitted observation**, and each **issued CarMazium evidence report** retains its original separate **36-month expiry from issue**; no read, retry, report or restore renews those clocks. Observed mileage and time-stamped changed bids are distinct from third-party valuations and unverified sale outcomes. **Independent BuySmart real-provider analysis** is proposed to follow SimpleDMS's existing **seven-day ordinary-report policy**; after analysis expires, the permitted CarMazium issued evidence report may reopen as **originally issued labelled evidence only**, without a recreated analysis score/enrichment. This operating model is not approved merely by this drafting and requires both parties' recorded privacy/product acceptance.

**Live and photographs:** Live display hides at 15 minutes' successful-snapshot age; raw live-cache cleanup has a 24-hour ceiling. Photographs, photograph URLs and pending-report image inputs remain excluded from historical evidence and frozen reports. Public approved photographs can be fetched **only through the authenticated current-live flow** with safe bounded image decoding and no-store responses, as actually tested in production.

**Recovery:** The SimpleDMS closeout reports seven-day expiry for existing encrypted logical copies, separately from receipt expiry. Source corrections, suppressions, deletions, backup quarantine and original event/report expiry must be reapplied before recovery content is released. These checks were accepted only in the stated test environments; SimpleDMS's **new production namespace and controls remain to be accepted**, while CarMazium's independent Storage backup and full isolated recovery drill remain **uncompleted but are not initial-pilot prerequisites** under C6.

## C9 — Final sign-off record / remaining factual and processing decisions (OPEN)

- [ ] SimpleDMS verifies all **account-level** provider terms, contracting/processing entities, accepted DPA/transfer arrangements and access/purge/region/log facts for Vercel, Supabase, Cloudflare and optional OpenAI, using redacted proof.
- [ ] The parties approve or expressly exclude the proposed **DVLA/DVSA, Autotrader and licensed-catalogue** provider recipients, their lawful bases, data inputs, entitlements, onward use and retention.
- [ ] Both parties complete their **lawful-basis assessment and any required DPIA screening**; SimpleDMS approves and publishes its prepared dealer transparency notice. Seller acknowledgement is not, by itself, SimpleDMS's lawful basis.
- [ ] CarMazium approves the **separate seven-day BuySmart analysis vs 36-month fixed CarMazium evidence** handling and tests that expired analysis is never regenerated from expired evidence.
- [ ] CarMazium verifies published website and all actively used native-channel seller notices, the **recorded per-listing acknowledgement within its existing consolidated listing declaration for future listings** (not a new separate marketing-consent checkbox), legacy-record exclusion, public-photo syndication rights and reliable withdrawal/removal, **without bulk backfilling historical sellers**. A completed publication declaration is evidence of notice/contractual permission, not automatic UK GDPR consent to every separate processing purpose.
- [ ] For the **initial free 90-day pilot only**, record CarMazium's existing physical managed database recovery-point evidence and open Storage/restore/security gaps accurately; do **not** require CarMazium to commission additional independent Storage backups, a full isolated production-equivalent restore or broad platform-wide database hardening before that pilot. These deferred works remain uncompleted. **SimpleDMS must separately verify** its own relevant recovery, correction/expiry replay, source-licence protection, access controls and proportionate redacted acceptance evidence for data held under its control. Both parties retain appropriate security and legal obligations specific to the restricted live/historical integration.
- [ ] Approved production API host, permitted registration/current-bid/region/photo fields and authorised photo delivery, referral and aggregate-reporting configuration are recorded. **No production secret is emailed or committed**; use a separately approved restricted secret handover only after prerequisites.
- [ ] Both parties' authorised signatories and qualified legal/data-protection advisers approve one final signed version. The production key, accepted live **and** historical use, controlled acceptance window, bilateral written go-live and **Pilot Launch Date** remain subsequent separate decisions.

---

# SCHEDULE D — TECHNICAL ACCEPTANCE

Before production launch:
- dedicated synthetic staging credential and separate production credential;
- missing/wrong/revoked key denied;
- authenticated pagination verified;
- full-feed reconciliation and removal verified;
- 2–5 minute sync and 15-minute stale handling verified;
- approved image URLs load reliably and private images do not leak; production vehicle photographs are limited to images with confirmed public-display and partner-syndication rights under section 6 and Schedule A, with withdrawal/takedown controls;
- registration, current bid and broad location field controls verified;
- CarMazium source/deep links verified;
- from the **Pilot Launch Date**, the agreed SimpleDMS referral marker and attribution flows accepted: SimpleDMS's reasonably available aggregate auction impressions, individual vehicle views, BuySmart reports and outbound clicks; and CarMazium's reasonably and lawfully attributable aggregate dealer registrations, qualified bids and handover-approved completed purchases, strictly under section 14 and its attribution limitations, without unnecessary person-level data exchange;
- no seller/bidder/reserve/private fields in feed;
- key rotation/revocation rehearsed;
- monthly metric definitions agreed;
- production photographs/rights confirmed;
- approved website and actively used native Terms, Privacy Policy and seller partner-distribution disclosures **published**; for **new listings**, the seller's **existing combined listing declaration** may provide the required recorded **per-listing acknowledgement**, without requiring a second consent checkbox, if its current partner-distribution text and privacy links were actually presented, accepted and timestamped. This contractual acknowledgement is **not automatically UK GDPR consent** for independent historical matching or downstream processing. The server continues **fail-closed exclusion** for unacknowledged listings, including all legacy rows, unless both parties separately approve a legally supported alternative eligibility pathway after purpose-compatibility assessment, appropriate prior transparency and effective objections/withdrawals. No blanket backfill, presumed acknowledgement, retrospective consent or premature sharing; obtain separate consent wherever legally required;
- privacy notice/lawful-basis treatment for attribution and historical matching completed;
- any required DPIA or documented DPIA-screening decision completed;
- protected matching design and raw-VRM deletion controls verified;
- historical-field exclusions, 36-month event and distinct report clocks, correction/deletion and expiry controls verified;
- for the **initial free 90-day pilot**, CarMazium's **existing managed database recovery-point evidence**, including the express limits on Storage-file recovery, is recorded; **new CarMazium-owned independent Storage backups, a full isolated production-equivalent CarMazium database/Storage restore exercise and broad platform-wide database hardening are not launch conditions and remain uncompleted** under C6. Separately, SimpleDMS must provide redacted evidence of appropriately access-controlled, durable protection and its required backup/recovery, expiry/correction/deletion safeguards for the CarMazium-licensed data under its own control, including restoration/replay safeguards relevant to live and 36-month historical records. Neither party gains access to the other's private systems, backups, source code or credentials;
- where SimpleDMS restores data containing CarMazium-licensed observations (whether from managed or independent backups), those copies remain quarantined from ordinary readers, reports, matching, analysis and collectors until applicable CarMazium source corrections, suppression, erasure and **original** event/report expiry controls have been reapplied and verified. No deleted/expired historical record, historical photograph or photograph URL may be reintroduced; CarMazium remains responsible for legally appropriate handling of any restored data in its own systems;
- **integration-specific** production security acceptance recorded, including a fail-closed partner API, restricted feed role and allowed fields, three default-off release gates, credential isolation/revocation, approved photo rights, current-live listing eligibility and controlled rollback/failure procedures. The deferred **CarMazium platform-wide** database/GraphQL/RLS/role migration and additional full isolated restoration are not prerequisites for **the initial free 90-day pilot**, without waiving applicable security/data-protection law or any protection objectively necessary for the specific licensed partner feed;
- Schedule C **C1–C9** provider/recipient facts and proposed operating choices completed, separately approved and account-specific statements confirmed; no approval or credential can be inferred from a draft clause;
- an agreed **restricted credential handover channel** (for example a mutually authorised secret-manager reference or encrypted one-time vault transfer with access controls, expiry, audit and revocation), **never plaintext email or repository**, approved only after all preceding gates; the separate production credential is not issued by signing alone;
- a single controlled and mutually scheduled **production acceptance window**, including authorised live feed and matching, provider response handling, desktop/mobile-browser use, current-live photos, saved evidence/report reopen, referral/aggregate attribution and revoked/incorrect-key behaviour, with defects corrected before launch;
- both the approved live integration and licensed Schedule B historical functionality confirmed ready;
- both parties provide written production go-live approval.

---

# SIGNATURES

### CARMAZIUM LTD
Company number: 17053307  
Registered office: 181 Hunters Road, Birmingham, United Kingdom, B19 1ES  
Authorised signatory: Afaq Iftikhar, Director  

Signature: ______________________________  
Date: __________________________________  

Technical/security contact: info@carmazium.com

### SIMPLEDMS LTD
Company number: 17167272  
Registered office: Brightfield Business Hub, Bakewell Road, Orton Southgate, Peterborough, Cambridgeshire, England, PE2 6XU  
Authorised signatory: Patricia Jean Abel, Director  

Signature: ______________________________  
Date: __________________________________  

Technical/security contact: Stephen Abel — info@simpledms.co.uk

---

**Legal-review note — fixed execution-review signing copy, version 24 October 2026, Revision 3 (UNSIGNED):** This document consolidates the negotiated technical and data terms, the 18 October redacted SimpleDMS closeout observations and Stephen's 24 October **agreement in principle only** to an initial-pilot-specific scope adjustment. **Supplier statements, locally tested software and proposed operating choices are labelled separately from independently approved facts.** Complete the open Schedule C account-specific and privacy decisions and obtain qualified legal/data-protection review and both parties' final approval before signature. Nothing in this unsigned copy authorises production data sharing, credential issue, launch, or the start of the free 90-day pilot.
