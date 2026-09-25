# CarMazium One Product — Final Parity Certification

**Date:** 25 September 2026  
**Scope:** Website + native mobile app + shared NestJS backend  
**Programme progress:** **100% — Blocks 1–10 complete**  
**Release state:** **CODE + LIVE WEB CERTIFIED / NATIVE STORE RELEASE HELD FOR EXTERNAL EVIDENCE**

## Executive result

The revalidated repository has a closed machine-readable parity contract:

- **54 required cross-platform features**
- **2 approved web-only features**
- **0 unresolved `gap` entries**
- **0 `web_only_candidate` entries**

The required features cover authentication and role boundaries, public marketplace journeys, seller/buyer/dealer/Partner workflows, Registered Company / Sole Trader dealer KYC, legacy Finance/Insurance partner operations, pricing and payment semantics, auctions, service jobs, HPI, chat/notifications, navigation/deep links, terminology, accessibility/state consistency, performance safeguards, business-role landing and the direct-to-seller vehicle-payment boundary.

The intentional web-only exceptions remain:

1. **`admin.operations`** — privileged internal back-office operations remain in the authenticated web admin console.
2. **`blog.seo`** — the public blog remains a web SEO/content surface and is not a transactional native-app journey.

These are documented platform choices, not unresolved parity defects.

## Block 10 certification gate

Block 10 adds a repeatable release-certification layer:

- `scripts/check-release-readiness.mjs`
- `npm run release:check`
- `npm run release:check:strict`
- `.github/workflows/release-certification.yml`

The normal gate certifies repository-controlled conditions. Strict mode additionally requires external facts that must never be invented in source control: real Apple submission identifiers and valid Apple/Android web-association files.

The Release Certification workflow runs the parity contract, release-readiness contract, web TypeScript, native Expo config + TypeScript, backend TypeScript, full backend Jest tests and backend build. Manual dispatch also performs live production web-route and Fly.io health checks; strict manual dispatch then requires the deployed Universal Link / App Link association documents.

## Revalidation after the Block 9 checkpoint

While Block 10 was being prepared, PR #250 merged Registered Company / Sole Trader KYC support into `main`. Certification was restarted from that newer main rather than accepting the earlier Block 9 baseline.

Block 10 therefore adds `dealer.kyc_business_type` to the parity manifest and guards that:

- web and native expose both Registered Company and Sole Trader choices;
- business type is carried from onboarding into KYC;
- sole traders are not forced through Companies House-only fields;
- sole traders require photo ID and proof of address;
- KYC evidence stays in the private KYC bucket;
- first-time uploads attach to a draft KYC row;
- unpaid drafts are excluded from actionable admin review.

The final manifest count is consequently 54 required features, not the earlier 53.

## Production evidence

The current-main production baseline used for Block 10 is:

`main@cc568dec50fbcfba5acb4bbc4cca2fe0ad8e732e`

Vercel deployment:

`dpl_7LVPAMqfm8LupJj9GXwEvCNmgieE`

The deployment is **READY** and mapped to the production domains. Its build error view contained no errors.

Direct production checks returned HTTP 200 for search, auctions, sell, pricing, login and signup after the sole-trader KYC merge.

For the checked first-hour window on that exact deployment, Vercel reported:

- 13 HTTP 200 responses
- 2 HTTP 304 responses
- no 4xx/5xx status groups
- no warning/error/fatal log entries

A wider project-level query still contains historical Fly.io connection-reset/timeout events from prior deployments. Those are documented as a reliability caveat; they were not present in the checked current-main deployment window.

Detailed evidence is in `docs/parity/BLOCK10_RELEASE_EVIDENCE.md`.

## Matched journey result

