# CarMazium valuation Block 10 — end-to-end readiness and **whole ten-block rollback**

## Non-negotiable decision

**The user requires an exact path back to the valuation code that ran before Block 1 if they reject the complete upgrade.** Reverting only Block 9 or switching off auction calibration is insufficient. Treat Blocks 1–10 as **ONE coherent, reversible release**, not ten independently merged production changes.

**Original pre-programme source:** commit `741aaa35d605c151bfe31ad071fee279058c563f` on `valuation-legacy-baseline-before-blocks-20261002`. On 3 October, the original `vehicle-valuation.ts` blob was independently verified to match the main branch and this preserved SHA. The pinned commit SHA, not a mutable branch name, is the authoritative legacy reference. Do not remove the source branch or rewrite the baseline.

**Exact changed-file scope:** `backend/docs/valuation-release-manifest.json` records every file modified by PRs #348, #350, #352, #353, #354, #357, #359, #360 and #363, plus Block 10's regression, rollback scripts, CI and release documentation. Any new edits must update the manifest and rerun its candidate checker. Core legacy file blobs are also checked against the original baseline.

## One-release packaging required

1. Keep all ten implementation PRs in a **stacked, unmerged draft** chain while individual code and real-source staging validation are incomplete.
2. On completion, create a **single consolidated release-candidate branch** from the final Block 10 HEAD and one new **draft release PR** targeting `main`, titled exactly beginning with `CarMazium valuation release blocks 1-10`. Do not separately merge the underlying ten implementation PRs into production. A consolidated branch is a snapshot of the whole upgrade, not a new divergent implementation.
3. The consolidated PR must pass the six normal backend/web/mobile/chat/product/release workflows **plus** the `Valuation Whole-System Revert Gate`. That new gate runs a synthetic Git integration suite and checks exact source scope and untouched baseline anchors. Staging, credentials/rights and security audits require real evidence **in addition** to CI.
4. At the future, **separately authorised** rollout, record pre-release `main` full SHA, staging approval, baseline SHA, the exact consolidated PR HEAD, and pinned web/backend/native artefact IDs. Use GitHub's **Squash and merge** so `main` gets **ONE non-merge valuation-release commit** with the required title prefix. Never choose rebase or merge commit: the one-commit rollback guarantee depends on a single squash release.
5. Record the actual deployed **squash-merge commit SHA** plus the pre-release production Vercel deployment ID, Fly.io release/image ID, backend config snapshot (without logging secrets), and last compatible native builds. Do not confuse the stacked PR's HEAD SHA with the final squash SHA. Preserve signed native release archives and API-contract compatibility until rollback window expires.
6. Confirm `node scripts/valuation-rollback.mjs --verify-release <ACTUAL_SQUASH_SHA>` before declaring that the released bundle can be reversed automatically. Commit SHA and staging/release evidence must be attached to the approved release PR.

The release guard actively rejects files outside the recorded upgrade paths, any changed original valuation source anchor on the pre-release main parent, wrong release commit titles, a release merge commit with multiple parents, and unrelated post-release edits to the same valuation paths.

## Exact rollback procedure when requested

**Before the consolidated release is merged:** close or leave the ten draft PRs and draft release PR unmerged. No live valuation changes occurred. Existing production code remains unchanged. The baseline commit is retained as a source reference.

**After an approved single-squash production release:**

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c valuation-rollback/<actual-release-short-sha>

# The --verify check is read-only.
node scripts/valuation-rollback.mjs --verify-release <actual-40-character-release-squash-sha>

# Refuses main, a dirty tree, a non-squash release, changed baseline
# anchors and any later edits to the release's own files.
# Makes a staged revert; does NOT commit, push, reset main or deploy.
node scripts/valuation-rollback.mjs --prepare-revert <actual-40-character-release-squash-sha>

