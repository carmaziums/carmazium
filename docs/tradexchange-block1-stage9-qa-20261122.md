# TradeXchange Block 1 — Stage 9 (80–90%) QA and removal verification

Date: 22 November 2026
Working branch: `feature/tradexchange-block1-consolidation-20261122`
Status: Stage 9 source QA complete; **no website or Android deployment**.

## Scope and corrections

- Retired provider setup pages remain redirect-only compatibility endpoints, not a second onboarding stack. The removed Android capability, matching and verification screens are still absent.
- Dealer and existing contractor records, applications, payouts, jobs, chat and historical documents remain attached to their existing backend contracts.
- Website and Android guided tours now open the single TradeXchange hub directly, rather than visiting obsolete capability or provider overview pages. Job feeds and assigned work remain separate working screens pending Block 2.
- Removed the unused helper that constructed obsolete verification-page links, while keeping capability ID/type validation for inline setup.
- Regenerated the public tour narration catalog for the changed wording.
- Verified the generated Android dashboard-attention modules against website sources and hardened the parity checks to normalize Windows/Unix line endings, without changing the decision rules.
- Corrected the Windows-incompatible path in the guided-tour regression test, and aligned the duplicated-services assertion with the actual consolidated Partner hub.
- Added Stage 9 regression tests for canonical guided-tour destinations, inline capability activation and preserved job/message routes.

## Verification

- **53/53** targeted website, TradeXchange, onboarding and guided-tour tests passed.
- **28/28** targeted Android provider, document, settings and continuity tests passed.
- Website and Android TypeScript checks passed (`tsc --noEmit`).
- One-product parity check passed.
- `git diff --check` passed.
- Next.js production build passed (exit code 0). Non-fatal local warnings indicated that Supabase image-upload environment variables were not provided in this checkout; production-authenticated upload still needs release validation.

## Preserved release gates for Stage 10

No automatic publishing, signed APK release, production database mutation, account replacement, app reinstall or removal of existing account data in Stage 9. Stage 10 must complete website and Android integration review, verify dealer and existing contractor onboarding on actual signed-in devices, verify mobile layouts and accessibility, confirm production build and release signing, then deploy verified website and original signed Android update. The user will inspect Block 1 at 100% before Block 2 begins.

Note: Source/static/component regression tests do not substitute for a production-authenticated full end-to-end job/identity/payment exercise.
