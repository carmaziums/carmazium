# CarMazium → SimpleDMS — release acceptance and outstanding work matrix
**Version 10 November 2026 | UNSIGNED | NO-GO | Read-only preparation; not production activation**

Contract reference: consolidated Revision 8, 10 Nov 2026, commit `f0dfdbb6aa89d32bb181dcbab113c00583472432`; original SimpleDMS 3 November 11-page Schedule C supplier record. CarMazium owner privacy/impact assessment: `simpledms-carmazium-owner-privacy-release-assessment-20261110.md`.

**Separation of phases** (Stephen's 10 November written clarification): final same-PDF **company approvals → each director personally signs → complete pre-real-data safeguards → issue separate restricted key through approved secure channel → controlled, non-public key-dependent live+historical test → fix defects → both companies approve dealer go-live in writing and set Pilot Launch Date → only then 90-day pilot starts**. No live credentials or seller data can be used merely by signing.

## Observed code and live read-only baseline, 10 November 2026

- Live `https://www.carmazium.com/terms` and `https://www.carmazium.com/privacy-policy` returned 200. Both say updated 18 Oct; the former covers licensed partner live display/photo syndication, the latter names the SimpleDMS purpose, separate original 36-month history/report clocks and objections.
- Default-branch web listing code and native sell-screen code display the combined partner-distribution acknowledgement and pass `partnerDistributionAccepted`. The backend persists `partnerDistributionAcceptedAt`; old rows default NULL and are excluded by the partner queries. Native edit mode resets the declaration pending fresh affirmation.
- Default-branch `SimpleDmsGuard` denies access unless all three exact flags are true: `PARTNER_API_ENABLED`, `PARTNER_API_SIMPLEDMS_ENABLED`, `PARTNER_API_SIMPLEDMS_PRODUCTION_APPROVED`. A dedicated SHA-256 digest is also needed for `X-Partner-Key`. Optional image/VRM/bid/region/referral flags must remain separately approved.
- An unauthenticated `GET https://carmazium-hjoh9w.fly.dev/partners/v1/simpledms/auctions` returned **HTTP 404** at approximately 20:36 UTC 10 Nov, with no auction data. This proves denial of that one uncredentialed request only; do not infer runtime flags, logs or key state.
- Read-only live database aggregates: 1,038 listings, 348 with acknowledgment timestamp, 690 with NULL; 17 currently time-valid active auction/listing joins before the ack filter, 16 after it (one excluded). All 16 acknowledged current auction rows have one or more image references; none had a noncanonical URL pattern in an aggregate path check. **URL patterns are not legal proof of photo ownership or live readability.**
- PRs #562/#563 have been merged. These are implemented source changes, not live integrated E2E evidence for all seller/keeper privacy duties.
- **Missing in the observed acknowledgement schema:** A separately persisted precise declaration/privacy version was not verified; a timestamp alone is not proof of which text was presented. Do not manufacture that evidence. Resolve through approved engineering/versioned audit approach before release.
- The 24 October field profile in branch `legal/simpledms-current-privacy-facts-20261024` was a review specification, not permission. This matrix updates sequencing for Revision 8.

## Gate matrix: responsible party, test, evidence and state

| Phase | Responsible | Requirement / exact acceptance | Recorded evidence | Current state |
| --- | --- | --- | --- | --- |
| A. Signing | Both company directors | Accept *same* signed version of Revision 8 agreement plus unaltered 3 Nov Schedule C annex. Check identical PDF digest. | 36-page unsigned pack sent to Stephen 10 Nov; user director form prepared | **Open: separate company approvals, actual signatures** |
| A. Signing | CarMazium director | Approve CarMazium-specific Article 6 lawful basis, balancing, impact screening and residual risks. | 10 Nov decision-ready owner memo; public site and code reviewed | **Open: recorded corporate decision** |
| A. Signing | Patricia for SimpleDMS | Approve supplier processing/transfer/retention/DPIA evidence, final text and signature authority. | Stephen says Patricia happy to use DocuSign once pack in order | **Open: Patricia's explicit company approval of exact PDF** |
| B. Before any real data | CarMazium | Prove actual web + installed app listing declaration and Terms/privacy links presented, accepted, timestamped and versioned. Exclude legacy and outdated disclosures until lawful pathway decided; no auto backfill. | Code merged; DB counts read-only | **Open: production proof / version record** |
| B. Before any real data | Both | Published SimpleDMS CarMazium privacy information, lawful indirect-data/Article 14 delivery route for affected seller/owner/keeper, clear rights/objection contact and notification evidence | CarMazium live privacy names SimpleDMS; SimpleDMS 3 Nov notice is proposed not proven published | **Open: delivery verification** |
| B. Before any real data | CarMazium | Verify seller/licensor authority to syndicate each chosen public vehicle photo; test replacements, withdrawals and deletion; **no historical images or URLs** | Public URL-pattern check only | **Open: individual rights evidence** |
| B. Before any real data | CarMazium/backend | Verify production app's partner route has three flags OFF until authorised, scoped role, strict field projection, no seller/bidder/reserve/KYC/VIN/private locations, and optional image/VRM/bid/region flags default OFF | Source inspected; anonymous route returned 404 | **Open: actual deployment environment/access review** |
| B. Before provider lookup | SimpleDMS | Verify DVLA/DVSA, dealer-entitled Autotrader and licensed auction-catalogue use per account, lawful bases, minimum VRM/mileage, operational cache/log isolation and transfer safeguards | Provider operator assertions dated 3 Nov | **Open: full provider acceptance** |
| B. Before key handover | Both | Approve contract scope, lawful fields, rights, minimum security, restricted channel, key rotation, access expiry/audit, breach escalation, rollback and a private acceptance window | Revision 8 Schedule C/D plan | **Open: bilateral pre-test approval** |
| C. Controlled post-key test | Both | Authenticated list/count/detail same strict eligibility; missing/invalid/revoked key denied; true pagination, stable results, no private fields, photo current-live only | Synthetic tests previously accepted | **Open: real scoped acceptance** |
| C. Controlled post-key test | Both | Complete snapshot refresh 2–5 min, hide stale >15 min, live cache cleanup ceiling 24h, ended/deleted/withdrawn removal, app/browser link integrity | Synthetic acceptance previously recorded | **Open: real scoped acceptance** |
| C. Controlled post-key test | SimpleDMS | Protected vehicle matching, raw-VRM operational conversion/deletion, original 36-month event/report clocks, seven-day separate analysis, correction/objection, quarantine replay after restore | Provider tests in staging, not production | **Open: real scoped acceptance** |
| C. Controlled post-key test | Both | Agreed signed referrals/aggregate counts, safe verification with no person-level exchange; test revocation and emergency stop | Signed-referral implementation exists | **Open: real acceptance / definitions** |
| D. Dealer launch | Both directors/authorised signatories | Fix defects; sign written production readiness/go-live and record exact Pilot Launch Date; only then enable dealer-facing use and 90-day pilot | No current launch approval | **NO-GO** |
| Future optional AI | SimpleDMS + CarMazium | Initial CarMazium-derived AI OFF; any future use requires explicit approval and validated pathway/input allowlist/provider retention/sharing/transfer details | Revision 8 clarifies sequence | **OFF by default; not a signature blocker** |

## Actions safely completed / items not to repeat

**Completed in this audit:** Reviewed native/web declarations, public privacy/Terms, backend partner query and guard, live aggregate acknowledgement/auction eligibility and image-path patterns, anonymous API denial and recorded unsigned contract sequencing. No unnecessary repeat synthetic test or real customer disclosure was undertaken.

**Not completed and cannot be attested by a draft or checkbox:** Individual photo ownership; that a given user saw the final legal notice and SimpleDMS Article 14 route; final Article 6/DPIA company determination; installed native version parity; downstream provider entitlements and actual retained logs; runtime flags/internal secrets; end-to-end correction/expiry/restore acceptance. Corporate directors must authorise their own decisions. Production release requires bilateral checks and a fresh written decision.

**Independent platform-wide backup/hardening:** Previous agreed *initial 90-day pilot* exception means an additional CarMazium-wide independent Storage backup, full isolated restore and broader DB privilege migration are not automatically pilot-launch preconditions. This exception does not waive legal or integration-specific minimum protection; separate PRs #630/#655 remain outside this release unless explicitly approved and tested.

## Evidence record / no-go confirmation

**Public URLs:** `https://www.carmazium.com/terms`, `https://www.carmazium.com/privacy-policy`. Source: CarMazium default branch as of 10 Nov and draft contract branch Revision 8. CarMazium Supabase project `bwtnzmevjlowwronylxm`, read-only aggregates. No sample row, VRM, photo, name, credential, API secret or seller personal data copied into this file.

**Current release decision: NO-GO.** Do not set `PARTNER_API_SIMPLEDMS_PRODUCTION_APPROVED=true`; do not issue a key, send customer data, turn on AI, launch dealer visibility, merge/deploy the partner release branch or start the pilot from this document.

**Approval / operator references (blank):**
- CarMazium director Article 6/DPIA and exact execution pack: ____________________ date __________
- SimpleDMS director Article 6/DPIA and exact pack: ____________________ date __________
- Pre-key controlled test acceptance and channel authorisation: ____________________ date __________
- Post-key production acceptance: CarMazium __________ SimpleDMS __________ date __________
- Bilateral Pilot Launch Date written approvals: CarMazium __________ SimpleDMS __________ start __________

