# CARMAZIUM × SIMPLEDMS — CONSOLIDATED EARLY-LAUNCH INTEGRATION, LIVE-FEED AND HISTORICAL-EVIDENCE LICENCE
**Consolidated counter-draft for signature — revised 9 October 2026. Not effective until signed by both parties.**

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

4.1 During the licence period CarMazium grants SimpleDMS a non-exclusive, non-transferable, revocable licence to access the dedicated partner API solely for:
- live BuySmart auction discovery;
- vehicle matching and BuySmart analysis;
- dealer-facing research/reporting;
- outbound dealer referral to CarMazium;
- agreed aggregate partnership reporting.

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

12.5 Any account-specific item genuinely unavailable at draft stage may be marked **"to be confirmed before signature"**, but the material field must be completed before production permission.

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

**Primary runtime location:** London, United Kingdom. This describes the primary production application runtime. Supporting services, including network delivery, security, support and account administration, may involve processing outside the UK.

**Processing terms and transfers:** Vercel's applicable service terms and Data Processing Addendum govern its processing, including contractual safeguards for restricted international transfers. Relevant subprocessors are those disclosed through Vercel's published subprocessor information. These arrangements do not constitute a blanket UK-only processing commitment. Reference: https://vercel.com/legal/dpa

**Logging and retention:** The current service configuration provides a one-day runtime-log retention window. No external Vercel log drain is configured. This runtime-log period is separate from provider-controlled security, account and service metadata retained under Vercel's applicable policies. Reference: https://vercel.com/docs/logs/runtime

For the CarMazium integration, application logging will be restricted to necessary operational and diagnostic information. Raw feed payloads, credentials and excluded source fields will not intentionally be written into application logs. Any application caching remains subject to the agreement's cache, expiry and deletion requirements.

## C2 — Supabase

**Provider and purpose:** Supabase Pte. Ltd., providing the production database and supporting backend services used for the agreed integration and BuySmart.

**Primary production location:** London, United Kingdom. This describes the production project's primary region. Provider support, account administration, logging infrastructure and other supporting services may involve processing outside that region.

**Processing terms and transfers:** Supabase's applicable service terms and Data Processing Addendum govern its processing, including Standard Contractual Clauses and applicable UK transfer provisions. Relevant subprocessors are those disclosed through Supabase's published list. References:
- https://supabase.com/legal/customer-resources/data-processing-addendum
- https://supabase.com/legal/customer-resources/subprocessor-list

**Backups and logs:** SimpleDMS states that its current configuration uses daily database backups with a seven-day recovery window; point-in-time recovery is not enabled. The current plan provides seven-day operational-log retention. Database backups do not include the contents of separately stored Storage objects. References:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/pricing

**Licensed-data retention:** Live data, permitted historical evidence and issued reports remain subject to their separate retention periods in the agreement. Provider backup arrangements do not extend the permitted commercial use of expired evidence.

Where a deleted or expired record remains temporarily in a protected backup, it will remain unavailable for ordinary use and expire through the normal backup cycle. If recovery is necessary, applicable deletion and expiry controls will be reapplied before the restored data returns to ordinary use.

## C3 — OpenAI

**Provider, product and purpose:** OpenAI OpCo, LLC, using the OpenAI Responses API through server-side requests to generate explanatory text for BuySmart reports from the narrowly permitted inputs described below.

**Permitted input scope:** Only the minimum expressly approved, non-identifying information necessary for that explanation may be submitted:
- general vehicle characteristics, such as make, model, age, fuel type and transmission;
- suitably minimised mileage information, using a band where exact mileage is unnecessary;
- non-identifying assessment values, bands, confidence indicators, risk indicators and aggregate observations required to explain the report.

These inputs must not contain sensitive, confidential or proprietary CarMazium source material, or combinations of detail that unnecessarily identify a particular vehicle, person or auction event.

**Excluded information:** Raw vehicle registrations; stable vehicle or auction-event identifiers; internal matching identifiers or secrets; seller, buyer or bidder information; reserves; photographs; raw feed records or API responses; unfiltered source notes; exact locations; unnecessary precise event timestamps; credentials; private files; source code; and proprietary analytical methods are excluded.

