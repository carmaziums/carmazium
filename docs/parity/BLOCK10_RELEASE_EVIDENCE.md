# Block 10 Release Evidence — 25 September 2026

## Scope

Baseline: `main@cc568dec50fbcfba5acb4bbc4cca2fe0ad8e732e` (Block 9 merged).

This record separates evidence that was directly verified from release evidence that still depends on external signing credentials or physical devices.

## Verified production web evidence

Vercel production deployment:

- Project: `carmazium`
- Deployment: `dpl_7se2wNde31k45iyy3WRBvetZeNGJ`
- Git ref: `main`
- Git SHA: `cc568dec50fbcfba5acb4bbc4cca2fe0ad8e732e`
- Deployment state: `READY`
- Production aliases include `carmazium.com` and `www.carmazium.com`
- Vercel build error log: no build errors

Direct production fetches returned HTTP 200 for:

- `/`
- `/search`
- `/auctions`
- `/sell`
- `/pricing`
- `/about`
- `/auth/login`
- `/auth/signup`

The authenticated `/dashboard` route also returned HTTP 200 and rendered the expected client-side authentication loading shell for an anonymous request.

For the checked two-hour window on the exact Block 9 production deployment, Vercel runtime counts were:

- HTTP 200: 139
- HTTP 304: 2
- No 4xx/5xx runtime status groups on that deployment

Observed request paths included `/sell`, `/search`, `/pricing`, `/auctions`, `/dashboard`, `/dashboard/user`, a live auction detail route, and a public vehicle detail route.

A project-wide 24-hour runtime-error query still contained historical `fetch failed` / Fly.io connection-reset and timeout events from older deployments. Those errors were not present in the warning/error logs for the exact Block 9 production deployment during the checked window. This is evidence of current deployment health, not proof that upstream networking can never recur.

## Repository release evidence

The one-product manifest at the Block 9 baseline contains:

- 54 required web/native features
- 2 approved web-only exceptions
- 0 unresolved `gap` entries
- 0 unresolved `web_only_candidate` entries

Block 10 adds:

- `scripts/check-release-readiness.mjs`
- `npm run release:check`
- `npm run release:check:strict`
- `.github/workflows/release-certification.yml`

The release workflow repeats parity, web TypeScript, native Expo-config resolution + TypeScript, and backend TypeScript + full Jest + build. A manual workflow-dispatch run also performs live web-route and Fly.io health checks.

## External blockers found during Block 10

These are not hidden or inferred as passes.

### Universal links / Android App Links

The native app correctly declares:

- iOS associated domains for `carmazium.com` and `www.carmazium.com`
- Android auto-verified HTTPS intent filters for both hosts

But the production website currently returns **404** for:

- `https://www.carmazium.com/.well-known/assetlinks.json`
- `https://www.carmazium.com/.well-known/apple-app-site-association`

The repository does not contain either association file. The real Android release-signing SHA-256 fingerprint and Apple Team/app identifier must be supplied before these files can be generated truthfully.

### Store submission

`eas.json` still contains placeholder iOS submit values:

- Apple ID email
- App Store Connect app ID
- Apple Team ID

Android declares a Google Play service-account path, but the credential itself is external and intentionally not committed.

### Signed device evidence

A signed Android/iOS store build was not produced in this session because the release credentials and signing artefacts are external to the repository. Physical-device checks (push delivery, haptics, gestures, Payment Sheet, background/killed-state navigation and native accessibility) also cannot be certified from repository or Vercel evidence.

### Native crash telemetry

The production EAS profile contains a placeholder Sentry DSN, but the native dependency graph does not currently include Sentry. Block 10 therefore treats native crash telemetry as **not certified**, not as a working integration.

## Release decision

### One-product programme
**COMPLETE at the code-contract and live-web level.**

### Production website
**PASS for the checked Block 9 deployment.**

### Native store release
**HOLD — external release evidence required.**

The strict release gate is deliberately expected to fail until the real signing/store identifiers and both deployed universal-link association files exist. A green ordinary PR gate is not equivalent to a green strict store-release gate.
