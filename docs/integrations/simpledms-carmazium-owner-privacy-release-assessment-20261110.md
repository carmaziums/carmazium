# CarMazium × SimpleDMS — CarMazium-side assessment and release evidence (10 November 2026)

**Status: DECISION-READY COMPANY REVIEW; NOT YET DIRECTOR-APPROVED. No production authorisation.**

**Owner:** CARMAZIUM LTD, company number 17053307. **Agreement:** unsigned consolidated Revision 8 of 10 November 2026, commit `f0dfdbb6aa89d32bb181dcbab113c00583472432`, with SimpleDMS's 3 November 11-page Schedule C closeout annex. **Relationship:** initial free 90-day pilot, only after separate signatures, safeguarded restricted key handover, controlled acceptance and both parties' written Pilot Launch Date.

This document records what can be supported **today** from CarMazium source code, current non-personal database aggregates and live public pages. It is not a legal opinion, an executed UK GDPR Article 6 determination, a DPIA sign-off, a data subject's consent, a producer rights certificate or approval for production. A company director must review the marked decisions. Independent SimpleDMS claims belong to its own company record and its approval.

## 1. Evidence inventory and distinction between code and reality

| Topic | Observation | What it does **not** establish |
| --- | --- | --- |
| Live CarMazium Terms | `https://www.carmazium.com/terms` returned 200 on 10 November; last updated 18 Oct 2026; §47 includes limited live partner display, permitted public photos, sublicense only while live and a notice that content licence is not UK GDPR consent | That each seller actually saw this version or owns rights in every photo |
| Live privacy policy | `https://www.carmazium.com/privacy-policy` returned 200 on 10 November; updated 18 Oct; names SimpleDMS/BuySmart and prospective max 36-month history/report clocks, objection routes and legal-basis limitations | That notices were individually delivered to every affected person, or that SimpleDMS's separate notice is live |
| Web listing declaration code | `src/components/listing/ListingWizard.tsx` includes a required combined declaration of possible approved automotive/dealer-research/referral distribution and submits `partnerDistributionAccepted` | A successful fresh end-to-end production test or evidence of which exact notice version the individual read |
| Native declaration code | `carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx` contains parallel declaration, resets the acknowledgment for edit flows, and submits partner acceptance | Whether the latest installed native binary displays that exact version |
| API data minimisation | `backend/src/partner-api/simpledms.service.ts` selects a narrow auction/listing field set; excludes seller identities, reserve, private docs, KYC; historical data stays SimpleDMS's separately restricted responsibility | Photo copyright/source eligibility, actual allowed field config, or server runtime/credential state |
| Three independent access gates | `backend/src/partner-api/simpledms.guard.ts` demands `PARTNER_API_ENABLED`, `PARTNER_API_SIMPLEDMS_ENABLED`, `PARTNER_API_SIMPLEDMS_PRODUCTION_APPROVED` all equal `true` | That live Fly runtime settings were independently inspected in this review. **Do not turn any gate on** |
| Database acknowledgement status | Read-only 10 Nov aggregate: 1,038 total listings; 348 recorded acknowledgement timestamps; 690 NULL. Of 17 time-valid active AUCTION listings matching pre-ack partner filters, 16 have a recorded timestamp and 1 does not. All 16 acknowledged active auctions had ≥1 image reference, with no noncanonical image URL according to an aggregate path-pattern check | That any of the 16 can be legally released; image URL patterns are not proof of seller photo rights, takedown capability, or actual public fetch success |
| Supabase | CarMazium's known project `bwtnzmevjlowwronylxm` was queried **read-only**, returning counts above | Production backup restore, Storage-object recovery, RLS/security audit or approval to change database privileges |
| SimpleDMS supplier record | Dated 3 Nov 2026 A1–A11 record supplies separate LIAs, proposed impact assessment, provider terms/transfer assumptions, operational cache and retention periods, and proposed Article 14 notice | Independent verification, published SimpleDMS privacy notice or accepted controlled real-world processing |

**Audit note:** These counts are a single point in time, not a representation of stock for launch. Do not change NULL values to consent, infer acceptance by age, or submit test seller data to a real partner.

## 2. CarMazium legitimate-interests assessment: proposed live dealer discovery (NOT FINALLY APPROVED)

**Purpose — Article 6(1)(f) candidate:** Allow a seller who has been shown the updated partner-distribution declaration to reach authorised trade buyers by exhibiting only eligible live auction information on BuySmart, with a deep link returning the buyer to CarMazium. CarMazium's legitimate commercial interest is effective listing advertising, dealer reach and legitimate referrals. The potential benefit is stronger seller exposure; no minimum outcome is guaranteed.

