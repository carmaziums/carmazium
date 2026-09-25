# CarMazium One Product — Final Parity Certification

**Date:** 25 September 2026  
**Scope:** Website + native mobile app + shared NestJS backend  
**Programme progress:** **100% — Blocks 1–10 complete**  
**Release state:** **CODE + LIVE WEB CERTIFIED / NATIVE STORE RELEASE HELD FOR EXTERNAL EVIDENCE**

## Executive result

The repository now has a closed machine-readable parity contract:

- **54 required cross-platform features**
- **2 approved web-only features**
- **0 unresolved `gap` entries**
- **0 `web_only_candidate` entries**

The required features cover authentication and role boundaries, public marketplace journeys, seller/buyer/dealer/Partner workflows, registered-company/sole-trader KYC, legacy Finance/Insurance partner operations, pricing and payment semantics, auctions, service jobs, HPI, chat/notifications, navigation/deep links, terminology, accessibility/state consistency, the performance baseline, business-role landing and the direct-to-seller vehicle-payment boundary.

The two intentional web-only exceptions remain:

1. **`admin.operations`** — privileged internal back-office operations remain in the authenticated web admin console.
2. **`blog.seo`** — the public blog remains a web SEO/content surface and is not a transactional native-app journey.

These are documented exceptions, not unresolved parity defects.

## Block 10 release gate

Block 10 adds a repeatable release-certification layer instead of relying on an audit document alone:

- `scripts/check-release-readiness.mjs`
- `npm run release:check`
- `npm run release:check:strict`
- `.github/workflows/release-certification.yml`

The default release-readiness check certifies everything controlled by repository state. Strict mode additionally requires external distribution evidence that the repository must not invent: real store identifiers and valid Apple/Android web-association files.

The Release Certification workflow runs:

- one-product parity contract
- code-controlled release-readiness contract
- web TypeScript
- native Expo config resolution + TypeScript
- backend TypeScript
- full backend Jest suite
- backend build

A manual workflow-dispatch release run also checks production web routes and the Fly.io backend health endpoint. Its strict option then requires the deployed Android Digital Asset Links and Apple app-site-association evidence.

## Matched journey coverage

| Journey | Shared backend contract | Web | Native | Certification |
| --- | --- | --- | --- | --- |
| Authentication / onboarding / verification | Yes | Yes | Yes | Code covered |
| Public marketplace / search / detail | Yes | Yes | Yes | Code + production web observed |
| Retail + auction listing creation | Yes | Yes | Yes | Code covered |
| Seller offers / handover / earnings | Yes | Yes | Yes | Code covered |
| Auction bidding / winner fee / post-win contact | Yes | Yes | Yes | Code covered |
| Verified inspection → refusal → £125 refund | Yes | Yes | Yes | Code covered |
| Dealer identity / staff RBAC | Yes | Yes | Yes | Code covered |
| Dealer inventory / CRM / offers / purchases | Yes | Yes | Yes | Code covered |
| Partner capabilities / verification / matching | Yes | Yes | Yes | Code covered |
| Provider jobs / quotes / lifecycle / chat | Yes | Yes | Yes | Code covered |
| Finance / Warranty matched enquiries | Yes | Yes | Yes | Code covered |
| Legacy Finance Partner operations | Yes | Yes | Yes | Code covered |
| Legacy Insurance Partner operations | Yes | Yes | Yes | Code covered |
| Stripe platform charges / reconciliation | Yes | Yes | Yes | Code covered |
| Vehicle purchase money paid directly to seller | Yes | Yes | Yes | Regression guarded |
| Seller £100 reward / provider payout lifecycle | Yes | Yes | Yes | Code covered |
| HPI report entitlements | Yes | Yes | Yes | Code covered |
| Notifications / direct-open chat routing | Yes | Yes | Yes | Code covered |
| Public deep links / authenticated back stack | Yes | Yes | Yes | Code covered; web-association release evidence pending |
| Loading / empty / error / offline states | Shared rules | Yes | Yes | Static guard covered |
| Accessibility semantics | Shared invariants | Yes | Yes | Static guard covered; physical assistive-tech pass pending |
| Performance baseline | Shared release invariants | Yes | Yes | Static guard covered; physical native measurements pending |

