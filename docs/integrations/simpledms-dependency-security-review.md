# SimpleDMS dependency-security investigation (internal)
Status: **remediation in progress; do not issue external credentials**.
Date: 2026-10-02. Scope: `backend/package-lock.json`, auth/runtime dependencies, isolated synthetic staging. No production deploy is authorised by this investigation.

## Reproducible evidence

| Check | Critical | High | Moderate | Low | Evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Original `npm audit --omit=dev` | 3 | 29 | 23 | 1 | GitHub Actions run 37066357064 |
| No-major compatible lockfile preview | 1 | 6 | 12 | 0 | Run 37067432566, immutable preview artifact |
| Compatible lockfile plus tested bcrypt 6 | 0 | 4 | 12 | 0 | Isolated bcrypt6 evaluation run 37067774302, audit artifact |

The bcrypt 6 evaluation successfully completed `npm ci`, backend `npm run typecheck`, full backend Jest suite and `npm run build`; committed in scoped PR #347 into security PR #346. This is not evidence that the entire application has passed staging or production security review.

## Root causes addressed

- Older `bcrypt@5` brought `@mapbox/node-pre-gyp` and `tar@6`, the remaining critical archive extraction chain after compatible npm updates. Moving to `bcrypt@6` eliminates the reported critical finding and that deprecated installer chain in the isolated audit.
- Compatible lockfile changes updated numerous affected dependencies, including `@xhmikosr/decompress`, `piscina`, server libraries and transitive packages, while keeping declared major application dependency versions unchanged.

## Remaining high advisories (not yet fixed)

1. `prisma@6.19.x`, `@prisma/config` and `deepmerge-ts@7.x` belong to the Prisma CLI dependency chain. `@prisma/client` has an optional peer relationship to the Prisma CLI; the production-only `npm ci --omit=dev` probe nonetheless installed this chain. The *current* Fly runner Dockerfile also explicitly copies the Prisma CLI and the entire `@prisma` folder from the builder, so this is **not** safely classified as absent from the deployed API.
2. `brace-expansion@1.1.12` remains under `minimatch@3` within Nest build CLI tooling. The backend currently lists `@nestjs/cli` among regular `dependencies`, which retains build tools in production installs. A separate branch is evaluating moving it and schematics to `devDependencies`; this change must pass build and runtime smoke before adoption.

These are advisory findings and dependency presence, not independent evidence of successful exploitation or that externally supplied requests reach the affected code.

## Safe path forward

- Review result of experimental clean production-only installation on branch `security/simpledms-runtime-prune-eval`. Keep failed experiments unmerged.
- Preserve Prisma migrations as a **separate maintenance capability** if removing Prisma CLI from the public HTTP image. Do not remove emergency migration functionality without a replacement and operational sign-off. Separate build and runtime image stages must avoid copying CLI/entire `@prisma` directory into the HTTP runtime.
- Do not downgrade Prisma CLI to 6.12 or force `deepmerge-ts@8` into Prisma 6.19 without compatibility evidence and a documented migration process.
- Test the actual **Node 20 Alpine Docker runner** and full app startup, not only Node 22 GitHub-hosted unit tests.
- Re-run a dependency audit on the exact final production image, plus isolated staging security/HTTP tests. Record residual moderate findings for follow-up. Verify no production keys or databases were used in tests.
- Keep SimpleDMS integration draft PR #333 and security PR #346 separate until code review, passing final checks and deployment approval. External staging key must remain withheld pending required security and signed data agreement.

References: `https://github.com/carmaziums/carmazium/actions/runs/37066357064`; `https://github.com/carmaziums/carmazium/actions/runs/37067432566`; `https://github.com/carmaziums/carmazium/actions/runs/37067774302`; `https://github.com/carmaziums/carmazium/pull/346`.