No historical dataset, source document, photograph collection, fine-tuning dataset or evaluation dataset will be uploaded to OpenAI as part of this integration.

**Input controls:** Before production use, SimpleDMS will implement and test a server-side allowlist permitting only the agreed fields, together with validation and rejection of excluded content. Raw source records and uncontrolled source text will not be passed directly into explanation requests. Inputs that cannot meet these restrictions will not be submitted.

The analytical calculations and matching methods remain within SimpleDMS; OpenAI receives only the approved information needed to express the explanation.

**Sharing and model improvement:** SimpleDMS states that input/output sharing is enabled for the relevant OpenAI API usage and will remain enabled. Accordingly, the permitted inputs and resulting outputs may be used by OpenAI for service improvement and model training.

CarMazium's permission for that sharing is limited to the expressly approved input scope above. It does not authorise submission of any excluded information or wider disclosure of the feed.

**Retention and deletion:** The service is not operated on a zero-data-retention basis. SimpleDMS states that OpenAI's published standard Responses API application-state retention is 30 days under the standard stored-response configuration, and abuse-monitoring logs may be retained for up to 30 days subject to the provider's stated legal and security exceptions. Reference: https://developers.openai.com/api/docs/guides/your-data

Those operational retention periods are separate from the expressly permitted model-improvement use. No fixed deletion deadline is represented for information incorporated into that process, and no guarantee is given that information can be removed from trained model weights.

SimpleDMS will comply with the agreement's deletion and expiry obligations for records within its control and use reasonably available provider deletion mechanisms where applicable, consistently with the provider-deletion boundary in section 11.

**Processing terms and transfers:** OpenAI's applicable service terms, data-sharing terms and DPA govern the relevant processing. The DPA includes contractual safeguards for restricted transfers, including the UK Addendum to the Standard Contractual Clauses. Processing may occur outside the UK; no UK-only or European-only processing commitment is made. Reference: https://openai.com/policies/data-processing-addendum/

**Model changes:** SimpleDMS may select, replace or upgrade models within the approved OpenAI service without amending the agreement, provided the permitted purpose, input scope and agreed protections remain unchanged. Any material expansion of data use, sharing, retention or transfer arrangements remains subject to the agreement's applicable notice and approval requirements.

## C4 — Security, confidentiality and contact

These disclosures are limited to information necessary to assess the agreed processing. They do not require disclosure of credentials, account or project identifiers, private endpoints, repositories, source code, detailed system configuration, proprietary prompts, analytical methods or matching secrets.

Each provider will receive only the information needed for its approved role. Any material additional recipient or processing purpose will be addressed under the agreement's change-control requirements.

SimpleDMS's operational contact for provider, security and incident coordination is **Stephen Abel — info@simpledms.co.uk**. Any notification concerning an incident affecting licensed data will follow the agreement's notification requirements.
---

# SCHEDULE D — TECHNICAL ACCEPTANCE

Before production launch:
- dedicated synthetic staging credential and separate production credential;
- missing/wrong/revoked key denied;
- authenticated pagination verified;
- full-feed reconciliation and removal verified;
- 2–5 minute sync and 15-minute stale handling verified;
- approved image URLs load reliably and private images do not leak;
- registration, current bid and broad location field controls verified;
- CarMazium source/deep links verified;
- no seller/bidder/reserve/private fields in feed;
- key rotation/revocation rehearsed;
- monthly metric definitions agreed;
- production photographs/rights confirmed;
- privacy notice/lawful-basis treatment for attribution and historical matching completed;
- any required DPIA or documented DPIA-screening decision completed;
- protected matching design and raw-VRM deletion controls verified;
- historical-field exclusions, 36-month event clock and deletion/expiry controls verified;
- Schedule C provider items completed;
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

**Legal-review note:** This is a commercial counter-draft intended to consolidate the parties' negotiated technical and data terms. Both parties should have the final text reviewed by qualified legal/data-protection advisers before signature.
