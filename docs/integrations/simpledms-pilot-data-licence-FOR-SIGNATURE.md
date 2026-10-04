# CARMAZIUM × SIMPLEDMS — EARLY LAUNCH INTEGRATION AND DATA LICENCE
**Draft for signature — not effective until duly agreed by both parties**

**Parties:** (1) The legal entity operating CarMazium ("CarMazium"), **CARMAZIUM LTD**, company number **17053307**, registered office **181 Hunters Road, Birmingham, United Kingdom, B19 1ES**, represented for draft purposes by its listed director **Afaq Iftikhar** (signature still required); and (2) **SIMPLEDMS LTD** ("SimpleDMS"), **company number 17167272**, subject to independently confirming its currently registered address and signing authority against up-to-date official records. Stephen supplied an address and proposed authorised signatory; their details are recorded below but NOT treated as independently verified.

**Effective date:** The date of the last signature below. **Pilot launch:** The date the agreed integration passes joint production-acceptance testing and is live for eligible BuySmart dealers. Both parties must confirm that launch date by email. **Pilot expiry:** 90 calendar days after pilot launch unless earlier terminated under this agreement.

## 1. Commercial terms
1.1 SimpleDMS waives its proposed £5,000 integration fee. The initial integration and the entire 90-day pilot will be **free of any fees or charges to CarMazium**.
1.2 No automatic renewal, paid subscription, minimum usage commitment, exclusivity, revenue-share fee or other financial commitment arises upon expiry. Any ongoing arrangement requires a new written agreement, including pricing, signed by both parties. This agreement does not promise a particular level of traffic, inventory, registrations, bids or purchases.
1.3 Each party bears its own internal costs. Neither party may incur third-party charges on the other's behalf without written approval.
1.4 Either party may end the pilot on 7 days' written notice or immediately for material security/privacy risk or a serious material breach. On termination, all partner keys are revoked immediately and the deletion duties below apply.

## 2. Limited API and data licence
2.1 CarMazium grants SimpleDMS a non-exclusive, non-transferable, revocable licence during the pilot to access the **dedicated partner API** solely to display approved CarMazium live auctions in BuySmart, conduct dealer vehicle matching and BuySmart research/reporting, and refer interested dealers to the original CarMazium auction.
2.2 Approved fields: published vehicle title/specifications, start time/end time, starting bid, current valid bid without bidder identity, approved public vehicle photographs, registration solely for matching/reporting, and approved town/region-level location. Availability is determined from the live feed. Individual fields may be temporarily disabled by CarMazium for technical, privacy or legal reasons. CarMazium **does not licence** reserves, seller contacts, exact locations, identity documents, vehicle VINs, buyer identities, backend valuations, handover records, customer account/session data or payment data.
2.3 SimpleDMS must attribute the inventory to CarMazium, make its origin clear, and link dealers back to the corresponding CarMazium auction. CarMazium exclusively controls dealer registration/verification, bidding, financial transactions and handover. There is no third-party bidding authority and no SimpleDMS access to admin or internal APIs.
2.4 SimpleDMS shall not resell, sublicense, syndicate, share with unauthorised third parties, scrape other CarMazium endpoints, reverse-engineer restricted fields, or use licensed data to train unrelated machine-learning systems. Any permitted subcontractor needs prior written approval, equivalent written controls and appropriate processing terms.
2.5 CarMazium may revoke credentials or narrow fields if necessary for security, legal compliance, source-data restrictions or breach. CarMazium retains title and control over its source data. SimpleDMS retains ownership of its independently developed BuySmart software, code, models, analytical methods and independent outputs **without acquiring rights to underlying licensed source data embedded within, identifiable from or reconstructible through those outputs**.
2.6 The parties recognise the legitimate distinction between the transient live marketplace and potentially useful, minimal historical vehicle-event evidence. **No historical vehicle-level rights are granted by this draft**. Any such rights require a **separately signed, field-specific Schedule B**, including purpose, ability to match returning vehicles, lawful basis, retention, deletion and post-expiry terms; see [the proposed negotiation schedule](simpledms-historical-data-and-subprocessors-PROPOSAL.md). General ownership of a report or analytic output cannot extend licensed fields or create a perpetual source-data licence.

## 3. Cache, synchronisation and deletion
3.1 The integration may ingest and cache licensed data on secured, access-controlled SimpleDMS infrastructure solely for the agreed purposes. SimpleDMS must document hosting locations, authorised access, subprocessors, encryption at rest/in transit and incident contacts before live enablement.
3.2 Complete the authenticated, paginated live-feed reconciliation approximately every 2–5 minutes, within agreed service rate limits. Remove listings promptly when they disappear from a successfully completed snapshot. During outages, listings last refreshed more than **15 minutes** ago must be unavailable for dealer purchase decisions and clearly identified as stale or hidden.
3.3 Limit raw live vehicle records and image copies to the period the auction remains in the approved live feed; an operational reconciliation buffer of up to **24 hours** after withdrawal is permitted only if isolated from dealer-facing availability. **A separate, narrowly scoped historical-event capability may be negotiated under a signed Schedule B**, but the present licence does not authorise building a historic per-registration database, indefinite replication of auction records or continued public display of ended listings.
3.4 Revoke partner credentials upon expiry/termination. Within **7 calendar days** after expiry/termination, SimpleDMS shall delete its raw live licensed inventory, VRMs and image copies, including ordinary operational caches, and provide written deletion confirmation. **Only historical fields and time-limited activities separately approved in a signed Schedule B may have a different expressly agreed expiry/deletion deadline. Until then, no such retained historic records may be populated.** Any backup residuals required by established backup cycles must be isolated from use, remain protected and be deleted on the documented backup expiry schedule agreed before launch. Independently created and properly anonymised aggregate statistics may be retained for joint evaluation. Any mandatory statutory retention exceptions must be disclosed and documented.
3.5 SimpleDMS shall not continue to advertise sold, cancelled, withdrawn, expired or otherwise unavailable CarMazium auctions as live. CarMazium remains authoritative for status, and a stale snapshot does not grant permission to continue publication.

