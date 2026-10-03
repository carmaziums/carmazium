# Production runtime dependency isolation — Nest CLI and SWC

**Scope:** independent backend security hardening, stacked on draft Prisma-security PR #374. This must survive the separate 10-block valuation rollback in draft PR #367. Do not merge or deploy without staging and separate approval.

## Why an updated advisory scan changes the previous result

The original candidate-backend advisory inventory at 00:54 UTC on 3 October measured 0 critical / 0 high / 12 moderate. By 01:03 UTC a fresh npm advisory feed for the **same proposed backend graph** reported **0 critical / 8 high / 10 moderate**. This is a change in published advisory data, not evidence that the earlier test or production server changed. The fresh high advisory chain is principally `@swc/cli@0.6.0` → `@xhmikosr/bin-wrapper` → `@xhmikosr/downloader` and their transitives (`got`, `fast-glob`, `cacheable-request`, `braces`, `micromatch`, `http-cache-semantics`).

A clean, actual `npm ci --omit=dev` inspection of the *pre-fix* PR #374 lockfile demonstrated that `@nestjs/cli` was declared in `backend.dependencies`, pulling in optional-peer `@swc/cli@0.6.0` and the affected download/archive parsing dependency tree as **production-installed**. The app's runtime is the compiled Nest app (`node dist/main`); the Nest CLI and schematics are build tools. Keeping them in production increases reachable installation-time and optional-tooling attack surface. Moreover, `backend/Dockerfile` already installs **all** dependencies in the builder stage and copies the compiled app into a separate production stage; the production stage uses `npm ci --omit=dev`. This separation supports reclassifying build tools as dev-only with no application behaviour changes.

The correct initial fix is **dependency classification**, not `npm audit fix --force` or a forced `@swc/cli@0.8.1` change. The repository's existing moderate-audit simulation demonstrated that blanket remediation could leave or expose high findings, and does not independently validate Nest build or production installation.

## Scoped change and safety controls

Move **only** `@nestjs/cli` and `@nestjs/schematics` from runtime `dependencies` to `devDependencies`, preserving the exact original version constraints (`^11.0.0`). Keep `@swc/cli` as an existing devDependency for the build stage. Preserve `bcrypt@6.0.0`, matching `prisma@6.19.3` / `@prisma/client@6.19.3`, and the existing narrowly scoped Prisma config override, with no valuation code edits.

A temporary same-repository CI generator is allowed to regenerate **only** `backend/package-lock.json` on this draft branch after the following checks pass:

1. Detect no source-code runtime imports of `@nestjs/cli` or `@nestjs/schematics`; no Nest application source modifications are authorised in this change.
2. Clean full `npm ci` in an isolated GitHub runner; full backend Jest test suite, TypeScript typechecking, Prisma schema validation/generation, Nest production build and the previous bcrypt-auth regression tests.
3. Clean separate **production-only** `npm ci --omit=dev` using the proposed lockfile. Verify `@nestjs/cli`, `@nestjs/schematics`, `@swc/cli` and its downloader/bin-wrapper chain are **absent from actual installed production node_modules**, while `@nestjs/core`, `@nestjs/swagger`, `bcrypt` and `@prisma/client` remain installed. Validate bcrypt hashing/comparison with public synthetic test data.
4. Independently audit the proposed production dependencies from the lockfile **and** actual installed production tree. Reject the lockfile commit if any critical/high findings remain. Report moderate findings with their precise advisory links and assess them separately. Do not claim a low-impact vulnerability is non-exploitable merely because it is a transitive package.
5. Commit **only** the regenerated lockfile to this security draft branch if all checks pass. Remove the temporary write-enabled CI workflow, then run final normal backend/chat/parity/release-certification checks on the exact final commit. Never merge or deploy automatically.

**Additional actual Fly image caveat:** `backend/Dockerfile` currently uses Node `20.10.0`, while its own Nest CLI declares Node `>=20.11`. The Dockerfile also copies the Prisma CLI and the entire `node_modules/@prisma` directory from builder into runtime, so a lockfile-only `--omit=dev` audit is **not** equivalent to an audit of the final shipped Fly container image. A separate actual Docker build and assembled-image dependency inspection must test the target Fly runtime before production deployment. This PR does not alter the Dockerfile and does not pretend to provide a full staging backend without an isolated compatible database.

None of this authorises a paid Supabase branch, production database change, Fly deployment, automatic valuation PR merge or modification of the legacy valuation source. The whole ten-block valuation rollback must preserve all independent security work.
