# CARMAZIUM LTD / SIMPLEDMS LTD
# CONDITIONAL INTEGRATION AND DATA LICENCE — SIGNATURE CANDIDATE
**Version 1.0, 3 October 2026. FOR COUNSEL AND BOTH PARTIES' WRITTEN APPROVAL ONLY. NOT YET SIGNED, EFFECTIVE OR AN INSTRUCTION TO ISSUE AN API KEY.**

## Contract particulars and verification before signature

**CarMazium:** CARMAZIUM LTD, company number 17053307, incorporated in England and Wales; registered office 181 Hunters Road, Birmingham, United Kingdom, B19 1ES. The GOV.UK Companies House indexed register identifies Afaq Iftikhar as director; both details must be rechecked on the signing date. CarMazium signatory: Afaq Iftikhar, Director, subject to final authorisation.

**SimpleDMS:** SIMPLEDMS LTD, number 17167272 (as supplied by Stephen Abel in email on 3 October 2026). Stephen has supplied the office "Brightfield Business Hub, Bakewell Road, Orton Southgate, Peterborough, Cambridgeshire, England, PE2 6XU" and Patricia Jean Abel as proposed Director/signatory. **UNRESOLVED:** third-party historic company listings show *other* addresses, and the current official Companies House record could not independently be retrieved; therefore obtain a **current official company profile** and verify the registered office and director before either party signs. Do not enter the proposed address as independently verified.

**Contract and pilot effective dates:** Agreement effective only on the date of the last signature, after all attached schedules are completed; 90-day free pilot commences only once both parties confirm the *working production BuySmart integration* in writing, with exact UTC launch timestamp. A signing date, preliminary synthetic staging test or key issue alone DOES NOT start the pilot.

## 1. Commercial structure

1. SimpleDMS waives the proposed £5,000 integration/launch fee for the initial integration. The initial integration and 90-day pilot are free to CarMazium, non-exclusive, with no automatic renewal, minimum inventory, licence subscription, fees, referrals/purchase commission or other future financial obligation.
2. Any paid continuation, expanded use or ongoing integration after the pilot requires a fresh affirmative written agreement signed by both parties. No party may incur a charge on the other's behalf without its prior written consent.
3. Each party retains its pre-existing source data, know-how, code, technology and independently developed methods. This clause does not broaden any licence for identifiable CarMazium-sourced events incorporated into BuySmart reports.
4. Either party may end the pilot on seven calendar days' written notice, or immediately for a substantiated material breach, security compromise, privacy/legal requirement or threatened unlawful processing. API-key suspension is an immediate protective measure, not an acknowledgement of breach or liability.
5. No guaranteed number of dealers, reports, qualified leads, auctions or completed sales is promised. Costs of ordinary integration/operation are borne by each party independently.

## 2. Live API licence — Schedule A governs exact fields

CarMazium grants a limited, non-exclusive, non-transferable, revocable licence during the pilot to access ONLY the dedicated, authenticated, read-only partner-auction feed. Use is confined to BuySmart server-side display of authorised *currently live* auctions, permitted vehicle analysis, lawful vehicle matching, mutually approved aggregate metrics and directing interested dealers to CarMazium. No user/admin/session/payment API rights are granted. All registration, dealer verification, bidding, payments, seller contact, transaction decisions and handover remain CarMazium-controlled.

**Forbidden**: reserve/internal valuation, VIN, bidder identity, seller address/contact, buyer/dealer identity, KYC, handover documents, private signed files, precise GPS coordinates, private sale price, full CarMazium archive, scraping other endpoints, unrestricted onward transfer, data resale/syndication, unrelated advertising profiling or model-training corpora. Only explicitly enabled Schedule A fields and separately signed Schedule B historical rights apply.

The API may temporarily withhold fields or inventory for valid security, seller-media rights or legal reasons. The partner cannot infer missing reserve, achieved sale price or a successful transaction from bid observations or disappearing auctions.

## 3. Live feed integrity and caching

