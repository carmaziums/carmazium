# SimpleDMS final launch approval pack

**Date:** 12 October 2026  
**Status:** PRE-PRODUCTION HOLD  
**Purpose:** Single control sheet for the final CarMazium × SimpleDMS production decision.

## 1. Completed technical evidence

### Synthetic partner API
- [x] Isolated synthetic partner API only; no production DB, Stripe or Supabase service-role credentials.
- [x] Authentication, pagination, live-only full-snapshot and detail semantics tested.
- [x] ACTIVE, WITHDRAWN, ENDED and credential revoke/restore acceptance passed.
- [x] Historical A–E lifecycle passed:
  - baseline observation;
  - changed bid observation;
  - closing-time extension without duplicate bid;
  - ended removal / 404 with permitted history preserved;
  - same fictional vehicle returned under new auction/listing IDs and matched to the same protected history.
- [x] SimpleDMS externally confirmed automatic refresh, failed-refresh handling and stale-data behaviour in isolated Preview.
- [x] Observed bids remain observations only, not confirmed sale prices or valuation inputs.

### CarMazium acknowledgement controls
- [x] Production database contains nullable `listings.partnerDistributionAcceptedAt`.
- [x] Existing listings were not backfilled.
- [x] Post-migration verification: 642 total listings, 0 acknowledged, 642 legacy/unacknowledged.
- [x] Current production backend can persist/clear the seller acknowledgement.
- [x] Isolated partner-integration feed gate excludes listings with a NULL acknowledgement.

### Terms / Privacy / mobile disclosure implementation
- [x] Current-main release PR #563 contains only the intended web/native partner-distribution disclosures and seller acknowledgement.
- [x] Web Listing CI passed.
- [x] Mobile Listing CI passed.
- [x] One Product Parity passed.
- [x] Release Certification passed.
- [x] Exact Vercel preview is READY.
- [x] Preview Terms and Privacy wording verified.
- [ ] PR #563 merged/published. **HOLD pending final legal/data-protection approval.**

### Representative image validation
- [x] Separate staging-only photo-display scenario implemented.
- [x] Uses three CarMazium static marketing vehicle assets, not legacy/customer listing photographs.
- [x] Isolated Railway deployment healthy.
- [x] SimpleDMS sent photo-display acceptance checklist.
- [ ] SimpleDMS returns redacted photo-display evidence / pass confirmation.

## 2. Open privacy / DPIA gates

The CarMazium DPIA remains OPEN. Production partner launch remains HOLD until all items below are complete.

- [ ] Final legal/data-protection approval of the Terms and Privacy wording.
- [ ] Final approval of the lawful-basis treatment and controller/processor/independent-controller role analysis.
- [ ] Final approval of the production photograph licence/rights position.
- [ ] Review SimpleDMS's corresponding privacy notice/lawful-basis position.
- [ ] Redacted evidence for protected vehicle matching and operational raw-registration deletion.
- [ ] Redacted evidence for fixed 36-month expiry from the last permitted observation.
- [ ] Confirmation/evidence that report access does not reset the source-evidence retention period.
- [ ] Correction/deletion handling evidence.
- [ ] Confirmation that expired evidence is not reconstructed from reports, caches or backups.
- [ ] Production image host/path allowlist validation.
- [ ] Confirm private/KYC/handover/payment images cannot enter the partner feed.

## 3. Agreement gates

- [x] Final unsigned execution copy delivered to SimpleDMS.
- [x] SimpleDMS confirmed it has the execution copy and can progress review in parallel.
- [ ] SimpleDMS final acceptance of identical execution text.
- [ ] Patricia Jean Abel signs for SIMPLEDMS LTD.
- [ ] Authorised CarMazium signatory signs the identical execution copy.
- [ ] Executed copy stored with final effective date.
- [ ] No amendment, side letter or counter-draft is outstanding.

## 4. Production technical gates

Do not create or release a production credential until Sections 2 and 3 are complete.

- [ ] Exact production API field allowlist reviewed.
- [ ] Production registration/current-bid/broad-location switches reviewed.
- [ ] Production image host allowlist reviewed.
- [ ] Production photo-sharing behaviour tested only with eligible acknowledged listings.
- [ ] Legacy NULL listings excluded.
- [ ] Separate production credential created privately.
- [ ] Credential revoke/rotation and kill-switch rehearsal passed.
- [ ] Controlled production acceptance window completed.
- [ ] Live removal/reconciliation semantics confirmed in production.
- [ ] 2–5 minute refresh and >15 minute stale handling confirmed in production.
- [ ] No bidder/seller/buyer identity, reserve, VIN, exact address, KYC/private docs or internal valuation exposed.

## 5. Go-live decision

Pilot Launch Date must not be recorded until all of the following are true:

- [ ] CarMazium technical acceptance signed off.
- [ ] CarMazium privacy/DPIA/legal approval signed off.
- [ ] SimpleDMS technical acceptance signed off.
- [ ] Executed agreement complete.
- [ ] Separate production credential in place.
- [ ] Both parties confirm in writing that the complete live + historical production integration is ready and working.
- [ ] Pilot Launch Date recorded.
- [ ] 90-day free pilot starts from that recorded date only.

## 6. Current decision

**DO NOT ENABLE PRODUCTION YET.**

Reason: technical preparation is substantially complete, but the remaining legal/privacy evidence, SimpleDMS retention/deletion evidence, representative-photo acceptance and executed agreement are still mandatory launch conditions.
