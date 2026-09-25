# Block 10 Release Evidence — 25 September 2026

## Scope

Certification baseline after the concurrent sole-trader KYC merge:

- Repository: `carmaziums/carmazium`
- Current `main`: `cc568dec50fbcfba5acb4bbc4cca2fe0ad8e732e`
- Change included after Block 9: PR #250, Registered Company / Sole Trader Partner/dealer KYC
- Vercel production deployment: `dpl_7LVPAMqfm8LupJj9GXwEvCNmgieE`

Block 10 distinguishes repository-controlled certification from external store/signing evidence. Missing credentials, signing identities or physical-device results are never inferred as passes.

## Production web evidence

The current-main Vercel deployment was reported **READY** and targets production. Its aliases include `carmazium.com` and `www.carmazium.com`.

The Vercel build error view contained no build errors.

Direct production fetches after the sole-trader KYC deployment returned HTTP 200 for:

- `/search`
- `/auctions`
- `/sell`
- `/pricing`
- `/auth/login`
- `/auth/signup`

For the checked first-hour window on the exact current-main production deployment, Vercel runtime counts were:

- HTTP 200: 13
- HTTP 304: 2
- no 4xx/5xx status-code groups
- no warning/error/fatal log entries

The initial request paths observed on that deployment included `/`, `/sell`, `/cookie-policy` and `/icon.png`.

A broader project-level 24-hour runtime-error query previously showed historical `fetch failed` / Fly.io connection-reset and timeout events on older deployments. Those events are retained as a reliability caveat rather than treated as impossible to recur; they were not present in the checked current-main deployment window.

## One-product contract

Block 10 revalidated the manifest after PR #250 rather than certifying the pre-KYC tree.

Final manifest state on the Block 10 branch:

- **54 required web/native features**
- **2 approved web-only exceptions**
- **0 unresolved `gap` entries**
- **0 `web_only_candidate` entries**

The new `dealer.kyc_business_type` feature explicitly covers the Registered Company / Sole Trader branch on web and native. CI also checks the backend requirements that make the branch truthful:

- sole traders are not forced through Companies House evidence
- sole traders require photo ID + proof of address
- KYC documents use the private `dealer-kyc-documents` bucket
- first-time document uploads attach to an unpaid draft instead of becoming orphaned
- unpaid drafts stay out of the actionable admin review queue

## Release controls added in Block 10

- `scripts/check-release-readiness.mjs`
- `npm run release:check`
- `npm run release:check:strict`
- `.github/workflows/release-certification.yml`

The normal PR gate checks repository-controlled readiness and reports external requirements as warnings. The strict manual release gate turns those external requirements into hard failures.

The Release Certification workflow runs:

- one-product parity check
- release-readiness check
- web TypeScript
- native Expo config resolution
- native TypeScript
- backend TypeScript
- full backend Jest suite
- backend build

Manual release dispatch additionally performs production-route checks and calls the Fly.io `/health` endpoint.

## External native release blockers

### Android App Links

Native configuration declares auto-verified HTTPS links for both production hosts, but production currently returns **404** for:

`https://www.carmazium.com/.well-known/assetlinks.json`

The real release-signing SHA-256 certificate fingerprint is not stored in the repository, so Block 10 does not manufacture this file.

### Apple Universal Links

Native configuration declares associated domains for both production hosts, but production currently returns **404** for:

`https://www.carmazium.com/.well-known/apple-app-site-association`

The real Apple Team/app identifier is not stored in the repository, so Block 10 does not manufacture this file.

### Store submission identifiers

The production iOS submit profile in `eas.json` still contains placeholders for:

- Apple ID email
- App Store Connect app ID
- Apple Team ID

Android declares a Google Play service-account path; the credential file is external and intentionally must not be committed.

### Signed artefact and device evidence

A signed Android AAB / iOS store archive was not produced in this session because release credentials are external. Physical-device verification is also still required for claims that cannot be established from repository/Vercel evidence, including:

- background/killed-state push delivery and tap routing
- haptics and touch gestures
- native Stripe Payment Sheet presentation
- screen-reader behavior
- device memory/scroll performance
- installed universal/app links after the association files are published

### Crash telemetry

The EAS production profile contains a placeholder Sentry DSN while the native dependency graph does not currently include a Sentry integration. Native crash telemetry is therefore **not certified**.

## Decision

**Ten-block one-product programme:** complete at the code-contract and live-web level.

**Native store release:** HOLD until the strict external gate can pass.

The strict gate is expected to remain red until the actual Apple/Google signing/store facts and the two deployed web-association files are supplied. This is an explicit release dependency, not an unresolved web/native feature-parity defect.
