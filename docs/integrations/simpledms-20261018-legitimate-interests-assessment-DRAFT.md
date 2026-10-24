# CarMazium × SimpleDMS — seller listing distribution and historical research: LEGAL REVIEW DRAFT

**Prepared:** 18 October 2026  \
**Status:** Open legal/data-protection assessment; **not a concluded LIA, DPIA, consent record or production release authorisation**.  \
**Applies to:** CarMazium Ltd controller decisions for vehicle advertising and potential disclosure to SimpleDMS Ltd/BuySmart. SimpleDMS must independently record its own controller/processor role, purpose, lawful basis and notices.  \
**Scope:** No paid work, customer notifications, historic backfill, policy publication, live data sharing or production credentials are authorised by this draft.


## 24 October 2026 — current CarMazium owner and technical evidence (supersedes outdated 18 October status statements)

**Owner-approved commercial and operating scope, not a legal sign-off.** The director accepted the restricted live dealer-research service, the distinct maximum 36-month protected historical vehicle-event/report licence, SimpleDMS's independent seven-day BuySmart analysis retention, and dealer-requested DVLA/DVSA, licensed AutoTrader and licensed auction-catalogue checks under the exact excluded-field and entitlement constraints in the unsigned Revision 4 signing copy. The initial CarMazium OpenAI data sender remains disabled. **Any actual third-party vehicle-data disclosure still requires provider-by-provider licence, lawful basis, necessity, transfers and retention verification.** No automatic new fees or provider subscriptions have been approved.

