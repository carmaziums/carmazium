# CarMazium Business Partner Agreement — backend deployment incident and MaziuM source review

Date: 21 November 2026. Production signing remains fail-closed. This document records the cause and scope of the reviewed backend repair.

## Incident

The signed production Android application (build 123, package `uk.carmazium.app`) restores a business-account session and opens the Master Business Partner Agreement screen, but cannot fetch the document, reporting `Cannot GET /legal/partner-agreement/document`. The live Fly API also returned HTTP 404 for `/legal/partner-agreement/status`.

The corresponding public document controller and authenticated status/acceptance actions exist on `main` in `backend/src/partner-agreement`, but the last successful Fly backend deployment predates that code. The first main-branch backend deployment including the controller failed its MaziuM model-evaluation gate at two synthetic questions (MZ-011 and MZ-017, both dealing with unverified dealer bidding). The follow-on Fly deploy was correctly skipped. Re-running the failed jobs produced the same two failures. No quality gate was bypassed.

## Signing database safety

Read-only inspection of the actual CarMazium Supabase database showed that `public.partner_agreement_acceptances` already exists with the expected 16 fields and zero accepted signatures. RLS is enabled, and the `anon`, `authenticated`, and `service_role` Data API roles have no direct SELECT grant. The application uses an authenticated backend service to check owner identity and record signatures; no database schema changes or user signatures were made during this incident review.

## Narrow MaziuM fallback repair

Changed exactly:
- `backend/src/ai/mazium-auction-eligibility.ts`: new `blockedDealerTradingGuidance` for short, anonymous, one-topic questions about blocked dealer bidding/trading access. It explains verified dealership approval, staff bidding permission, the authorised owner's current Master Business Partner Agreement, and live auction status. It explicitly says the assistant has not checked the account.
- `backend/src/ai/ai.service.ts`: only after a model-generated route is rejected **even after repair**, use that verified guidance for this narrow anonymous topic instead of the unhelpful generic wrong-page response. Authenticated account-specific and complex multi-topic requests remain on the normal model/tool path and fail closed if navigation cannot be verified.
- Matching unit tests assert the exact two historical failed questions are answered, no unsupported URL is returned, and unrelated/complex requests do not trigger a canned answer.

**No changes** to legal agreement text, immutable version/SHA, signed owner authority, fee rules, payment logic, auction permissions, app binaries or public website APK.

## Knowledge source review

The MaziuM knowledge-source manifest tracks 72 source files. On Windows, native CRLF text conversion caused apparent drift in other files even though the GitHub repository content was unchanged. Comparing SHA-256 after normalising CRLF to repository LF showed **only `backend/src/ai/ai.service.ts`** differed. That file's new fallback logic was reviewed and its one SHA-256 fingerprint updated. The other 71 fingerprints remain untouched. The platform knowledge already describes dealer verification, bidding permissions and the required agreement accurately.

## Verification and deployment acceptance

- 57/57 targeted AI unit tests passed locally, including both previously failed model-evaluation prompts and the older wrong-route safety checks.
- Backend TypeScript typecheck passed.
- Full backend test run on Windows passed 2,205 tests; its sole reported failure was the knowledge-source audit operating on CRLF checkout files, explained above and verified with the normalised-source check.
- Source CI must still pass before merging PR #972.
- After merge, standard Backend CI and Fly Deploy must run its AI evaluation and safety/integration checks. Only a green run is authorised to update the production API.
- After deploy, confirm public agreement document HTTP 200 with exact full text, version and SHA-256; GET status and POST acceptance must reject anonymous requests. Confirm signingEnabled and completed legal-review configuration before an authorised business owner signs.
- Reopen the agreement in the existing Android app and confirm the document, required legal fields, two affirmative declarations, and Accept & Electronically Sign action appear for an eligible business owner. Do not sign on their behalf or modify records.
