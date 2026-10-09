# SimpleDMS production launch readiness — 9 October 2026

**Status:** Synthetic staging acceptance COMPLETE. Production partner API remains DISABLED.

This note is the current launch-gate record for the CarMazium × SimpleDMS integration. It does not itself authorise production access, issue a production credential, sign the agreement, or start the 90-day pilot.

## Completed and evidenced

- [x] Dedicated isolated synthetic staging service in use; no production database/customer data connected.
- [x] Dedicated SimpleDMS staging credential tested externally by SimpleDMS.
- [x] Pagination accepted externally: 51 unique fictional auctions across 25 + 25 + 1 records; repeat refreshes produced no duplicates.
- [x] ACTIVE accepted: feed/detail/Preview passed, HTTP 200 detail.
- [x] WITHDRAWN accepted: removed from full feed/Preview, HTTP 404 detail.
- [x] Restored ACTIVE accepted: reappearance without duplication, HTTP 200 detail.
- [x] ENDED accepted: removed from full feed/Preview, HTTP 404 detail.
- [x] Temporary staging access revocation accepted: feed/detail refused without auction-data exposure.
- [x] Same existing staging credential restored and accepted: feed recovered HTTP 200 while ENDED auction remained absent/detail 404.
- [x] Denied partner responses hardened with `Cache-Control: no-store`; explicit disabled/missing/wrong credential contract assertions pass.
- [x] Full SimpleDMS synthetic contract and hosted anonymous-access checks pass on commit `e2d9d432887ee25738d7f1e6624f3f2a3352156f`.
- [x] Public runtime security gate passes with 0 critical, 0 high and 0 medium findings.
- [x] Schedule C provider disclosures completed in consolidated signature draft.
- [x] CarMazium company number 17053307, registered office 181 Hunters Road, Birmingham B19 1ES and Afaq Iftikhar's active director appointment are independently corroborated by the current Companies House public register.
- [x] Current OpenAI API documentation checked on 9 October 2026: API inputs/outputs are not used for model training by default; explicit account-level input/output sharing is an opt-in. Responses API and abuse-monitoring retention language in Schedule C remains materially consistent with current published data-control documentation.
- [x] Monthly aggregate metric categories are defined in section 14 of the consolidated agreement.
- [x] Schedule A expressly defines approved and prohibited live fields.
- [x] Schedule B defines the 36-month historical evidence model and prohibits historical photos/raw VRM.

## Remaining pre-production gates

### 1. Current SimpleDMS company/signatory evidence
- [x] Stephen supplied the current official Companies House company-profile URL for SIMPLEDMS LTD, company 17167272, on 9 October 2026.
- [x] Stephen supplied the current official officers URL and confirmed Patricia Jean Abel will sign for SimpleDMS Ltd as director.
- [x] Current registered office confirmed for the agreement: Brightfield Business Hub, Bakewell Road, Orton Southgate, Peterborough, Cambridgeshire, England, PE2 6XU.
- Signing-date recheck remains a normal execution control, not an open integration blocker.

### 2. Final legal/data-protection review and signatures
- [ ] Both parties review the consolidated counter-draft with appropriate legal/data-protection advice.
- [ ] CarMazium and SimpleDMS sign the same final version.
- [ ] No production credential before signatures.
- [ ] The 90-day clock starts only at mutually confirmed working production go-live, not at signature or key creation.

### 3. SimpleDMS production refresh/staleness confirmation
- [x] SimpleDMS confirmed a complete paginated reconciliation target every 2 minutes, within the agreed approximate 2–5 minute interval and API/service limits.
- [x] SimpleDMS confirmed an incomplete/failed refresh retains the last successful snapshot and is not treated as a successful empty feed.
- [x] SimpleDMS confirmed CarMazium inventory will be hidden or clearly marked unavailable after more than 15 minutes without a successful refresh.
- [ ] SimpleDMS will verify this behaviour in production before providing written go-live approval. Synthetic lifecycle acceptance remains separate from production acceptance.

### 4. Production photo syndication rights
- [x] Review identified that the legacy User Content licence is not explicit enough to rely on for third-party partner syndication without qualification.
- [x] Prospective Terms/Privacy wording has been prepared in draft PR #444 for web/native parity and is NOT live pending review.
- [x] A fail-closed technical design has been prepared: a listing-level partner-distribution acceptance timestamp defaults to NULL, and the SimpleDMS feed excludes any listing without that acknowledgement. Legacy listings therefore remain excluded by default.
- [ ] Legal/data-protection review approves the final wording and activation approach.
- [ ] Updated Terms/Privacy are deployed before any production partner feed is enabled.
- [ ] Only listings carrying the recorded partner-distribution acknowledgement are eligible for the live partner feed.
- Historical photographs remain prohibited under Schedule B.

### 5. Privacy notice / lawful-basis implementation
- [ ] Update/confirm CarMazium's privacy notice for the approved SimpleDMS live-feed purposes, including VRM/server-side matching where used, broad location, current bid, partner referral/attribution where enabled, retention/deletion and the separate historical matching purpose.
- [ ] Record the lawful basis and controller/processor or independent-controller treatment by activity.
- [ ] Ensure any attribution cookie/tracking or equivalent PECR-relevant mechanism is enabled only after the required disclosure/consent assessment.
- [ ] SimpleDMS confirms its corresponding privacy notice/lawful basis.

### 6. Exact production field/config acceptance
- [ ] Verify production photographs load only from approved public URLs and private/KYC/handover media cannot leak.
- [ ] Verify registration, current-bid and broad-town controls against the exact production release configuration.
- [ ] Verify CarMazium source/deep links and referral links on the exact production release.
- [ ] Reconfirm feed excludes seller/bidder/buyer identities, reserve, VIN, private documents, KYC/handover, payment data and internal valuation.
- [ ] Rehearse production-key rotation/revocation procedure without disclosing raw credentials.

### 7. Joint production go-live
- [ ] Generate a separate production credential only after all preceding gates pass.
- [ ] Deliver it through an approved private channel; never email the raw secret.
- [ ] Run a short live production acceptance window with agreed fields only.
- [ ] Both parties provide written production go-live approval and rollback/kill-switch acknowledgement.
- [ ] Record the exact UTC Pilot Launch Date; start the 90-day period then.

## Internal CarMazium risk note

The independent production backup/restoration and broader production database hardening workstreams remain separate CarMazium operational-risk items. They are not represented here as completed by the SimpleDMS synthetic acceptance. No destructive database migration, production credential change, or paid Supabase branch is authorised by this document.

## Decision

**Synthetic staging: PASS / COMPLETE.**

**Production: HOLD** until the remaining legal/privacy/photo-rights/partner-operations/exact-production-config/signature/go-live gates above are closed.
