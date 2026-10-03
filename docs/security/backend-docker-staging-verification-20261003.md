# CarMazium security candidate — pinned Docker image and isolated staging evidence

**Status: review-only draft, not deployed.** This root-level documentation is deliberately outside the Docker build context (`backend/`) so it does not affect the exact pinned image already verified by CI.

## Actual, verified candidate dependency chain

All security changes remain separate from the untouched, independently reversible ten-block valuation draft PR #367. The dependency stack is:

- Independent website security draft #370: Next.js and matching ESLint framework configuration upgraded to 16.3.8, with a verified zero-critical/zero-high website production lockfile audit.
- Backend compatible dependency draft #371: compatible lockfile-only security updates.
- Backend bcrypt draft #373, stacked on #371: genuine native bcrypt5 ↔ bcrypt6 compatibility with six synthetic legacy-hash families and reverse hash verification; dedicated CI 86 suites / 948 tests.
- Backend Prisma configuration draft #374, stacked on #373: matching CLI/client 6.19.3 and narrowly overridden `@prisma/config -> deepmerge-ts@8.0.2`, real schema validation, client generation, schema-only diff and full backend regression.
- Backend runtime-dependency isolation draft #377, stacked on #374: correctly makes Nest CLI/schematics **dev-only**, removing SWC CLI and download/archiving packages from an actual separately installed production tree. All four ordinary workflows passed on its final exact head `b1c81a5187756f5a33639f778b48079c4d46dc5a` (GitHub runs 37085151989, 37085152076, 37085152029, 37085151987), and Fly deployment was skipped. An audit *at the time of this candidate* showed 0 critical / 0 high / 2 moderate in both the proposed lockfile and actual `npm ci --omit=dev` production tree. Separately, read-only audit draft #376 records the earlier advisory-feed change from 12 moderate to 8 high / 10 moderate on the **old** backend graph.

## Actual assembled-image preflight

Draft PR #378, stacked on #377, now proposes updating the backend's old Dockerfile `ARG NODE_VERSION=20.10.0` to the verified **pinned `22.23.3`** default. This eliminates the mismatch with the Nest CLI's Node `>=20.11` engine requirement without assuming a free Fly or database staging environment. No runtime source code or deployment configuration is altered.

- Non-deploying initial preflight GitHub Action **37085242860** built the same actual multistage Dockerfile under a prospective Node22 override and validated native bcrypt6, Prisma Client6.19.3, `pg_dump 16.15`, the physical absence of `@nestjs/cli`, `@nestjs/schematics`, `@swc/cli`, bin-wrapper and downloader, and an assembled-image `npm audit --omit=dev` result of **0 critical / 0 high / 2 moderate**.
- Critically, the final **pinned Dockerfile without any build-argument override** was independently rebuilt and retested successfully by GitHub run **37085381834**: actual runtime Node `v22.23.3`, `pg_dump (PostgreSQL) 16.15`, bcrypt6 native synthetic hash/compare, Prisma6.19.3 client constructed and disconnected offline, physical absence of the five build-only packages, physical inventory of builder-copied Prisma modules, and npm production-graph audit **0 critical / 0 high / 2 moderate / 0 low**. No registry push, server start, network access inside the offline runtime test, live databases, service credentials or cloud resources were used. The first exploratory image workflow's inline shell test failed because it expanded the JavaScript `$disconnect` token; the subsequent standalone checked-in preflight script eliminated that test error before both successful runs.
- This image preflight **does not** substitute for an OS/package filesystem SBOM scanner, complete runtime image CVE triage, full API integration staging or an actual Fly rollout/rollback rehearsal. The live production `main` Dockerfile still has Node20.10.0 until a separately approved change is merged and deployed.

## Hard release gates and rollback independence

A production security release still needs the actual Docker image's OS-level review, owner triage of the two current moderate advisory counts (`@nestjs/swagger` / `js-yaml` chain), controlled staging API with compatible isolated PostgreSQL/Supabase Auth/object storage and synthetic data, a safe Fly revision rollback plan and explicit production approval. The separate existing CarMazium Development database is not schema-compatible as-is; **do not reuse it without independent review**. The user explicitly prohibited creating a paid Supabase branch. This work does not create or propose one.

Once the independent security stack is deployed and read back successfully, **rebase the separate ten-block valuation candidate onto the new main**, run all seven relevant CI and real 51-file original-source rollback checks again, and record the actual future **single squash** valuation release SHA. A later user-requested revert of *all ten valuation blocks* must preserve these independent security changes. Do not merge the stacked draft security PRs casually out of dependency order; use their correctly reviewed release structure.
