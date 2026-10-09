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
- [ ] Obtain a current official Companies House company profile (or equivalent official filing evidence) for SIMPLEDMS LTD, company 17167272, immediately before signature.
- [ ] Confirm the current registered office and Patricia Jean Abel's current director/signatory authority.
- Reason: current public registry-derived indexes support the Peterborough PE2 6XU address supplied by SimpleDMS, but an older September index still shows 71–75 Shelton Street, London WC2H 9JQ. The final signed contract must use the current official record, not an inferred address.

### 2. Final legal/data-protection review and signatures
- [ ] Both parties review the consolidated counter-draft with appropriate legal/data-protection advice.
- [ ] CarMazium and SimpleDMS sign the same final version.
- [ ] No production credential before signatures.
- [ ] The 90-day clock starts only at mutually confirmed working production go-live, not at signature or key creation.

### 3. SimpleDMS production refresh/staleness confirmation
- [ ] SimpleDMS confirms its production scheduler will perform complete pagination approximately every 2–5 minutes.
- [ ] SimpleDMS confirms a failed refresh does not replace a good snapshot with an empty/partial one.
- [ ] SimpleDMS confirms inventory older than 15 minutes since last successful refresh is hidden or clearly unavailable.
- Synthetic lifecycle acceptance proves reconciliation semantics but does not by itself prove their production scheduler/fail-safe timing.

### 4. Production photo syndication rights
- [ ] Confirm CarMazium has an express legal basis/right to syndicate seller-uploaded vehicle photographs to SimpleDMS for live BuySmart display.
- Current CarMazium Terms grant CarMazium rights to publish listings, operate the platform, market vehicles and promote CarMazium, but do not expressly state third-party marketplace/partner syndication.
- Before production images are enabled, obtain counsel confirmation that the existing licence is sufficient or update the seller Terms/privacy notice/consent wording prospectively.
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
