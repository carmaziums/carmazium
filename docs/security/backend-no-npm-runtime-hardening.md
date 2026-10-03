# Backend runtime hardening: remove vulnerable bundled npm after install

**Context:** Full Trivy scan of the pinned Node 22.23.3 proposed backend Docker image, non-deploying run **37120035072**, found **zero Alpine OS critical/high** but **11 high entries** in language packages. Inspecting the genuine Trivy `Vulnerabilities[].PkgPath` for each of the 11 proved every high finding originated from `/usr/local/lib/node_modules/npm/node_modules/...` in the **upstream Node base image**, not CarMazium's `/app/node_modules`, nor its copied Prisma CLI. The previous zero-high `npm audit --omit=dev` checked only CarMazium's npm lockfile and therefore omitted the globally bundled Node CLI.

Source disclosure: private temporary GitHub scan artifact **11273191905**, which also generated **577 CycloneDX component entries** (includes base image packages). This is a snapshot of a published advisory feed, not evidence that customers can invoke the affected npm CLI from an exposed API route.

## Narrow, independently revertible fix

Proposed Dockerfile-only change: **after** installing production dependencies and copying Prisma, assets and maintenance scripts into the final runtime layer, delete Node base image's global npm folder and `/usr/local/bin/npm`/`npx` CLI symlinks. Preserve the separate build stage, which still has npm for `npm ci`, Prisma generation and Nest compilation. `node dist/main` is the only declared runtime `CMD`; the container does not require npm to launch the API. Dedicated preflight must verify that any necessary Prisma CLI maintenance still works via `node /app/node_modules/prisma/build/index.js --version` without npm/npx; if this fails, do **not** approve the patch until a safe maintenance path is restored.

The previous image scan's remaining advisory entries are expected to shrink by physically removing global npm. No assertion of success is permitted until the independent CI job rebuilds the exact default Dockerfile, proves npm directory/commands absent, runs the offline native bcrypt/Prisma runtime test and explicit Prisma CLI version check, then completes a **fresh full assembled-image Trivy OS and Node CVE scan**, failing if any critical/high finding exists. The job also runs a host-side production-lockfile npm audit **outside** the final image, preventing accidental loss of audit coverage when npm is absent from runtime. A new private seven-day CycloneDX SBOM records the new physical component inventory.

This candidate does not update the user's Fly app, start a backend service, touch any database, create a paid Supabase branch, publish an image to any registry or alter CarMazium source/auth/valuation/payment logic. User review and deployment controls remain separate; the ten-block valuation PR #367 stays a single, separately reversible draft that must preserve security upgrades if later rolled back.

## Verified actual assembled-image evidence

The independent non-deploying GitHub workflow **37120265994** completed successfully against the exact candidate Dockerfile on 3 October 2026, without pushing, deploying, touching Fly or creating a Supabase branch. The preexisting inherited image scanner had found **11 high CVE entries**, all traced by real Trivy `PkgPath` fields to globally bundled `/usr/local/lib/node_modules/npm/node_modules` in the base Node image, not to CarMazium's app packages or the separately copied Prisma CLI.

After narrowly deleting that *global npm CLI* in the final runner stage only:

- The proposed production lockfile, audited on the CI host where npm remains available, reported **0 critical, 0 high and 2 moderate**.
- The exact rebuilt runtime passed offline native bcrypt6/Prisma/pg_dump checks, proved `npm`, `npx`, the global npm tree, and unnecessary Nest/SWC build tools physically **absent**, and verified explicit Prisma CLI `--version` still functions using `node node_modules/prisma/build/index.js`.
- Fresh pinned Trivy scan of the **fully assembled runtime image**, covering both Alpine OS and Node packages, reported: **0 critical/0 high** across all categories; OS **0 medium**, language libraries **1 medium**. The remaining medium requires human assessment, not automatic acceptance.
- The new private, seven-day CycloneDX SBOM contains **381 component records** (prior image SBOM: 577, but component count by itself is not a security score). The resulting Actions artifact is `hardened-backend-runtime-image-cve-and-sbom`; scan inventory run **37120265994**.
- The separate `Backend Chat CI` run **37120265925** also passed on the exact image-fix code commit.

**Not verified yet:** a production-connected API startup, complete schema-compatible isolated Supabase/Auth/storage backend, actual Fly release/revision rollback, native app advisories, re-scans after advisory-feed updates, or explicit release approval. The candidate stays DRAFT and must remain separate from the one-action whole-ten-block valuation rollback.
