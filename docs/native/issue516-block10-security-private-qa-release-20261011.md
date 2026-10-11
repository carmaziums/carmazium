# Issue #516 — Block 10/10: final security and release-gate handover

Date: 2026-10-11. **Source completion under review. Not a production release.**

## Code changes implemented
- #521 security remediation on `POST /damage/:listingId/save`: `SessionAuthGuard` principal is passed into `DamageAnalysisService` and independently checked against actual DB user/role and listing seller inside the Prisma interactive transaction **before any delete/create/update**.
- Permitted: owning seller (BUYER role may list their own car), authenticated administrator, active dealer ADMIN/SALES_AGENT from the **correct dealership** with inventory-management permission. Excluded: unowned/nonexistent listing, other customer, inactive staff, finance-only staff, soft-deleted accounts, unauthenticated request. Client-controlled seller/role claims are not trusted.
- Input checks: maximum 100 defects, valid deduplicated UUIDs, IDs not belonging to another listing, bounded part/type/size and finite 2D/3D coordinates, valid view values, permanent HTTPS damage photo on configured Supabase origin in actual seller's folder, or exact photo URL already linked to that listing. Reject `file://`, foreign seller storage, arbitrary external proof and photo fragments.
- Damage set replacement and automatic exterior grade update now take place inside the same interactive transaction as the DB principal/listing checks. Failure rolls back any partial changes.
- GET public buyer records allowed for ACTIVE/OFFER_ACCEPTED/SOLD; unlisted DRAFT/REJECTED/WITHDRAWN details require authenticated owner, permitted dealer staff or admin. Missing/restricted listings return NotFound.
- Camera permission fix: `app.json` no longer blocks `android.permission.CAMERA`, `expo-image-picker` explains on-demand camera access; RECORD_AUDIO permission stays blocked and microphone picker permission remains false.
- Backend `src/damage/damage.security.spec.ts`: synthetic owner vs outsider/BUYER, authorized staff vs inactive/wrong role, admin, soft delete, cross-listing IDs, foreign/photo/local URI, legacy proof and private GET tests.
- Existing Block 5 backend tests adapted to the same authenticated transaction without dropping prior UUID/multi-defect assertions.
- `scripts/test-damage-block10-security-release-gates.test.mjs` checks code contracts, permission manifest and protected private QA workflow. Registered in One Product Parity & Release Certification. Security Jest suite added to backend parity CI.

## Private owner Android test build (not yet triggered by this PR)
A pre-existing workflow at `.github/workflows/carmazium-android-offline-qa-apk.yml` has a manual `workflow_dispatch`, separate `uk.carmazium.qa` Android package, disabled OTA updates, `EXPO_PUBLIC_QA_READ_ONLY=1`, local debug signing, 7-day private artifact retention, SHA256 checksum, and a Pixel 6 / Android 15 emulator launch/screenshot smoke job.

**Important:** Its test environment still points to the live CarMazium backend and auth system. QA_READ_ONLY guards mutation/photo upload in the app, but are NOT a security boundary: do not enter real credentials, upload customer images, bid, pay, or use real customer records in the QA build. Physical authenticated upload verification needs an isolated synthetic environment and explicit owner approval.

How owner may launch once the draft source is ready for private review:
1. Open GitHub Actions > **CarMazium Android standalone QA APK (no Expo credentials)**, click **Run workflow**.
2. Select **the reviewed source branch/commit** (not an older main build) and run once. Do not run the release or production workflow.
3. Wait for **Build read-only QA APK** to finish; only a successful workflow produces the `CarMazium-Android-QA` artifact and `CarMazium-QA-Emulator-Report`.
4. Download private ZIP, verify SHA256SUMS, extract `CarMazium-QA-Android.apk` and install locally. Compare screenshot and gestures on physical Samsung. Do not upload artifact to the public website.

**GitHub connection here cannot dispatch this workflow or physically install an APK**, so no verified APK is claimed in this code milestone. The workflow must be run by an authorized reviewer and results inspected. Source tests alone do not establish runtime QA.

## Absolute no-release gates
- Backend security issue #521 must pass CI, staging authenticated integration tests using truly separate owner/outsider/staff identities, independent reviewer validation and deployed backend check. Until deployment, the live endpoint remains vulnerable: leave issue open.
- Test actual private media upload with synthetic accounts and storage RLS; confirm photo URL is linked to exact record, survives edit/restart, appears on buyer side, retry and orphan cleanup follow expected retention without deleting live data.
- Verify seller surface tap vs drag, browser page scroll isolation, 3D controls/marker overlap, VoiceOver/TalkBack, font scaling, manufacturer body model variance on **real Android and iOS**.
- Verify QA workflow checkout SHA and emulator evidence; get explicit owner approval to merge **the ordered stacked PR chain** (#513 → #517 → #518 → #519 → #520 → #522 → #523 → #524 → #525 → #526 → Block 10 PR). Independently review any later changes to main to resolve conflicts. Do not force push production.
- Confirm restore/backout plan, publication moderation, auction vs retail listing fees, seller incentive, Stripe fee path and customer app/website parity unchanged. No destructive migration required.
- The stub `/damage/analyze` currently produces mocked demonstration results. **Do not market it as production AI inspection** or use its output as evidence without implementing an actual analysis model and consent/accuracy review.

## Final truthful status
**10/10 source blocks implemented** *if all CI checks pass*. **0/1 production release approved.**
Not shipped: source remains draft, no APK created in this step, no production backend deployed, no physical Samsung/iPhone verification. Do not mark #516 as a customer-complete release until remaining gates are signed off.

## Rollback
Stop rollout, close the draft PR chain or revert scoped commits in reverse order, retaining a verified rollback SHA and backup. No DB schema migrations were made by Blocks 1–10. Security guard should be deployed independently of the 3D UI (after staging) if production exposure needs urgent mitigation, without merging all customer UI at once.
