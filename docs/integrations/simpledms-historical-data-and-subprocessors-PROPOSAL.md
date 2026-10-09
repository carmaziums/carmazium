> **SUPERSEDED FOR NEGOTIATION — 5 October 2026.** The current consolidated counter-draft is [simpledms-consolidated-integration-data-licence-FOR-SIGNATURE.md](simpledms-consolidated-integration-data-licence-FOR-SIGNATURE.md). This older document is retained only for audit/history and should not be used as the current signature candidate.

# SimpleDMS × CarMazium — PROPOSED Schedule B: historical evidence and subprocessors
**Negotiation draft, 3 October 2026. NOT APPROVED, SIGNED OR AN API PERMISSION.**
This schedule supplements the [pilot data licence](simpledms-pilot-data-licence-FOR-SIGNATURE.md). The API remains disabled and its optional fields remain OFF until separate written approval and staging sign-off. None of these terms changes the free initial integration, non-exclusive 90-day pilot, or CarMazium's control of registration, bidding, payments and transactions.

## 1. Partner details supplied by Stephen (verify Companies House before signing)
- Proposed contracting partner: **SIMPLEDMS LTD**, company number **17167272**, incorporated in England and Wales.
- Stephen's stated registered office: **Brightfield Business Hub, Bakewell Road, Orton Southgate, Peterborough, Cambridgeshire, England, PE2 6XU**. This is **supplied but not independently verified against a current official register extract**; historical third-party company-directory entries display other addresses. Ask for current Companies House profile/confirmation before signatures; do not infer misconduct or assume that an older registered office is current.
- Proposed signatory: **Patricia Jean Abel**, Director (authority subject to confirmation).
- Technical/security contact: **Stephen Abel**, **info@simpledms.co.uk**.
- **CarMazium's own legal contracting entity and signatory remain to be verified and inserted**; do not substitute website trading name or assume another company is its contracting entity.

## 2. Data categories; keep live and historical use technically separate
| Category | Proposed permitted scope | Removal and status |
|---|---|---|
| Live inventory | Specifically enabled, approved active-auction feed fields, approved public photos, narrowly scoped registration for matching, current valid bids, permitted town/region; NEVER reserve, bidder identity, precise location or private seller data | Full pagination sync approximately every 2–5 minutes; promptly delist ended/withdrawn/sold entries after a completed snapshot; hide or explicitly mark unavailable when older than proposed 15-minute failure threshold |
| Operational reconciliation | Minimum raw licensed records needed to reconcile newly ended/withdrawn entries | Internal-only up to proposed 24 hours after removal; never dealer-facing as live |
| Historical auction-event evidence (**conditional; not granted by the current pilot**) | During the pilot, a narrowly defined event history for BuySmart reports and a repeated-appearance demonstration using **only fields explicitly ticked in §3**. Label every observed bid as a timestamped **observation**, not sale price, final bid or confirmed transaction. Identify CarMazium as the source. Never imply an ended auction is still available | Retention and treatment of already-issued reports must be agreed in §4; no indefinite historical-vehicle licence arises merely because SimpleDMS owns its algorithms or derived report format |
| Truly anonymised aggregate statistical outputs | Non-identifying, non-reconstructible aggregate usage/performance and broad market trends that cannot reveal specific auction, VRM, owner or confidential source database | May survive only after documented anonymisation and agreed audit; pseudonymised or low-cell-count, matchable data is NOT automatically anonymous |

**Important:** Ownership of BuySmart's pre-existing software, code, models, methods and genuinely independent analysis stays with SimpleDMS. Ownership of CarMazium's source data, listings and licensed material stays with CarMazium. An output containing identifiable/source auction records or a reconstructible substantial extract is still subject to the limited source licence, regardless of who owns the surrounding report or method. No implied perpetual reuse, resale, onward syndication, training corpus, public historic auction mirror or competing raw source database.

## 3. Historical field-level choices requiring written sign-off (unchecked = NOT permitted)
For the 90-day proof-of-value only, propose the following optional historical event fields, with final choice recorded by both parties:
- [ ] CarMazium attribution and synthetic/non-sensitive historical event reference
- [ ] Make, model, variant, model year and broadly banded mileage
- [ ] Auction month or other approved coarse date
- [ ] Starting price and timestamped publicly observed valid bid **explicitly labelled as observations, not realised sale prices**
- [ ] Approved coarse town/region; only if necessary
- [ ] Linkable history of the *same specific vehicle*: requires separate lawful-basis assessment and an explicit permitted VRM or carefully controlled pseudonymous matching-token design. Hashing a UK VRM without separate protected secret/control is NOT anonymisation.
- [ ] A separate, revocable right to retain image copies after the auction ends (default NO; confirm seller-photo syndication/retention rights first)

