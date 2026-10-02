# CARMAZIUM × SIMPLEDMS — EARLY LAUNCH INTEGRATION AND DATA LICENCE
**Draft for signature — not effective until duly agreed by both parties**

**Parties:** (1) The legal entity operating CarMazium ("CarMazium"), whose legal name, company number, registered address and authorised signatory must be inserted by CarMazium; and (2) SIMPLEDMS LTD ("SimpleDMS"), subject to confirmation of its registered details and authorised signatory.

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
2.5 CarMazium may revoke credentials or narrow fields if necessary for security, legal compliance, source-data restrictions or breach. CarMazium retains title and control over its source data. SimpleDMS retains ownership of its independently developed BuySmart software, subject to the limits on licensed data.

## 3. Cache, synchronisation and deletion
3.1 The integration may ingest and cache licensed data on secured, access-controlled SimpleDMS infrastructure solely for the agreed purposes. SimpleDMS must document hosting locations, authorised access, subprocessors, encryption at rest/in transit and incident contacts before live enablement.
3.2 Complete the authenticated, paginated live-feed reconciliation approximately every 2–5 minutes, within agreed service rate limits. Remove listings promptly when they disappear from a successfully completed snapshot. During outages, listings last refreshed more than **15 minutes** ago must be unavailable for dealer purchase decisions and clearly identified as stale or hidden.
3.3 Limit raw vehicle records and image copies to the period the auction remains in the approved live feed; an operational reconciliation buffer of up to **24 hours** after withdrawal is permitted only if isolated from dealer-facing availability. Do not build a historic per-registration database from this licence.
3.4 Revoke partner credentials upon expiry/termination. Within **7 calendar days** after expiry/termination, SimpleDMS shall delete its raw licensed inventory, VRMs and image copies, including ordinary operational caches, and provide written deletion confirmation. Any backup residuals required by established backup cycles must be isolated from use, remain protected and be deleted on the documented backup expiry schedule agreed before launch. Independently created aggregated, non-identifying pilot statistics may be retained for joint evaluation. Any mandatory statutory retention exceptions must be disclosed and documented.
3.5 SimpleDMS shall not continue to advertise sold, cancelled, withdrawn, expired or otherwise unavailable CarMazium auctions as live. CarMazium remains authoritative for status, and a stale snapshot does not grant permission to continue publication.

## 4. Security and data protection
4.1 Each party shall follow applicable UK data-protection legislation. The parties must document, prior to live access, which fields constitute personal data and determine their actual controller/processor or independent-controller roles **for each processing activity**, including a compliant UK GDPR Article 28 schedule if required. This commercial agreement is **not a substitute** for a legally necessary processor or controller-sharing agreement.
4.2 VRMs may be personal data in context. They may be used only for the limited authorised purposes above and not to infer or share vehicle keeper identity. No seller, buyer or dealer PII shall be supplied by the auction feed or shared through attribution reports.
4.3 Use independently issued staging and production credentials, never expose them to a browser or mobile app, never commit them to source control, and promptly rotate/revoke compromised credentials. Test inventory must be synthetic. Each party must restrict credentials to authorised technical personnel.
4.4 Each party must inform the other **without undue delay and, where practicable, within 24 hours of discovery** of an incident materially affecting licensed data, then cooperate with statutory notification obligations. Contact names, security email addresses and escalation arrangements must be filled in before production launch.
4.5 CarMazium must verify that the relevant seller-media permissions and photo rights permit this form of syndication before enabling public photographs. Any contested or unauthorised media must be withdrawn promptly.

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
Legal name: ____________________________
Company number and registered address: ____________________________
Authorised signatory / title: ____________________________
Signature / date: ____________________________
Technical contact: ____________________________
Privacy/security contact: ____________________________

**SimpleDMS**
Verified legal name/company number/address: ____________________________
Authorised signatory / title: ____________________________
Signature / date: ____________________________
Technical contact: ____________________________
Privacy/security contact: ____________________________

**Schedule A — Approved staging/production fields:** mark each optional field YES/NO at signature: public photographs [  ]; vehicle registration [  ]; valid current bid [  ]; approved town/region [  ]. Other base fields are as stated in the versioned partner API contract.
