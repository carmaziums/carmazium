# Backend bcrypt 5 → 6 compatibility and critical `tar` remediation

**Scope:** Independent security dependency change, stacked on the compatible backend lockfile security draft PR #371. The ten-block valuation release remains the untouched, full-system reversible draft PR #367. Neither of these security PRs is to be included in the valuation release's 51-file revert bundle.

**Why:** The audited backend lockfile after compatible patches has **1 critical / 6 high**. The critical `tar` comes from bcrypt 5's `@mapbox/node-pre-gyp` installation tree. The upstream [bcrypt 6 changelog](https://github.com/kelektiv/node.bcrypt.js/blob/master/CHANGELOG.md) says bcrypt 6 replaces `node-pre-gyp` with `prebuildify` and drops support only for Node 16 and older. CarMazium's backend declares Node 20+. We pin bcrypt **6.0.0** and `@types/bcrypt` **6.0.0** exactly. Merely relying on changelog claims is insufficient; the full cross-version login and native build tests are mandatory.

## Proof required before a lockfile update is accepted

The scoped temporary CI generator must:

1. Check out precisely this one same-repo draft PR branch. Verify that its base is the audited PR #371 (not unreviewed `main`) and that the base lockfile installs bcrypt 5.1.1. Generate **synthetic bcrypt 5.1.1 hashes in an isolated disposable directory** with its own native addon; never inspect or export a real customer's password or hash. Store synthetic fixtures only in that runner's temporary directory.
2. Generate the paired bcrypt 6.0.0 / `@types/bcrypt` 6.0.0 lockfile with `npm install --package-lock-only --ignore-scripts` then optionally apply **non-breaking** audit fixes. Never run `npm audit fix --force`. Verify all direct package constraints, bcrypt version 6.0.0 in the lockfile and `@prisma/client`/Prisma 6.19.x unchanged. Allow only `backend/package-lock.json` as the generated change.
3. Perform `npm ci` with the **actual bcrypt 6 native addon**. Run the cross-version script against actual bcrypt5-generated synthetic hashes: old 5 hashes verify with 6, new 6 hashes verify with legacy 5, malformed or wrong passwords fail, legacy `$2a$` revision works, exact 72-byte and Unicode boundary behavior is explicit, and there is no automatic hash rewriting.
4. Run the separate CarMazium `AuthService` integration-style Jest tests for **register**, **login**, **fifth-attempt lockout**, **reset**, old-hash login/reset and **Supabase external-auth separation**. Keep the previous 12-round cost, hash formats, account lockout and user DB schema completely unchanged. Then run the *complete backend Jest suite*, TypeScript compilation and Nest production build.
5. Audit `npm audit --package-lock-only --omit=dev --json` and require **zero critical** after upgrading bcrypt and at most six high findings (never treat nonzero high as security clearance). Verify dependency installation has no old transitive `@mapbox/node-pre-gyp`/old vulnerable `tar` brought in by bcrypt. Never log secrets.
6. Only on successful evidence, commit **only** `backend/package-lock.json` to this security PR branch. Afterward delete the temporary writer workflow. Final PR changes must consist only of backend manifest, lockfile, synthetic compatibility script, the auth Jest regression test and this documentation. Temporarily aim the draft PR at `main` only to trigger complete standard CI, then restore its base to PR #371's branch. **Do not merge or deploy**.

## Risk and future rollback

bcrypt 6 uses the same established bcrypt on-disk hash format. However, do not assume migration is safe until real cross-version synthetically generated hashes verify in **both** directions. No existing customer password reset is expected, and **there is no migration of stored hash values**. If the new module has to be reverted, previous bcrypt 5 must still validate hashes generated while 6 was active (subject to separately reviewed Node/native compatibility). API login lockout and Supabase-managed login remain completely unchanged.

Full production acceptance additionally requires an **isolated compatible staging backend** that boots on the target Fly.io Node base image and tests mocked/migrated synthetic authentication journeys, a verified deployment rollback image and a separate security review of the remaining high findings. CI success is not permission to merge the valuation release, the independent security patches, or to touch the production database.

## Actual CI evidence from the isolated pre-commit verification

The temporary branch-scoped GitHub workflow **37082961632** completed successfully on 3 October 2026, before its writer workflow was deleted. Recorded evidence from its exact test job:

- **Six** actual bcrypt 5.1.1-generated synthetic hash families verified with bcrypt 6.0.0; six bcrypt 6 hashes verified again with actual bcrypt 5.1.1 for rollback. The `$2a$` legacy marker and the 72-byte input boundary passed. No real account data or password-hash snapshots were used.
- New direct `AuthService` regression tests: **5 passed** including legacy-password login/reset and unchanged Supabase external-account handling; full backend suite: **86 suites / 948 tests passed**.
- TypeScript backend checks, native-addon installation and Nest backend production build passed.
- Before and after the clean installation, the production-dependency audit reported **0 critical, 3 high, 12 moderate and 0 low** (down from the previous safe-lockfile result of 1 critical / 6 high). Remaining high packages: `prisma`, `@prisma/config`, `deepmerge-ts`; these require a separately reviewed Prisma dependency strategy. No `tar`/bcrypt-related critical or high finding remained in this test's audit.
- The generated lockfile was committed to the security draft branch only; the temporary write-enabled workflow has since been removed. The final release PR remains blocked until independently repeated normal GitHub CI on the final exact SHA and a compatible isolated Fly backend staging rehearsal.

These are **automated test and npm-audit results**, not a claim that the production servers have been updated or that npm dependency advisories prove exploitation. No customer database or password-reset migration was changed.