1. Target complete paginated synchronisation every **2–5 minutes** (initial limits: default page size 25, maximum 50, at most 60 requests/minute/IP, subject to load testing). A complete page-set is required before replacing the prior snapshot. Use canonical CarMazium auction IDs and each record's expiry/status.
2. On a successfully completed snapshot, remove missing, ended, sold, cancelled, withdrawn or unavailable records from *live dealer-facing discovery* promptly. Do not confuse a pending/failed refresh with an empty authorised feed. When a record is not confirmed fresh within **15 minutes**, hide it or clearly make it unavailable for bidding and remove stale prices from dealer decisions. Fetch the original CarMazium page before referral.
3. Temporary raw active-auction cache and approved live photographs may be stored only in named, access-controlled SimpleDMS infrastructure for the active period. A non-public reconciliation buffer of **at most 24 hours** after disappearance may be kept for deletion/audit, NOT shown to dealers and NOT treated as Schedule B history. Source images are public *only if CarMazium has verified the seller syndication licence*.
4. On termination/expiry: immediately revoke keys, stop ingesting, remove live dealer-facing inventory and delete raw live cache/VRMs/images within **7 calendar days**. Provide written deletion confirmation, with separately inventoried/isolated encrypted backup residues expiring on agreed Schedule C dates and no operational access. Historical exceptions apply only if a separate Schedule B is affirmatively signed; no implied rights from report ownership.

## 4. Security, privacy, reporting and liability

Each company must comply with applicable UK GDPR, Data Protection Act 2018 and other relevant laws, document a lawful basis for each field/purpose, and confirm the **actual** controller/processor roles *by activity*. Complete the Article 28 processor terms or independent-controller sharing arrangement in Schedule C as legally applicable **before processing any live personal data**. A VIN/VRM or stable matching fingerprint that can identify a person, directly or indirectly, must be treated as potentially personal even when pseudonymised. Do not promise that hashing makes a UK VRM anonymous.

SimpleDMS must encrypt approved personal data at rest/in transit, use named least-privilege operators, log access without raw API keys or entire vehicle records, protect keys server-side and never put partner secrets in browsers, mobile apps, GitHub, analytics or customer-visible reports. Parties provide 24-hour incident escalation where practicable and cooperate on statutory notification/erasure and data-subject rights. Liability/indemnity/contractual notice sections need documented legal review before signature; a missing schedule is not deemed accepted.

SimpleDMS supplies monthly **aggregate** impressions, distinct vehicle views, BuySmart report counts and outbound referral clicks with metric definitions. CarMazium may provide only verified **aggregate** attributed registrations, valid bids and handover-approved sales when tracking is lawful and tested. No named dealer/seller details, direct identifiers, payment data or source-private attribution events are shared. Neither side claims attribution proves causation.

## 5. Schedule A — release-controlled partner fields

| Field/category | Contract position | Enablement |
|---|---|---|
| Active auction ID, listing ID, make/model/variant/year, mileage, basic specifications, starting bid, UTC start/end, source URL | Included for *approved live auctions only* | Enabled only after production technical sign-off |
| Approved published vehicle photos | Conditional on documented seller syndication rights and externally validated stable public HTTPS URL | [ ] BOTH PARTIES APPROVE; otherwise OFF |
| VRM | Live matching/analysis only; delete when no longer live outside the 24-hour non-public operational buffer | [ ] BOTH PARTIES APPROVE; otherwise OFF |
| Current valid bid | Current timestamped auction observation only; no reserve, bidder identity or implied achieved price | [ ] BOTH PARTIES APPROVE; otherwise OFF |
| Town/region | Exact allowlisted broad town only; never seller address, precise location or full postcode | [ ] BOTH PARTIES APPROVE; otherwise OFF |
| Synthetic signed referral / first-party tracking | Only after CarMazium lawful-basis, disclosure and technical consent/PECR review | [ ] BOTH PARTIES APPROVE; otherwise OFF |
| Historical event fields | **NEVER granted by this Schedule A** | See separately executed Schedule B |

The signed field matrix, public-photo provenance and API version must be attached and initialled by both parties. A technical flag being present does NOT authorise any optional field.

