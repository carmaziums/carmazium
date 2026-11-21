# CarMazium Master Business Partner Agreement — controlled release

**Status:** DRAFT / LEGAL REVIEW REQUIRED. This document is an engineering release plan, not legal approval.

## Scope
PR #970 delivers a business-to-business clickwrap agreement for dealer and contractor Partner Accounts. It is deliberately distinct from the consumer Platform Terms. The legal agreement source is `backend/src/partner-agreement/partner-agreement.document.ts` with stable version `2026-11-21.1` and a runtime-computed SHA-256 hash.

## Absolute release gates
1. **Solicitor review:** An England & Wales qualified commercial solicitor with platform/automotive experience must review the complete contract, all six schedules and the precise binding customer screens. Confirm the correct CarMazium contracting entity, indemnity enforceability, liability and UCTA reasonableness, consumer CRA safeguards, data protection, payment services and commission terms, service insurance scope, marketing licences, jurisdiction, existing-account transition, and the final signature/evidence format. Material changes require a *new document version*, not silent editing of an already accepted version. Record legal sign-off securely.
2. **Schema:** Back up the database, verify permissions and apply `backend/prisma/manual-migrations/20261121_partner_agreement_acceptances.sql` first. Confirm the ledger has RLS enabled and `anon`/`authenticated` cannot insert/update/delete. Do not erase acceptance records when rolling back app code; retention needs a lawful policy.
3. **Backend QA:** `npx prisma generate`, `npx tsc --noEmit -p tsconfig.json`, complete backend tests and a disposable PostgreSQL integration run. Test signatory KYC identity matching and anonymous/consumer/staff/admitted provider behavior. Ensure existing paid jobs, chargebacks, disputes, refunds, data export and account deletion still work without a new signature.
4. **Frontend/native QA:** Complete web and Android typechecks, registration via password/Google/Apple, business-owner signing, signed receipt display, offline states, old app compatibility and accessibility. Release the native Android APK through the **existing site-linked CarMazium application** rather than any new sandbox or testing package. Confirm app update / build number and public download artifact.
5. **Coordinated activation:** On staging, set backend `PARTNER_AGREEMENT_ENFORCE=true` and `PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE=true`; build website with `NEXT_PUBLIC_PARTNER_AGREEMENT_SIGNING_ENABLED=true`; build Android with `EXPO_PUBLIC_PARTNER_AGREEMENT_SIGNING_ENABLED=true`. Confirm database migration and the same document SHA on all clients. Production values remain false/absent until explicit release approval. Set both backend flags *only* after reviewed text and migrations are live, and the client build is published.
6. **Existing businesses:** On activation, existing dealers and business owners are asked to sign at their next relevant entry. Staff inherit the dealership owner's signature and may not sign for them. Do not prevent resolution of existing transactions or statutory account requests. Train customer support on permitted fallback access.
7. **Monitoring:** Watch new signups and OAuth completions, failed/duplicate signature attempts, rising 403 `BUSINESS_AGREEMENT_REQUIRED`, missing provider roles, unsigned bids, KYC mismatch errors, customer complaints, mobile access and live conversion. Roll back both backend feature flags if the agreement cannot be fetched or signed; retain the database evidence.

## Control semantics
- **Default OFF.** Backend signing and activity enforcement are inert until BOTH `PARTNER_AGREEMENT_ENFORCE` and `PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE` are exactly `true`. This prevents accidental production trader lockout if a branch is deployed early.
- Website and Android signup review prompts are build-time gated independently. Do not set them true ahead of backend activation except in staging.
- The full document is immutable per accepted version. No retroactive application to already completed transactions.
- All signature fields are sent only to the authenticated API, never to marketing pixels, logs containing secrets, or unrelated third parties.
- `PARTNER_AGREEMENT_IP_HASH_KEY` is optional. If used, it must be a high-entropy secret in backend secret storage; no raw IP addresses are stored in the acceptance ledger. Review lawful basis, privacy notices and retention.
- The signed acceptance uses server-generated ID and timestamp and stores account ID, business owner ID, legal entity/name, business kind, company number where applicable, signer name/capacity, document version/hash and affirmative acceptance/authority evidence.

## Cases to recheck manually
- New verified company, unverified company awaiting KYC, sole trader, contractor-only legacy Partner, dealership staff, personal buyer/seller, platform admin.
- Changing legal company or sole trader details after signing, including company-registration mismatch after KYC approval.
- Google/Apple sign-up and native deep links, especially reinstall and a valid existing session after process restart.
- Accepting a new agreement version without falsely overriding historical receipt or cancelling active bookings.
- Old Android installations pointing at the newly enforced API; communicate upgrade path before activation.
- Existing unread disputes, refunds, sales, jobs in progress, overdue payouts, active auctions, and legal data requests.

## Unresolved
A lawyer's approval and signed legal opinion have **not** been obtained in this workflow. No assistant assertion or automated test may be substituted for that review. This is not permission to merge or enable enforcement automatically.