| Journey | Shared backend | Web | Native | Result |
| --- | --- | --- | --- | --- |
| Authentication / onboarding / verification | Yes | Yes | Yes | Covered |
| Public marketplace / search / detail | Yes | Yes | Yes | Covered + live web observed |
| Retail + auction listing creation | Yes | Yes | Yes | Covered |
| Seller offers / handover / earnings | Yes | Yes | Yes | Covered |
| Auction bidding / winner fee / post-win contact | Yes | Yes | Yes | Covered |
| Verified inspection → refusal → £125 refund | Yes | Yes | Yes | Covered |
| Dealer identity / staff RBAC | Yes | Yes | Yes | Covered |
| Registered Company / Sole Trader KYC | Yes | Yes | Yes | Covered + guarded |
| Dealer inventory / CRM / offers / purchases | Yes | Yes | Yes | Covered |
| Partner capabilities / verification / matching | Yes | Yes | Yes | Covered |
| Provider jobs / quotes / lifecycle / chat | Yes | Yes | Yes | Covered |
| Finance / Warranty matched enquiries | Yes | Yes | Yes | Covered |
| Legacy Finance Partner operations | Yes | Yes | Yes | Covered |
| Legacy Insurance Partner operations | Yes | Yes | Yes | Covered |
| Stripe platform charges / reconciliation | Yes | Yes | Yes | Covered |
| Vehicle purchase money paid directly to seller | Yes | Yes | Yes | Regression guarded |
| Seller £100 reward / provider payout lifecycle | Yes | Yes | Yes | Covered |
| HPI report entitlements | Yes | Yes | Yes | Covered |
| Notifications / direct-open chat routing | Yes | Yes | Yes | Covered |
| Public deep links / authenticated back stack | Yes | Yes | Yes | Code covered; external associations pending |
| Loading / empty / error / offline states | Shared rules | Yes | Yes | Static guard covered |
| Accessibility semantics | Shared invariants | Yes | Yes | Static guard; device evidence pending |
| Performance baseline | Shared invariants | Yes | Yes | Static guard; device evidence pending |

## Blocks 1–10

### Blocks 1–4
Production reliability, auction/listing integrity, sales lifecycle and the core shared product contract were repaired and placed behind authoritative backend rules.

### Block 5 — Buyer
Buyer business rules were aligned, including auction fee reconciliation, the 72-hour payment deadline and verified linked-inspection refusal/refund behavior.

### Block 6 — Dealer
Dealer staff use one canonical dealership identity and both clients consume the backend permission model.

### Block 7 — Partner / TradeXchange
Partner capabilities, verification, matching, provider jobs, Finance/Warranty enquiries and service-job messaging are available across clients.

### Block 8 — Payments / HPI / chat / notifications
Payment reconciliation, exactly-once payout controls, HPI entitlements and notification/chat routing were hardened.

### Block 9 — Website ↔ native parity
Finance/Insurance partner native workspaces and Contractor landing were corrected, direct-to-seller payment behavior was fail-closed, and the parity manifest reached zero gaps.

### Block 10 — End-to-end certification / release gate
The current production web deployment was inspected, the concurrent sole-trader KYC change was incorporated into parity, and certification became a repeatable CI/manual gate with a separate strict external-release stage.

## External native release evidence still required

These items prevent a truthful **native store-release PASS** even though the ten-block programme is complete:

1. **Android App Links:** `/.well-known/assetlinks.json` currently returns 404; the real release-signing SHA-256 fingerprint is not in the repository.
2. **Apple Universal Links:** `/.well-known/apple-app-site-association` currently returns 404; the real Apple Team/app identifier is not in the repository.
3. **iOS submit settings:** `eas.json` still contains placeholder Apple ID / App Store Connect app ID / Apple Team ID values.
4. **Signed store artefacts:** no signed AAB / iOS archive was produced in this session because release credentials are external.
5. **Physical-device evidence:** push delivery/tap routing, haptics, gestures, Payment Sheet, screen-reader behavior and device performance remain device-level checks.
6. **Native crash telemetry:** the EAS production profile has a placeholder Sentry DSN and the native dependency graph has no Sentry integration.

The strict release gate intentionally fails until the relevant external facts are supplied.

## Final decision

**One-product correction programme:** PASS — **100% / Blocks 1–10 complete**.  
**Code parity:** PASS.  
**Manifest parity:** PASS — **54 required, 2 approved web-only, zero unresolved gaps**.  
**Checked current-main production website:** PASS.  
**Regression/release gate:** ESTABLISHED.  
**Native App Store / Google Play release certification:** **HOLD pending external signing, association and physical-device evidence**.

“100%” means the requested ten-block audit/correction/certification programme is complete. It does not convert missing Apple/Google credentials or unperformed physical-device checks into passes.