**Necessity and alternatives:** Exposing dealer-relevant current live stock, limited specification, current mileage, opening bid and relevant dates may reasonably advance that purpose. Seller contacts, exact address, reserve, VIN, payments, handover, private photos and KYC are not necessary and are excluded. A plain referral link is preferable to exchanging individual customer conversion data. Registration should only be supplied server-to-server for separately authorised, entitlement-checked matching and lookup; do not include it in public dealer lists or immutable historical reports. Images are optional only when both product need and actual public-display/syndication rights are confirmed. Region must be allowlisted rather than inferred from private location text.

**Balancing against affected persons:** Sellers may reasonably expect live advertising through approved automotive partners *if they actually saw the relevant notice*; they may not expect 36-month vehicle linkage or indirect identification of a registered keeper. VRMs, images and matching tokens can be personal data in context. A vehicle may be advertised by a trader, agent or non-keeper, so a seller's acknowledgment is not a substitute for the registered keeper's Article 14 rights. Negative impact includes wrong vehicle matches, resale/credit inferences from observed bids, private image exposure and hard-to-reverse historical context. A bid observation is not a sale or actual value.

**Mitigations necessary before use:** Restrict to new, expressly acknowledged, active auction listings; exclude unacknowledged/legacy rows with no bulk backfill. Approve actual purpose-specific legal basis and notice delivery; provide a clear right to object, correction, removal and suppression including downstream records. Verify photo rights and current-live photo limitations; enforce the three kill switches and the exact field allowlist. Maintain original expiry clocks and partner incident/complaint coordination. Verify that the source notice reasonably explains protected history and the original 36-month record and separate 36-month report windows.

**Provisional conclusion for director's decision:** A tightly restricted, properly disclosed live dealer-discovery feed may be defensible under legitimate interests, subject to the concrete safeguards above. This assessment does **not** approve automatic sharing, standalone historical collection, or use of older listings. CarMazium director must explicitly accept the live purpose, balancing and residual risk before release.

## 3. Separate historical purpose and downstream provider obligations

- **SimpleDMS as proposed independent controller:** It determines the purpose and means of protected cross-appearance vehicle history and dealer report generation. Its 3 November record proposes a **separate** legitimate-interests assessment and DPIA; it must approve its own purpose, access, retention, transfers, Article 14 delivery and rights handling.
- **Duration:** Licensed historical observations expire within 36 calendar months from **last permitted source observation**. Fixed issued reports have a separate 36-month clock from original issue. A report must not recreate expired source history. Read, retry, restore or replay must not reset either clock.
- **Excluded:** No historical raw VRM after conversion, seller/bidder identity, reserve, payment, private documents, photographs or photo URLs. Observed bids never imply a confirmed sale.
- **Provider recipients:** DVLA/DVSA registration checks, entitled-dealer Autotrader registration+mileage requests, and existing licensed catalogue research are **conditionally approved categories only**. SimpleDMS must verify specific licences and dealers' entitlements, server-side minimum inputs, caches, registration-bearing logs, DPA/roles and restricted international transfers before live calls. No additional identity enrichment or Autotrader-derived data is sublicensed back to CarMazium.
- **Optional AI:** The CarMazium-derived AI route stays OFF at signing and initial service. CarMazium website AI/security are unaffected. Future activation requires distinct written approval after specific input allowlists, retention, sharing, role and transfer checks.

## 4. Data protection impact screening and provisional risk treatment

Cross-source linking and up-to-36-month history mean a scoped DPIA/impact assessment is appropriate even though the initial feed excludes direct seller identities and private documents. Do not treat pseudonymised tokens as anonymous. **Company reviewer must decide/record the final Article 35 DPIA position and any required DPO/ICO consultation.**

| Risk | Initial impact | Required mitigation | Residual status |
| --- | --- | --- | --- |
| Old/unauthorised listing distributed | Material | New-listing acknowledgement, version presented, NULL legacy fail-close, explicit objections | Not yet production-verified |
| Wrong match or bid interpreted as sale | Material | HMAC-style protected token, dated bid labels, correction/deletion propagation | Supplier synthetic evidence only |
| Private/unauthorised photo | Material | Per-image source/rights checks, public listings URL allowlist, takedown, no historic image | Actual rights not certified |
| Owner/keeper not informed | Material | CarMazium listing notice; SimpleDMS published Article 14 notice and tested delivery to relevant affected persons | Delivery plan open |
| Long-lived/recovered evidence survives deletion | Material | Separate original clocks, tombstones, quarantine, restore/replay, verification | Actual production namespace untested |
| Registration leak through provider cache/logs | Material | Minimum-field requests, separate cache/purge review, diagnostic scrubbing, entitlements | Provider controls open |
| International processing | Material | Confirm account-specific terms, DPA/UK Addendum, effective safeguards, minimum fields | SimpleDMS supplier assessment; final confirmation open |
| AI or partner access accidentally enabled | Material | AI OFF; three independent partner kill switches; no key; release approvals separate | Source controls verified; runtime not certified |

