# Issue #477 — Post-Block-10 isolated native QA readiness

Date: 10 October 2026. **Status: safe build path prepared; no staging backend validated; no current Android/iOS build produced; visual release remains NO-GO.**

## What we verified

- CarMazium [PR #487](https://github.com/carmaziums/carmazium/pull/487) was merged after successful source checks, on main commit `98dab6e1a5fb57a121b15138c114097bba90a927`. The previous ten blocks remain preserved.
- Production app `carmazium app/carmazium app/app.json` uses Android package and iOS bundle `uk.carmazium.app`, a production Expo EAS project, production-domain deep links, and Expo OTA updates.
- Existing `eas.json` `preview`/development/production profiles all point to the **live Fly** API, live Supabase project and **live Stripe publishable key**. The read-only flag in `src/lib/apiClient.ts` blocks ordinary non-GET requests in one API helper, but is not a platform-wide proof that every SDK or direct fetch is mutation-proof. **Do not use preview for synthetic KYC, bids, payments or customer edits.**
- A **separate Supabase project named CarMazium Development exists**, but its public schema lists `profiles`, `listings` etc. The Nest backend Prisma model expects `users`, `seller_profiles` and other specific relational tables; the backend also needs matching migrations, auth/user identities, storage, service secrets and configuration. Therefore **the existing development project is not confirmed compatible** and must not be plugged into the Fly backend blindly. It already contains a small number of rows and functions; do not wipe or overwrite it. No destructive migration or production credential changes were made.
- A separate **QA Nest/Fly API endpoint connected to its OWN compatible QA database** has not been identified or approved. Expo QA signing/project credentials and Apple simulator availability are unconfirmed. No safe new APK/iOS artifact was created.

## What's implemented in this branch

1. `scripts/prepare-native-isolated-qa.mjs` has a pure validation function and CI-only ephemeral `--prepare` mode. The validator REJECTS the production Fly API/site, production Supabase, production Expo project ID, live Stripe publishable keys, missing inputs and missing explicit approval of an isolated synthetic environment. It also requires an HTTPS host explicitly labelled QA/staging/test. No values or secrets are printed.
2. On a **temporary GitHub Actions checkout only**, it generates `CarMazium QA` with separate Android/iOS identity `uk.carmazium.qa`, a distinct EAS project, `qa-isolated` channel, `EXPO_PUBLIC_QA_READ_ONLY=1`, `EXPO_PUBLIC_QA_ISOLATED=1`, TEST Stripe key and isolated Supabase/API endpoints. It disables OTA updates, production domain association, and all Android deep-link intent filters. **Source-controlled app.json/eas.json and production EAS profiles are never changed.**
3. `.github/workflows/carmazium-isolated-visual-qa.yml` is manual `workflow_dispatch` only — no automatic builds, OTA, Play Store or TestFlight submission. Requires owner-configured GitHub vars and QA Expo token, calls `/health/ready` on dedicated staging API, typechecks native, then builds an internal Android APK or iOS simulator package via the ephemeral isolated profile. No credentials are printed and no private screenshots are uploaded. It cannot be triggered from this source-only QA audit without valid configuration.
4. `scripts/test-native-isolated-qa-preflight.test.mjs` verifies the failure cases, staging-only app IDs and successful ephemeral profile generation using **hypothetical** test fixtures. The test is wired into Release Certification. Passing CI **does not** establish that real staging exists, nor does it certify app visuals.
5. Existing `scripts/verify-native-visual-acceptance.mjs` from Block 10 remains a separate, stricter release gate requiring **matched website/Android/iOS screenshots at 360×800 and 390×844**, synthetic fixture states, independent review, accessibility, permissions, light-mode and AI-consent evidence.

## Inputs still required — not gathered or supplied

Configure these GitHub Actions values only **after** provisioning compatible isolated staging; do not use production or a database with real personal data:

| GitHub setting | Scope | Requirement |
| --- | --- | --- |
| `vars.CARMAZIUM_QA_API_URL` | Non-secret | Own HTTPS `qa`/`staging`/`test` host serving a health-ready isolated Nest backend |
| `vars.CARMAZIUM_QA_SUPABASE_URL` | Non-secret | Separate, approved compatible QA Supabase project |
| `secrets.CARMAZIUM_QA_SUPABASE_ANON_KEY` | Restricted configuration | Anonymous/public client key tied only to the QA Supabase project, never service-role |
| `vars.CARMAZIUM_QA_STRIPE_PUBLISHABLE_KEY` | Non-secret | `pk_test_` test-only publishable key |
| `vars.CARMAZIUM_QA_EAS_PROJECT_ID` | Non-secret | Separate Expo QA project UUID, not production |
| `vars.CARMAZIUM_QA_ISOLATED_CONFIRMED` | Approval flag | Exactly `YES_APPROVED_SYNTHETIC_ONLY`, only after isolation has been independently verified |
| `secrets.CARMAZIUM_QA_EXPO_TOKEN` | Secret | QA Expo account token with permission only for separate project |

**No values are collected or sent via the chat.** Configure through repository Settings → Secrets and variables → Actions. A Stripe TEST publishable key cannot make live financial writes by itself, but read-only app screens should still not attempt payments.

To run an approved nonproduction build, go to **GitHub → Actions → CarMazium isolated native visual QA (manual only) → Run workflow**, choose Android or iOS. Missing config fails closed. The workflow checks actual API health but **does not verify the server's underlying database tenancy**; that requires backend owner proof and synthetic fixture inspection BEFORE setting the approval flag. For iOS this is a simulator package, not an App Store/TestFlight release.

## Required acceptance still open

- Synthetic user accounts representing buyer, individual seller, dealer owner, dealer staff with varied permissions, contractor and provider roles, no real VRMs or personal records.
- Actual current-commit **Android APK installation** and **iOS simulator/device** QA; same browser/native screens, state, theme and viewport, matched side-by-side website captures.
- Native light appearance: currently static dark, website supports light; actual pixel parity is not solved by preparing QA environments.
- MaziuM assistant guest/consent/keyboard visual checks, current cross-client Saved/CRM/dealer navigation, seller fee copy and user accessibility at 200% fonts. Never perform production money/KYC/bid/handover operations.
- Run Block 10 private `verify-native-visual-acceptance.mjs` on the resulting real evidence. **NO-GO** until it approves.

## Rollback and boundaries

Based on merged PR #487 and all earlier 10 programme blocks. Revert only this QA readiness PR to remove the manual-only workflow/preflight scripts without changing native business behaviour. The production web/backend, Supabase projects, accounts, EAS credentials, signing, production GitHub vars/secrets and binaries are **untouched**.

**Stop at this safety checkpoint unless a genuinely compatible staging API and separate EAS access can be established.**
