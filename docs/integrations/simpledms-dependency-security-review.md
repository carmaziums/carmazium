# SimpleDMS dependency-security investigation (internal)
Status: **0 critical and 3 high in validated minimal runtime; Prisma CLI high findings remain. Do not issue external credentials.**
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