## 6. Schedule B — OPTIONAL limited historical vehicle evidence (requires *separate* signatures)

This is a **proposed compromise for review, not an agreed licence**. No historical database may be populated by default. If and only if separately executed, SimpleDMS may retain *the specific ticked fields below* from auction observations lawfully obtained during the agreed pilot, solely to support genuine existing BuySmart historical vehicle research, repeat-appearance evidence and already issued dealer reports. No new CarMazium feed ingest or new live inventory use follows pilot termination absent fresh agreement.

### B1. Explicit event field permissions (tick, no tick means prohibited)
- [ ] CarMazium attribution; original auction/event reference **held internally only** for audit and correction
- [ ] Make/model/variant/model year, fuel/transmission/body style and broadly banded mileage
- [ ] Auction start/end date at [ ] exact UTC [ ] calendar day [ ] month (select least specific necessary)
- [ ] Approved broad town/region (no private address, GPS or postcode)
- [ ] One timestamped *observed valid current bid* only if visible within the authorised live feed; **NOT final sale price, sold status or predicted value**
- [ ] Source-provided explicit status at time of observation (must not infer completion from disappearance)
- [ ] Partner-created stable internal vehicle token enabling repeat appearance, subject to B2 technical/privacy controls
- [ ] First/last seen timestamps and approved minimal matching specification

**Always prohibited**: raw VRM retained in the historical table, unkeyed SHA-256/MD5 VRM hashes or reversible token printed in dealer reports, full archived listing text, photos after delisting, hidden reserve, seller/bidder identities, KYC/handover, precise location, VIN, internal valuations and onward raw-record resale.

### B2. Conditional matching and privacy

Only if the separately signed tick permits matching: SimpleDMS must independently assess whether vehicle matching can be achieved by a **random internal token with strictly segregated lookup**, instead of a deterministic raw-VRM hash. If a deterministic pseudonym is necessary, require keyed HMAC-SHA256 (unique non-exportable key, KMS/HSM or equivalent secret store), separately protected mappings and documented rotation/rekey/erasure; a matching token is still potentially personal data. No raw VRM, secret pepper, lookup table or persistent source event can be sent to optional AI processors. Record the applicable lawful basis, balancing assessment where applicable, retention trigger, deletion procedure and re-identification controls in signed Schedule C. An approved technical design and data protection review are **preconditions** to activating B2.

### B3. Proposed ceiling and end-of-pilot operation — NOT accepted unless signed

Proposed maximum retention of *approved minimal vehicle-event records*: **up to 36 months from the last permitted CarMazium observation**, whichever is shorter under any erasure/legal duty. Already issued BuySmart reports containing licensed event evidence may remain accessible only to their originally authorised dealer for **up to 36 months from creation**. Both ceilings are maximums, not default indefinite storage or automatic renewals. End-of-pilot or termination ends all **new collection**; continuing report access or creating new reports using retained event data is expressly [ ] permitted solely within these B3 limits [ ] prohibited after termination (select ONE before signature). If neither selected, **prohibited**. Any revised retention/continued use requires new written authorisation. Delete source events at expiry and delete or irreversibly redact linked reports where required by lawful erasure/correction or material inaccuracy.

CarMazium must be able to request correction/withdrawal of a disputed historical event and inspect documented deletion evidence under commercially reasonable safeguards. Derived analytics that remain reconstructibly tied to a source auction, token or small vehicle cohort are not "anonymous" and remain licensed data. Truly anonymised aggregate trends may be kept only after documented non-reidentification evaluation. No CarMazium event images may be retained after delisting without separately signed media rights.

### B4. Separate Schedule B execution

CarMazium: approved B1 fields [________]; B2 matching design/dpia reference [________]; B3 selected ongoing use [________]; maximum event/report retention [________]. Signed by authorised director: [________] / date [________].

SimpleDMS: approved same B1 fields [________]; B2 security and assessment [________]; B3 selected ongoing use [________]; retention [________]. Signed by authorised director: [________] / date [________].