## 4. Security and data protection
4.1 Each party shall follow applicable UK data-protection legislation. The parties must document, prior to live access, which fields constitute personal data and determine their actual controller/processor or independent-controller roles **for each processing activity**, including a compliant UK GDPR Article 28 schedule if required. This commercial agreement is **not a substitute** for a legally necessary processor or controller-sharing agreement.
4.2 VRMs and persistent vehicle-matching tokens may be personal data in context, even if pseudonymised. They may be used only for explicitly approved purposes, with a documented lawful basis and fixed retention, and not to infer or share vehicle keeper identity. No seller, buyer or dealer identities shall be supplied by the auction feed or shared through attribution reports. Repeat-appearance history and retention of an individual customer report must receive separate assessment.
4.3 Use independently issued staging and production credentials, never expose them to a browser or mobile app, never commit them to source control, and promptly rotate/revoke compromised credentials. Test inventory must be synthetic. Each party must restrict credentials to authorised technical personnel.
4.4 Each party must inform the other **without undue delay and, where practicable, within 24 hours of discovery** of an incident materially affecting licensed data, then cooperate with statutory notification obligations. Contact names, security email addresses and escalation arrangements must be filled in before production launch.
4.5 CarMazium must verify that the relevant seller-media permissions and photo rights permit this form of syndication before enabling public photographs. Any historical retention of images requires separate permission. Any contested or unauthorised media must be withdrawn promptly.
4.6 Expected SimpleDMS service providers disclosed by Stephen are **Vercel** (server-side hosting), **Supabase** (BuySmart data layer) and **OpenAI** (optional BuySmart text/report explanations). Listing their names does not itself authorise forwarding CarMazium feed records. Record exact vendor entities, account configuration, hosting regions, data-transfer safeguards, processor/controller roles, DPAs, access controls, retention and deletion in signed Schedule B before enablement. **CarMazium feed-to-OpenAI processing is disabled by default pending separate AI-input approval**; no raw bulk feed, VRMs, seller/bidder details or opt-in to model training. A provider no-training default does not prove zero data retention.

## 5. Measurement and privacy
5.1 SimpleDMS will provide aggregate impressions, individual vehicle views, BuySmart reports and outbound dealer-click counts during the pilot, with measurement definitions and reasonable access for reconciliation.
5.2 CarMazium may measure aggregate signed referrals, new dealer registrations, qualified bids and handover-approved completed purchases for the specifically referred auction, when technically feasible and lawful. Do not disclose or exchange named dealers, customer emails, telephone numbers, identifiable user-level attribution events, payment records or other personal data with SimpleDMS.
5.3 First-party attribution shall not be enabled until CarMazium has reviewed the privacy notice, lawful basis and applicable PECR/cookie consent requirements and validated the process in a test environment. Attribution counts are best-effort and no attribution implies guaranteed causation.

## 6. Technical launch acceptance
6.1 SimpleDMS shall implement the documented partner API and present CarMazium clearly as auction source. Both parties shall test approved fields, live/ended lifecycle changes, bid-price refresh, photographs, direct links, temporary caching and opt-in reporting with synthetic data and independent staging credentials.
6.2 **Production launch requires affirmative written sign-off by both parties** after final security, privacy/data-sharing and staged integration tests. The 90-day pilot starts only on the mutually confirmed live launch date.
6.3 Neither party represents that the draft API, credentials or sample data are production-ready until those gates have passed.

## 7. Governance and signatures
7.1 Changes to fields, caching periods, reporting, security controls, retention or ongoing fees require written approval from authorised representatives.
7.2 The parties shall agree contact details for technical operations, privacy/security incidents, contractual notices, and the applicable governing law and dispute-resolution mechanism before signing. Material liability limits, indemnities, photo rights and any necessary controller/processor provisions require the parties' legal approval.

**CarMazium operating entity**
Legal name: CARMAZIUM LTD
Company number and registered address: 17053307; 181 Hunters Road, Birmingham, United Kingdom, B19 1ES
Proposed authorised signatory / title: Afaq Iftikhar, Director (signature required)
Signature / date: ____________________________
Technical contact: ____________________________
Privacy/security contact: ____________________________

**SimpleDMS**
Legal name: SIMPLEDMS LTD (supplied; official verification pending)
Company number: 17167272 (supplied; official verification pending)
Stated registered office (verify current Companies House record): Brightfield Business Hub, Bakewell Road, Orton Southgate, Peterborough, Cambridgeshire, England, PE2 6XU
Proposed authorised signatory: Patricia Jean Abel, Director (verify authority)
Signature / date: ____________________________
Technical contact: Stephen Abel, info@simpledms.co.uk
Privacy/security contact: Stephen Abel, info@simpledms.co.uk (confirm incident escalation)

**Schedule B — Historical evidence and third-party processing:** the [proposed schedule](simpledms-historical-data-and-subprocessors-PROPOSAL.md) is for negotiation and must be completed, reviewed by counsel and signed before any historical vehicle-level retention or optional OpenAI feed processing. Nothing in this draft constitutes permission to use historic data or share records with OpenAI.

**Schedule A — Approved staging/production fields:** mark each optional field YES/NO at signature: public photographs [  ]; vehicle registration [  ]; valid current bid [  ]; approved town/region [  ]. Other base fields are as stated in the versioned partner API contract.