## Block results

### Blocks 1–4 — foundation
Production reliability, auction/listing integrity, sales lifecycle and the core product contract were repaired and brought under shared backend rules.

### Block 5 — Buyer
Buyer business rules were aligned, including winner-fee reconciliation, the 72-hour payment deadline and the verified linked-inspection refusal path.

### Block 6 — Dealer
Dealer staff operate through one canonical dealership identity. Backend permissions and both clients consume the same dealership-scoped rules.

### Block 7 — Partner / TradeXchange
Partner Account, capabilities, verification, matching, provider jobs, Finance/Warranty enquiries and service-job messaging are represented on both clients.

### Block 8 — Payments / HPI / chat / notifications
Hosted/native payment reconciliation, exactly-once seller/provider settlement controls, HPI entitlements and notification/chat routing were hardened.

### Block 9 — Website ↔ native parity
The 25 September revalidation closed a real business-role gap: Finance Partner and Insurance Partner accounts now have operational native work queues/settings instead of an identity-only page, and Contractor accounts enter the Partner workspace. Native payment routing also fails closed so stale routes cannot silently become commission charges. The manifest expanded to 54 required features.

### Block 10 — End-to-end certification / release gate
The exact Block 9 production web deployment was inspected and the release process was converted into a repeatable CI/manual gate. Repository-controlled parity is now regression-blocking, and external store/signing requirements are explicitly separated from code certification rather than being guessed.

## Production evidence captured on 25 September 2026

Vercel production deployment `dpl_7se2wNde31k45iyy3WRBvetZeNGJ` is tied to:

`main@cc568dec50fbcfba5acb4bbc4cca2fe0ad8e732e`

It was reported **READY** and aliased to both production domains.

Direct production fetches returned HTTP 200 for the homepage, search, auctions, sell, pricing, about, login and signup surfaces.

For the checked two-hour window on that exact deployment, Vercel reported:

- 139 responses with HTTP 200
- 2 responses with HTTP 304
- no 4xx/5xx status-code groups

Observed production paths included public marketplace routes, authenticated dashboard routes, a live-auction detail route and a vehicle-detail route.

The Vercel build error view contained no build errors for that deployment.

A project-wide 24-hour runtime-error query still contained older Fly.io connection-reset/timeout events from earlier deployments. The checked Block 9 deployment itself had no warning/error log entries in the inspected window. This is recorded as current deployment evidence, not a claim that upstream networking can never recur.

Detailed evidence is in `docs/parity/BLOCK10_RELEASE_EVIDENCE.md`.

## External native release evidence still required

These items prevent a truthful **native store-release PASS**, even though the one-product programme itself is complete:

1. **Android App Links:** `/.well-known/assetlinks.json` currently returns 404. The repository does not have the real release-signing SHA-256 fingerprint.
2. **Apple Universal Links:** `/.well-known/apple-app-site-association` currently returns 404. The repository does not have the real Apple Team/app identifier.
3. **iOS submission:** `eas.json` still contains placeholder Apple ID / App Store Connect app ID / Apple Team ID values.
4. **Signed store artefacts:** no signed Android AAB or iOS archive was produced during this certification session because release credentials are external.
5. **Physical-device evidence:** haptics, gestures, Stripe Payment Sheet, background/killed-state push/deep-link handling, native screen-reader behavior and device performance remain physical-device checks.
6. **Native crash telemetry:** the EAS profile contains a placeholder Sentry DSN while the native dependency graph has no Sentry integration; crash telemetry is therefore not certified.

The strict release command intentionally fails until the relevant repository-controlled external identifiers/association files are supplied.

## Final decision

**One-product correction programme:** PASS — **100% / Blocks 1–10 complete**.  
**Code parity:** PASS.  
**Manifest parity:** PASS — 54 required, 2 approved web-only, zero unresolved gaps.  
**Production website on the checked Block 9 deployment:** PASS.  
**Regression CI / release gate:** ESTABLISHED.  
**Native App Store / Google Play release certification:** **HOLD pending external signing, association and physical-device evidence**.

“100%” here means the requested ten-block audit/correction/certification programme is complete. It does **not** mean that missing Apple/Google signing credentials or unperformed physical-device tests have been treated as passed.