**Provisional DPIA outcome:** No claim of zero risk. The restricted arrangement has potential medium residual risks after mitigations, but it is **not currently approved for production** because important mitigations lack production-specific evidence.

## 5. Seller notices, photograph rights and objection workflow — concrete closeout

1. **Public source baseline confirmed:** Terms and privacy URL are live with 18 October 2026 update date. The current seller declaration code describes partner live syndication in both web and native source.
2. **Before sharing:** Check the actual **deployed** seller flow and current native binary, show a clear description of historical BuySmart research and link to published SimpleDMS notice. Capture declaration version, specific seller account/listing, presentation time, acknowledgement time and later withdrawal accurately. Today's observed database stores an acknowledgement timestamp, not an independently verified notice-version value.
3. **For older listings:** Keep `partnerDistributionAcceptedAt IS NULL` excluded. Do not silently backfill. If a previously acknowledged seller did not see the final history-specific notice, require a legally supported additional notice/acknowledgement or hold exclusion until the controller approves the alternative. No automated seller mailing is authorised by this assessment.
4. **If seller is not keeper:** Verify whether relevant individuals require indirect-collection privacy notice; do not assume seller checkbox informs them.
5. **Photographs:** Require demonstrable seller authority, only public vehicle images, current-live display and reliable prompt takedown; do not infer rights from public Supabase URL format alone. No historical photos or URLs.
6. **Objection / correction:** Route to `info@carmazium.com` and SimpleDMS's recorded contact. Verify identity proportionately, stop fresh exposure promptly where required, transmit event/vehicle correction or deletion securely, confirm protected history and issued report treatment, and maintain minimal audit evidence without preserving deleted identifiers.
7. **Publication:** Do not publish SimpleDMS's own notice for it. Request and verify its public URL, version, content and Article 14 delivery method before the first eligible distribution.

## 6. Corporate decision and production gates

**Can be completed without the director:** prepare this assessment, inspect code, publicly visible notices and non-personal DB counts, reconcile the fixed Revision 8 PDF annex, maintain source-control changes as drafts, perform non-destructive QA, and document a proposed pilot acceptance checklist.

**Must be personally approved by a CarMazium authorised director:** correct lawful basis and balancing for CarMazium's sharing, DPIA/screening and residual risks, exact final execution copy and annex, seller/keeper transparency policy and any legacy exception, and the eventual separate issuance of a scoped credential and launch after full technical/legal checks.

**Only after signing and pre-test safeguards:** Secure restricted key handover; private time-bounded real-feed acceptance for live **and** historical functions; verify field/photo rights, current-listing eligibility, matching, expiry/recovery, correction, revocation, 2–5-minute reconciliation, 15-minute stale cutoff and aggregate attribution.

**Only after successful acceptance:** Two companies expressly approve dealer launch in writing and record the **Pilot Launch Date**. No automatic go-live from DocuSign, signature, key delivery or isolated test results.

### Director decision record (currently intentionally blank)

- [ ] I approve CarMazium's proposed lawful basis for eligible live auction syndication, following the purpose/necessity/balancing assessment above.
- [ ] I approve CarMazium's documented DPIA/screening outcome, residual risk and required consultation decisions for its own processing.
- [ ] I have reviewed the fixed Revision 8 agreement and the 3 November SimpleDMS evidence annex, and approve that exact execution copy for my **personal** signature when SimpleDMS's Patricia has independently approved it.
- [ ] I authorise no live data sharing, production credential, key-dependent test, dealer publication or pilot launch until a later, separate written go-live decision.

**Director / authorised representative:** ____________________   **Date:** ____________

**Sources inspected:** Live `/terms` and `/privacy-policy` (10 Nov 2026), default-branch GitHub web/native declaration code, backend listing storage/partner service/guard and contract Revision 8, CarMazium production Supabase `public.listings` and `public.auctions` read-only aggregates (10 Nov 2026), SimpleDMS 3 Nov provider/privacy closeout as reconciled in the unsigned contract. ICO guidance on legitimate interests (purpose/necessity/balancing), DPIA screening for data matching and the right to be informed / Article 14. This is a dated audit snapshot only.
