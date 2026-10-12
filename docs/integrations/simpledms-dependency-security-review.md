# SimpleDMS dependency-security investigation (internal)
Status: **Image isolation implemented; supported Node 24 public image test reports 0 critical, 0 high, 1 medium. Prisma CLI advisories remain in restricted maintenance tooling. Production not changed.**
Date: 2026-10-02. Scope: `backend/package-lock.json`, auth/runtime dependencies, isolated synthetic staging. No production deploy is authorised by this investigation.

## Reproducible evidence

| Check | Critical | High | Moderate | Low | Evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Original `npm audit --omit=dev` | 3 | 29 | 23 | 1 | GitHub Actions run 37066357064 |
| No-major compatible lockfile preview | 1 | 6 | 12 | 0 | Run 37067432566, immutable preview artifact |
| Compatible lockfile plus tested bcrypt 6 | 0 | 4 | 12 | 0 | Isolated bcrypt6 evaluation run 37067774302, audit artifact |
| Nest build tooling moved to dev and isolated production-only install | 0 | 3 | 2 | 0 | Run 37068848143: 844 tests, build, synthetic API smoke, disabled partner endpoint 404 |

The bcrypt 6 evaluation successfully completed `npm ci`, backend `npm run typecheck`, full backend Jest suite and `npm run build`; committed in scoped PR #347 into security PR #346. This is not evidence that the entire application has passed staging or production security review.

## Root causes addressed

- Older `bcrypt@5` brought `@mapbox/node-pre-gyp` and `tar@6`, the remaining critical archive extraction chain after compatible npm updates. Moving to `bcrypt@6` eliminates the reported critical finding and that deprecated installer chain in the isolated audit.
- Compatible lockfile changes updated numerous affected dependencies, including `@xhmikosr/decompress`, `piscina`, server libraries and transitive packages, while keeping declared major application dependency versions unchanged.

## Remaining high advisories (not yet fixed)

1. `prisma@6.19.x`, `@prisma/config` and `deepmerge-ts@7.x` belong to the Prisma CLI dependency chain. `@prisma/client` has an optional peer relationship to the Prisma CLI; the production-only `npm ci --omit=dev` probe nonetheless installed this chain. The *current* Fly runner Dockerfile also explicitly copies the Prisma CLI and the entire `@prisma` folder from the builder, so this is **not** safely classified as absent from the deployed API.
2. `brace-expansion@1.1.12` remains under `minimatch@3` within Nest build CLI tooling. The backend currently lists `@nestjs/cli` among regular `dependencies`, which retains build tools in production installs. Scoped PR #349 moved CLI and schematics to `devDependencies`; its isolated Node 22 run passed all 844 backend tests, compiled the backend, verified a clean runtime without those build tools and started the synthetic partner API with disabled access returning 404. This was merged into security PR #346 for review only; no production deploy.

These are advisory findings and dependency presence, not independent evidence of successful exploitation or that externally supplied requests reach the affected code.

## Safe path forward

- Clean runtime experiment passed on branch `security/simpledms-runtime-prune-eval` (run 37068848143). The Prisma CLI and configuration remain physically present despite `--omit=dev --omit=peer`, so do not claim that npm pruning fixes the Prisma advisory.
- Preserve Prisma migrations as a **separate maintenance capability** if removing Prisma CLI from the public HTTP image. Do not remove emergency migration functionality without a replacement and operational sign-off. Separate build and runtime image stages must avoid copying CLI/entire `@prisma` directory into the HTTP runtime.
- Do not downgrade Prisma CLI to 6.12 or force `deepmerge-ts@8` into Prisma 6.19 without compatibility evidence and a documented migration process.
- Test the actual **Node 20 Alpine Docker runner** and full app startup, not only Node 22 GitHub-hosted unit tests.
- Re-run a dependency audit on the exact final production image, plus isolated staging security/HTTP tests. Record residual moderate findings for follow-up. Verify no production keys or databases were used in tests.
- Keep SimpleDMS integration draft PR #333 and security PR #346 separate until code review, passing final checks and deployment approval. External staging key must remain withheld pending required security and signed data agreement.

References: `https://github.com/carmaziums/carmazium/actions/runs/37068848143`; `https://github.com/carmaziums/carmazium/actions/runs/37066357064`; `https://github.com/carmaziums/carmazium/actions/runs/37067432566`; `https://github.com/carmaziums/carmazium/actions/runs/37067774302`; `https://github.com/carmaziums/carmazium/pull/346`.

## Image-level follow-up — supported Node 24

- First actual Node 20.10 Alpine image scan (Actions 37070064796) found 1 critical, 27 high and 30 medium, **predominantly the legacy base image's globally bundled npm and outdated Alpine packages**, not Prisma code reachable in the HTTP service.
- After removing global npm/npx from the API image and upgrading available Alpine packages, the actual Node 20 image scan (Actions 37070368914) found **0 critical, 0 high, 1 medium**.
- Node 20 reached end of support 2026-04-30 according to nodejs/Release. A separate Node 24 evaluation (Actions 37070505760) passed full backend tests, bcrypt/GeoIP checks, both image builds and synthetic API startup. The **supported Node 24 public image scanner** likewise reported **0 critical, 0 high, 1 medium**.
- The remaining medium is nested `js-yaml@5.3.0` under `@nestjs/swagger`, with a patched 5.4.1 available but pinned dependency compatibility to assess separately; do not introduce an unverified global override.
- The Prisma CLI is excluded physically from the public image and retained **only** in the separate non-root, private maintenance image. Its known advisories require scoped operational acceptance; migration access must not become public. Image separation alone does not remove the need to verify separate runtime and DDL-capable database roles before cutover.
- The base image is pinned to the **exact digest** verified by the Node 24 compatibility run; future image updates must repeat regression and filesystem vulnerability scanning.

## Minimized restricted maintenance target

The first two-target scan identified 13 high and 26 medium advisories in the maintenance image because it copied the full application builder's `node_modules`, including irrelevant dev dependencies. A separate exact Prisma CLI manifest/lock (`backend/prisma-maintenance`, pinned Prisma 6.19.3) was generated and verified by GitHub Actions run 37071155059. The CLI-only target now installs just that independently locked tree, removes globally bundled npm and contains the current Prisma schema without any compiled API. Rescan after build; retained Prisma upstream advisories remain an operational risk requiring private access and explicit sign-off.

## Final minimized maintenance scan (separate from public runtime)

The independent Prisma-only lockfile was generated and tested (Actions run 37071155059). The final two-image verification (Actions run 37071248673) confirmed the maintenance CLI works on a temporary PostgreSQL database, runs without root privileges and has no compiled public API or global npm. Its actual filesystem vulnerability scan fell from 13 high findings in the builder-copy prototype to **1 high, 0 critical**, solely the `deepmerge-ts` dependency of Prisma 6.19.3. The **public image remains 0 critical, 0 high, 1 medium**. Do not equate isolation with removing the upstream Prisma issue. Require security/operations signoff, segregated database-role privileges and a private, ephemeral execution environment before production maintenance use.