git diff --cached --stat
git diff --cached --check
# Then run the legacy backend/web/native builds, tests and API-contract
# compatibility checks before committing and opening the rollback PR.
```

The prepared staged revert restores the exact pre-programme content of each of the manifest's original legacy source anchors. New valuation-specific modules, tests, scripts and metadata disappear from the reverted code automatically. All changed files are rolled back as a **single reviewed unit**; unrelated post-release commits outside the valuation bundle remain untouched. The program never force-resets the production branch and never performs deployment or destructive data migration.

Run the old valuation sample portfolio and compare the prior programme's recorded vehicle results in staging. Keep the live system online while testing the rollback build against a **compatible, isolated staging backend/database** using synthetic records. If the staged revert differs from the original baseline at any anchor, the script stops and does **not** attest the rollback complete.

If any later deployment changed the **same** valuation files or altered APIs/migrations, the rollback script **refuses** automatic application. Preserve the intervening security/business fixes, reconcile the conflicts manually in a new rollback PR, verify the same legacy valuation behaviour through tests, then release. Do not claim a risky forced revert is identical merely because it compiles.

Only after rollback CI, independent staging rehearsal, security and a new approval should operators deploy the rollback web build and the rollback Fly.io image, and handle native apps appropriately. **App-store clients cannot necessarily be instantly downgraded.** Maintain overlapping old/new API compatibility, and use an approved OTA update or new signed older-feature app release if the native UI also needs restoring. Record both the old and the rollback deployment versions. Do not erase user accounts, auction data, payment history or previously frozen valuation event records; all ten implementation PR diffs contain **no Prisma schema migration**.

A separate narrower switch, `VALUATION_CALIBRATION_MODE=off`, reverts **only Block 9**, not the other nine blocks; never substitute it when the requested rollback is the **entire ten-block system**.

## Block 10 source-level regression scope

- **Vehicle identity and freeze:** valid verified VRM/model/year/mileage; inconsistent registration/mileage must fail closed, harmless make aliases must not fork the market base; repeat and simultaneous sessions share the verified frozen quote; edits never trigger another market search.
- **Search and evidence:** up to five live UK requests before up to five blended attempts, only then internal model; provider timeout and single-flight coalescing without unapproved caching; reject duplicate and mismatched-generation adverts; distinguish asking from achieved-sale evidence and show genuine source timestamps.
- **Channel prices and specification:** auction clearing estimates use only eligible completed handovers, not accepted bids; no fabricated private transactions; buyer and seller operational platform fees, reserve editing and auction-bid rules remain independent of optional price advice. Exterior defect grades increase every two defects, canonical aliases and feature caps are deterministic across backend, website and native app; changes use the same immutable base.
- **Confidence/calibration:** provisional price channels stay labelled provisional. Older snapshots have LOW/appropriate evidence and no bogus HIGH classification; no numeric success probability is asserted. Optional Block 9 uses prospective verified snapshots, seller-attested completion, individually audited transaction evidence, chronological later holdout and a strict default OFF. Unqualified cohorts, provider downtime or calibration timeout cannot alter the legacy prices.
- **Roll-forward and full rollback:** full integrated pure-code regression and synthetic local-Git single-squash test cover the original valuation before/after the changes, a later unrelated feature commit, rejection of unsafe mixed release paths and rejection of automatic rollback if a subsequent security patch overlaps the same files.

## What has and has NOT been verified against live infrastructure

**Verified source facts:** All nine earlier PRs remain unmerged drafts and depend on their preceding block. The baseline file SHA matches the preserved pre-programme commit. The rollback manifest covers every file in the nine earlier PR diffs. Block 10 adds new cross-block regression, reversible-release guard, synthetic Git proof and a separate GitHub Actions rollback gate.

**Read-only staging/infrastructure finding on 3 October 2026:** A separately named Vercel modernization staging project has historical READY deployments. Their returned deployment metadata did **not** establish deployment of the final Block 10 Git SHA. The separate pre-existing CarMazium Development Supabase project is healthy but its read-only information-schema inspection showed a different `auctions` shape (e.g. `winningBidderId` rather than Block 6's `winnerId`/approved handover fields) and no matching `analytics_events` table containing the frozen snapshot contract. This **is not a compatible staging environment** for these backend blocks as it currently stands. No paid Supabase branch was created or authorised. Do not migrate this existing development database or test personal customer records without separate, explicit infrastructure/data-migration review.

**Read-only development-project advisor findings:** The existing security advisor reported **53 warnings** about authenticated access to SECURITY DEFINER functions, **one warning** about leaked-password protection and one informational RLS/no-policy notice. These are **existing infrastructure observations**, not proof that this valuation change introduced vulnerabilities and not automatic permission to modify unrelated production functions. Conduct an owner/permission review and confirm the actual target project is secure before staging approval. Reference [Supabase SECURITY DEFINER lint](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [leaked password checks](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Other external release gates remain OPEN:** genuine DVLA/MOT outage scenarios; actual contracted/credentialled market provider samples; permission to retain/cache 60-second adverts; cross-instance PostgreSQL freeze concurrency; separately configured compatible staging backend and synthetic database; independently reviewed genuine completed auctions for Block 9 (at least 30 for each qualified cohort before ON); external measured holdout and calibrated coefficient performance; API/OS/device QA (web/iOS/Android); privacy and source licensing; package-lockfile vulnerability triage; staged rollback rehearsal with recorded deployment artefacts. Passing synthetic CI is necessary but never substitutes for these independent gates.

**No release permission is implied by `proceed Block 10`.** Remain unmerged and avoid real-user traffic, a new paid Supabase branch, production backend activation, production Vercel promotion, irreversible app-store rollout and automatic data changes until the user explicitly approves a separate deployment plan after all blocking checks.