Default **NO** for historical raw VRMs, exact dates/location, full listing text/images, original deep links after removal, immutable owner-linked IDs, reserve, seller/contact data, bidder identity, private files and proof of handover. No historical access to fields never exposed by the approved API. If SimpleDMS needs different fields for meaningful repeat-appearance evidence, it must supply a minimum sample dataset and example report **with entirely synthetic data** so the parties can evaluate a narrow amendment. Do not enable extra production fields automatically.

## 4. Historical duration and deletion: proposed negotiation positions
- **Live/operational raw data:** retain while licensed and live, subject to no-longer-live delisting and up to 24-hour non-public reconciliation buffer.
- **Limited, specifically approved historical event evidence:** available for this **90-day pilot only**. For a fair end-of-pilot assessment, propose up to **90 further calendar days** of offline internal evaluation following pilot expiry; no continued public display, new report generation, partner API access or further collection unless separately signed. This period is a **proposal**, not an agreement.
- **Already delivered individual dealer reports** and repeat-appearance matching need an express, separately negotiated permitted-field list, audience, period, lawful basis, deletion rights and onward-use restriction. Neither partner has agreed to indefinite preservation. Any continued commercial/history licence beyond the assessment period requires new written terms, without automatic payment or renewal.
- On termination or privacy/security revocation: immediately suspend feed and cease new uses. Remove active inventory and operational raw records within the existing **7-calendar-day proposed deletion SLA**. Apply separately signed dates for expressly approved historical/event records; until then do not populate a retained historical database. Isolate protected backup residuals and expire them to a mutually documented schedule. Provide documented deletion confirmation. Respect applicable legal retention and data-subject rights.
- Commercial reports may count only statistically reliable, non-identifying, mutually defined attribution; no dealer lists or personal conversion trails are exchanged.

## 5. Proposed subprocessor and AI boundaries
Partner has **named expected services**, but has not yet supplied actual account configuration, hosting/storage regions, transfer arrangements, complete subcontractor chain or confirmed exact API processing patterns.
| Expected provider | Declared purpose | Conditions before partner feed is enabled |
|---|---|---|
| Vercel | BuySmart hosting and server-side processing | Record controller/processor roles, relevant contract/DPA, account region(s), logging/cache settings, international transfers, authorised personnel and subprocessor list |
| Supabase | BuySmart database/backend | Verify exact project region(s), RLS and least privilege, encrypted storage, record/backup deletion and retention, lawful transfers and DPA |
| OpenAI | Optional explanations/reporting, only where necessary for approved BuySmart functionality | **Default: OFF for CarMazium feed** until a separately reviewed AI-input schedule. When permitted, submit **minimum redacted fields**, no VRM, seller/bidder identities, private source records, complete raw feeds or persistent files by default; no opt-in to model training; record exact API endpoint, application-state/storage/abuse-monitoring retention and contract/DPA, regions/transfers, and safeguards against reproducing substantial source records in outputs. Delete processor-controlled artifacts where supported. Provider no-training default does NOT imply zero retention. |

All third-party processing is limited to contracted BuySmart functionality; no general transfer, resale or unrestricted model improvement. Material new vendors, regions or processing purposes require notice and where appropriate prior written approval. Assign actual UK GDPR roles by activity, with UK GDPR Article 28 or controller-sharing terms as applicable, and confirm international transfer safeguards if required.

## 6. Joint acceptance checklist before production
- [ ] Both contracting entities and signing authority verified with up-to-date official records
- [ ] Each historical event field and purpose explicitly chosen, including whether repeat-appearance matching is essential
- [ ] Fixed historical duration, backup/report exception, deletion evidence and rights after trial separately signed
- [ ] Seller public-image syndication and any historical-photo retention rights verified
- [ ] VRM/privacy assessment, controller/processor roles, data-subprocessor schedule, region/transfer terms and AI configuration approved
- [ ] Versioned sample synthetic reports tested for historical/source accuracy and correct stale/live status
- [ ] Partner API and attribution E2E tested on separated synthetic staging, including withdrawal, paused service, key rotation/revocation and opt-out
- [ ] Independent DB backup timestamps, approved private object backup and recovery exercise evidenced per tracked issue #364
- [ ] Final signing and joint go-live approval recorded. **No credentials sent through normal email and no production deployment from this draft.**

UK ICO guidance to consult with qualified counsel: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/what-is-personal-data/can-we-identify-an-individual-indirectly/ and https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/pseudonymisation/ .
Provider settings must be verified on the **SimpleDMS account**. OpenAI's general API no-training default and separate storage/retention controls are described at https://platform.openai.com/docs/guides/your-data ; do not represent these as independently verified SimpleDMS settings.

**Counsel review required before either party signs.**