**Current read-only production snapshot (24 October 2026):** \`public.listings\` had **709 records, of which 42 have a non-NULL recorded partner-distribution acknowledgement and 667 are unacknowledged/legacy**. The 42 timestamps are eligibility evidence, **not proof** of valid photo source copyright, a legally sufficient Article 6 basis, an active auction right now, a published seller notice at the specific time of listing, or entitlement to historical reuse. Continue fail-closed omission of the 667 unacknowledged rows; do not bulk backfill.

**Deployment history correction:** Disclosure [PR #563](https://github.com/carmaziums/carmazium/pull/563) has been **merged** (rather than merely previewed), and the back-end's disabled-by-default partner feed [PR #627](https://github.com/carmaziums/carmazium/pull/627) and native seller-acknowledgement reset fix [PR #628](https://github.com/carmaziums/carmazium/pull/628) were merged. The website Terms and Privacy Policy were reported published on 18 October; **older installed native apps may not yet display the revised combined listing declaration** until a corresponding app-store build is distributed. Before any eligible native listing enters the partner feed, verify its actual declaration presentation/version and timestamp.

**Pilot-only recovery/security contract qualification:** The unsigned 24 October Revision 4 removes *new* CarMazium Storage backups, a new full isolated recovery drill and broad platform hardening as conditions for starting the **initial free 90-day pilot only**, not as ordinary compliance obligations. On 24 October the owner instructed engineering to **prepare these workstreams now and hold deployment/release until after the pilot or a separate explicit approval**; see draft [PR #630](https://github.com/carmaziums/carmazium/pull/630) and [PR #655](https://github.com/carmaziums/carmazium/pull/655). Their incomplete status is not misrepresented as compliance evidence. The specific restricted feed, appropriate security measures and lawful sharing remain prerequisites.

### Activity-by-activity Article 6 decision record — prepared for accountable legal review, NOT signed

| Activity | Candidate basis for legal reviewer | Distinct affected-person impact / final decision needed |
|---|---|---|
| Public LIVE seller-initiated auction syndication, after valid revised declaration | Contractual necessity **only insofar as objectively necessary to deliver the explicitly requested marketing service**, otherwise legitimate interests (Article 6(1)(f)) may be considered | Test seller expectations, optional publicity, partner recipients, effective notice, right to object and withdrawal handling; resolve the lawful basis per exact data field |
| Protected historical observation and 36-month independent reporting after live auction ends | Separate legitimate interests assessment **proposed, not concluded** | Re-identification through VRM and event matching, a different purpose and longer term, dealer-only access, necessity of each historical field, 36-month proportionality, objection/deletion and report reconciliation; independent DPIA screening |
| Brokered DVLA/DVSA/AutoTrader/licensed-catalogue lookups | Legitimate interests or another lawful basis to be established per provider/purpose | Verify contracted rights and minimum registration/mileage inputs, permitted recipients, transfer, onward processing, correction and deletion; no unapproved sender calls |
| Referrals and aggregate conversion reporting | Legitimate interests proposed for minimum aggregate processing | Check genuine aggregation, lawful attribution and absence of unnecessary person-level identifiers |

**LIA screening decision:** Not signed. **DPIA screening outcome:** Not approved. Based on registration/vehicle identity matching, third-party recipient lookups, long-term permitted vehicle observations and potentially persistent dealer profiles, a scoped DPIA screening is warranted; assess whether a full DPIA is legally mandatory before activation. Do not describe the rights as anonymous merely because the matching identifier is pseudonymised.

**Photograph eligibility:** A public Supabase image URL does not establish copyright, the seller's authority to syndicate, or historical-image rights. Only eligible live listings with documented source/contractual permissions may be distributed; partner photo URLs and bytes must be removed on live withdrawal, and none may persist historically.

**Remaining specific CarMazium-side actions before feed enablement:** (a) qualified reviewer to record Article 6 basis and DPIA outcome; (b) confirm website and actually distributed app notice/version and prove per-listing acknowledgment; (c) verify licensed public photo origin/rights for any sampled eligible listings and working takedown; (d) approve exact registration, current bid, broad region, photograph and referral feature switches with the backend, keeping three production switches OFF until joint release; (e) verify partner historical privacy and correction/replay duties and execute the single final agreement with both directors. This legal note does **not** authorise new customer notices or production sharing by itself.

---

## 1. Precise processing proposal and separate purposes

**A — Live automotive advertising and dealer referral.** The seller's intentional public auction listing is displayed through CarMazium and, if approved and enabled, a restricted authenticated feed to authorised automotive/dealer-research partners. Proposed fields in the isolated backend mapper: auction/listing IDs, title, limited vehicle characteristics, mileage, active auction schedule/status and starting bid; optional toggles for public vehicle photographs, registration, current valid bid, allowlisted region and signed referral. A private seller's name, contact details, exact address, buyer/bidder identity, reserve, documents, internal valuations, payment and VIN are excluded. Only live auctions qualify.

**B — Optional historical vehicle-event matching (a different impact).** Under the unsigned Schedule B, SimpleDMS proposes restricted protected matching and dated permitted observations for up to 36 calendar months measured from each vehicle's last permitted CarMazium observation. Originally issued evidence reports have their own unextended 36-month expiry. Raw VRM, individual contact/identity data, reserve and historical photographs/URLs are excluded. Dealer research must not equate bids, vehicle appearances or generated valuations to completed sale prices.

**C — Optional downstream vehicle-check and valuation recipients.** DVLA/DVSA, Autotrader and licensed auction research are still proposed, not approved recipients for CarMazium data. Specific inputs (notably registration/mileage), provider entitlement, onward processing, retention, transfers and commercial conditions need separate documentation.

**D — Distinct BuySmart analytics.** Proposed independent real-provider analytical reports retain the existing seven-day BuySmart analysis policy; older 36-month CarMazium evidence must reopen as original evidence only, without regenerating time-expired analysis. This is a product/retention decision still to approve.

## 2. Candidate lawful bases and why upload does not answer everything

The seller's submission supports a contractual, royalty-free **content-publication licence** already described by the existing CarMazium Terms (§47), expanded in [PR #563](https://github.com/carmaziums/carmazium/pull/563) to permit limited partner publication. A licence to use photographs and listing text is **not the same legal instrument as UK GDPR consent** for a new data-processing purpose.

The proposed UK GDPR basis for A may be necessity to perform the particular advertised listing service, or **legitimate interests**, depending on the documented service promise and reasonable seller expectations; avoid stating that both apply automatically. Historical B involves a distinct compatibility, proportionality and legitimate-interests analysis. Where processing is actually consent-based or separate permission is otherwise legally required, that requirement cannot be replaced with a blanket term.

**Lawful-basis choice: NOT YET DECIDED.** The applicable decision and UK GDPR Article 6 record require review by CarMazium's qualified adviser and, for B/C/D, SimpleDMS's separate assessment.

## 3. Provisional legitimate-interests assessment — purpose, necessity, balancing

| Test | Preliminary evidence supporting interest | Unresolved concern / control |
| --- | --- | --- |
| Purpose | Sellers intentionally advertise to find buyers; dealer distribution may improve auction reach and liquidity. Buyers/dealers have a legitimate need for accurate vehicle and auction research. | Record precisely how SimpleDMS uses the data and distinguish public advertising from long-term history, third-party lookups and any AI use. |
| Necessity | Restricted active listings and approved current-live photographs could support dealer discovery. A protected vehicle token may reduce false historical matches. | Evaluate less intrusive alternatives (no registration in public display, protected matching inside a confined service, no current bids, minimal mileage/region, shorter historical term, no onward provider access). Explain each field retained. |
| Balancing | Sellers should expect public listing and reasonable promotion. No seller identity/contact, reserve or private evidence is to be disclosed. Historic photos prohibited; access and expiry can be constrained. | Sellers might not reasonably expect 36-month third-party history, VRM processing or new lookups, especially on legacy listings. Assess keeper re-identification, mistakes, objection suppression, provider log retention and enforcement in restore/replay. |
| Transparency | Draft Terms and Privacy Policy specify partners, approved fields, 36-month caps, restricted photography and objections. | These documents are not yet published. Send appropriate privacy information to affected sellers and document when/how it was provided. Existing Terms are not retroactive consent. |
| Rights | Proposed correction, suppression, deletion and verified 36-month expiry; provider contact for objections. | Verify seller request handling end-to-end, impact on derived reports and backups, and SimpleDMS escalation times. Avoid treating all objections as automatically invalid just because a vehicle was previously public. |

**Provisional risk assessment:** Live stock syndication and separately archived historical vehicle observations have different reasonable-expectation and privacy impacts. Do **not** approve both from one generic \"upload = consent\" statement. The final necessity/balancing and any required DPIA screening must be signed off independently.

## 4. Existing listings: purpose-compatibility / notification gate

The previous public Terms licensed CarMazium to \"publish the Listing\", \"market the Vehicle\" and \"promote CarMazium where reasonably connected to the Listing\". That may support advertising, but **cannot itself establish specific informed consent to SimpleDMS's new third-party historical use**.

A separate, dated compatibility review should document the link to the original advertised purpose, reasonable seller expectations at collection, data type, effects of the new use, and technical/organisational safeguards. Where an older seller is affected by materially new third-party processing, provide suitable notice before activation and a working mechanism to object, correct or withdraw eligible live distribution. If legal counsel concludes fresh consent is needed for a specific processing activity, obtain it for that activity.

The existing `partnerDistributionAcceptedAt` database field and server-side filter are **technical eligibility evidence** and not a UK GDPR legal-basis conclusion. Reusing the existing mandatory seller listing declaration avoids introducing a second consent checkbox for **new** listings, but does not allow historic NULL records to be silently marked as acknowledged.

## 5. Verified technical baseline (read-only on 18 October 2026)

- Live CarMazium `public.listings`: **662 records**, **0 non-NULL partner-distribution acknowledgement timestamps**.
- Live auctions satisfying the partner query's status, deletion and time conditions **before** acknowledgement filtering: **2**; after the existing acknowledgement gate: **0**. These figures are point-in-time, not a commitment about available stock.
- Aggregated storage references in listings: **11,518 image URL references**, all pointing to `bwtnzmevjlowwronylxm.supabase.co` with a `/storage/v1/object/public/listings/` path. This **does not verify copyright, seller authority to syndicate, public reachability, or photo deletion**.
- Backend draft [service](https://github.com/carmaziums/carmazium/blob/release/simpledms-contract-recovery-gates-20261003/backend/src/partner-api/simpledms.service.ts) is fail-closed on acknowledged ACTIVE auction listings for **list/count/detail**; key guard defaults off and optional registration, images, valid current bid, region and signed referral remain individually permissioned.
- [PR #563](https://github.com/carmaziums/carmazium/pull/563): website/native Terms updated consistently, Privacy Policy improved, existing seller declaration used for the acknowledgement payload. All four CI workflows passed on `3f76ef0c53256f4b7ed91e9d0dcf96a851ae8a74`. Changes are **not merged/published**.

## 6. Reviews, evidence and approvals still required

- [ ] CarMazium legal/data-protection reviewer selects the correct Article 6 basis per purpose, records the purpose/necessity/balancing and separate legacy compatibility analysis; determines and records DPIA/screening outcome.
- [ ] SimpleDMS separately confirms its data roles, lawful bases, historical and third-party recipient purposes, and publishes its proposed privacy notice.
- [ ] CarMazium and SimpleDMS approve the evidence/objection mechanism for historic listings; reconcile the **unsigned** agreement's required recorded per-listing acknowledgement before changing the existing backend exclusion rule. Do not bulk populate NULL timestamps.
- [ ] Review and publish website AND app Terms and Privacy Policy with appropriately communicated effective date and notice; verify future listing declaration is accurately recorded and withdrawal works.
- [ ] Verify vehicle-photo source rights and actual allowlisted public delivery; no retained historical photos/URLs.
- [ ] Complete distinct independent production database and Storage restores, isolated correction/deletion/expiry replay, security remediation, provider agreements/terms and signed commercial agreement.
- [ ] Confirm production origin, approved fields, provider recipients, restricted secret handover, bilateral live+historical acceptance and written Pilot Launch Date.

**Release gate: NO-GO.** Nothing here authorises production access, seller record mutation, credential issue or the 90-day pilot.

## UK ICO guidance consulted

- [Legitimate interests (23 March 2026 update)](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/legitimate-interests/)
- [Changing purposes, notices and individual rights](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/legitimate-interests/what-else-do-we-need-to-consider/)
- [Purpose limitation and reuse](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/purpose-limitation/)