**If any required selection/signature is blank, Schedule B is inactive and no historical licence exists.**

## 7. Schedule C — vendors, data roles, transfer controls and exit proof (complete before key issue)

| Partner provider or activity | Declared intended use | Required evidence; DEFAULT BLOCK until filled |
|---|---|---|
| Vercel | BuySmart web/server-side hosting | Actual hosting/compute/logging regions [___], vendor contract/DPA [___], access/log limits [___], authorised subprocessors/transfers [___] |
| Supabase | BuySmart database, Storage/cache | Actual project **hosting and backup region** [___], encryption/RLS/access [___], DPA [___], backups/recovery deletion [___], transfer safeguards [___] |
| OpenAI | Optional minimal natural-language explanation only | **OFF BY DEFAULT**; separate exact endpoint, provider DPA, retention/settings, configured regions/transfers and AI input field schedule must be signed. Never submit VRM, stable match tokens, sellers/bidders or full raw feed; no source-model training. |
| SimpleDMS legal role per purpose | Live dealer marketplace vs vehicle history and reports vs aggregate metrics | Controller/independent-controller/processor [___ by activity], lawful basis [___], relevant Article 28 or data-sharing terms [___], security contact [___], deletion & data-subject request channel [___] |

Record exact named SimpleDMS vendors/subprocessors, configuration evidence and any onward transfer outside UK/adequacy region. Material new AI use or an additional data recipient requires prior written approval where appropriate. Incidents affecting CarMazium records: initial notice within 24 hours where practicable, factual follow-up, immediate containment and preservation of lawful evidence. No personal data leaves CarMazium on the strength of a blank Schedule C.

## 8. Joint pre-production conditions and operational release

NO real production feed, raw partner API key or optional fields until:
1. Both companies' Companies House details and signatory authority are current; all signed schedules and lawful-basis/media rights are obtained.
2. Exact-commit synthetic HTTPS authenticated/stale/pagination/invalid-key/image/privacy tests pass; issue a separate temporary test credential through an approved encrypted channel; test external SimpleDMS integration and securely revoke test keys.
3. Independent *actual* production database backup restoration is proven on isolated non-production infrastructure. Managed database backup display alone is insufficient. Independently export all seven actual private/public Supabase Storage buckets to an authorised offsite versioned encrypted vault and prove object-level restoration of private evidence, with correct retention/access.
4. The live public schema permission/definer/function security cutover is validated on production-equivalent staging and approved as a controlled change; no production migrations from this legal package. Monitor the staged real auction journey and availability after release.
5. Both parties sign a joint production launch acceptance note recording the UTC start, agreed API version/fields, owner/security on-call contact, reversal/key-revocation procedure and 90-day expiry date.

A purely synthetic staging URL, public API contract or signed contract **does not automatically permit** release of live auction credentials. Any failure requires hold/rollback.

## 9. Notice, governing law and signatures

Unless counsel amends: England and Wales law and courts. Security incident escalation channel: CarMazium [________]; SimpleDMS Stephen Abel, info@simpledms.co.uk (confirm alternate on-call). Contractual notice email: CarMazium info@carmazium.com; SimpleDMS info@simpledms.co.uk (verify both authorised). Any contractual limitation of liability, negligence/privacy exceptions and indemnities must be reviewed and expressly inserted by both companies' counsel; a blank clause means **NO deemed allocation or signed contract**.

CarMazium: CARMAZIUM LTD / 17053307. Authorised signer Afaq Iftikhar, Director (subject to current check). Signature [________]. Date [________].

SimpleDMS: SIMPLEDMS LTD / 17167272. **Current verified registered office [________].** Verified authorised signer [________]. Signature [________]. Date [________].

Schedule A selections and Schedule C evidence attached and initialled: CarMazium [__] / SimpleDMS [__]. Schedule B executed separately? YES [ ] / NO [ ] (NO by default).

**This candidate records negotiated proposals, including the 36-month idea from Stephen's email dated 3 October; it is not proof Afaq accepted that proposal.** Obtain counsel and both parties' affirmative signatures before any historical rights or production activation.
