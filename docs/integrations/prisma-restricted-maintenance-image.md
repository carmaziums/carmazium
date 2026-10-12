# Restricted Prisma maintenance image — operational runbook

**Status: proposed; must pass Docker CI and an infrastructure review before
changing the running Fly API.** The two image targets use the same pinned, supported Node 24 Alpine base digest and schema revision but have different, independently locked dependency sets. The maintenance image installs ONLY `prisma@6.19.3` and its 35 lockfile dependencies from `backend/prisma-maintenance/package-lock.json`; it does not copy the application, generated API code, runtime dependencies or development tooling.

| Image target | Purpose | Allowed execution |
| --- | --- | --- |
| `runtime` (default) | Public CarMazium HTTP backend | Standard Fly backend application; NO Prisma CLI |
| `prisma-maintenance` | Explicitly approved database operations | Short-lived, private, operator-initiated task with audited access; NEVER public ingress |

## Building the images

From `backend/`:

```sh
docker build --target runtime -t carmazium-backend-api:<approved-commit> .
docker build --target prisma-maintenance -t carmazium-prisma-maintenance:<approved-commit> .
```

Use the same reviewed Git SHA and signed registry policy for both images.
The `runtime` target is the last target by design, so a legacy `docker build`
continues to produce the API, never the maintenance command runner. Do not
inject database URLs, Supabase service keys, Stripe secrets or personal data
during image build.

## Authorised maintenance access

The minimal maintenance CLI manifest/lock are maintained separately under `backend/prisma-maintenance/`. Regenerate them only on a reviewed isolation branch using a separately reviewed, one-time lock-generation CI job (`npm install --package-lock-only` with Prisma pinned exactly to the backend lock), then validate the CLI against an isolated test database before use. The maintenance image is not a new continuously running server and does not
expose HTTP ports. Execution requires an explicitly authorised operator, a
restricted private network connection to the intended database, a scoped,
time-limited database credential, change-ticket approval, suitable backups
and written confirmation of the target environment.

**Non-mutating version/sanity check** without any secrets:

```sh
docker run --rm --network none carmazium-prisma-maintenance:<approved-commit> --version
```

**Non-mutating migration status** is allowed only from a restricted job
environment with separately delivered secrets (example path below is a
placeholder, not a recommended long-term secret-storage format):

```sh
docker run --rm --network <approved-private-network> \
  --env-file <secure-short-lived-secret-file> \
  carmazium-prisma-maintenance:<approved-commit> migrate status
```

Do not expose the Docker socket, forward a public database port, place
DATABASE_URL/DIRECT_URL in shell history, GitHub Actions logs, ordinary email
or repository files, or leave an idle maintenance machine deployed.

### Critical: no automatic schema reconciliation

CarMazium's current Prisma migration history is **not a verified complete
record of the production Supabase schema**. The historic release pipeline
explicitly disabled `prisma db push --accept-data-loss` after it attempted
destructive changes to tables with existing RLS policies. Do not run
`prisma db push` or assume `prisma migrate deploy` is safe on production.
Existing manually reviewed SQL migration process remains authoritative until
a separate, database-specific reconciliation and recovery test is approved.
The maintenance image provides the CLI *capability*, not blanket permission to
run schema-changing commands.

Removing the CLI reduces the public application's attack surface, but **does
not alone enforce database privileges**: a compromised app with a database
owner/DDL-capable `DATABASE_URL` can still issue schema-changing SQL directly.
Before production cutover, verify that the regular API connection uses a
non-owner account with only the DML/schema privileges its runtime actually
needs, while the private short-lived maintenance connection uses a separately
controlled, audited migration role. Test all existing API flows (including
session-table creation, scheduled backups, handover and admin operations)
against the restricted role; do not revoke any current permissions abruptly
without that compatibility test. Never disclose either credential in CI logs.

The maintenance image must not be deployed as another public Fly service.
Before any cutover from the existing API image, the platform owner must
confirm a short-lived, access-restricted maintenance-job procedure that
preserves backups, incident recovery and manual SQL deployment.

## Image security acceptance

1. CI builds *both* targets on the repo's Dockerfile (pinned Node 24 Alpine)
   without production secrets and checks the maintenance command's version.
2. CI proves the API filesystem contains neither `node_modules/prisma` nor
   `node_modules/@prisma/config` nor `node_modules/deepmerge-ts` while
   retaining `@prisma/client` and generated `.prisma` query engine.
3. CI runs the actual API image with the synthetic partner test entrypoint,
   checks `/health/live`, rejects unauthenticated/disabled partner feed, and
   uses synthetic data only; no real backend/Stripe/Supabase connections.
4. The same image version receives a container filesystem dependency scan
   (rather than relying only on `npm audit` against a lockfile which still
   lists optional peer dependencies that are physically removed).
5. Node 24 has passed a separate full-backend, bcrypt, GeoIP, Docker and
   synthetic-API compatibility run (Actions 37070505760). Every digest update
   requires the same checks; no change to live Fly is implied.
6. A human operator verifies a private, short-lived maintenance task can
   read the *non-production* database and migrate status, then approves an
   incident-recovery exercise and the operational handover **before** changing
   production image deployment behaviour.

Production partner API and SimpleDMS partner credentials remain disabled
until the separate privacy/data-sharing gates are complete.

## Supported image verification (pre-release)

The supported Node 24 evaluation at GitHub Actions run 37070505760 completed backend regression tests, separate image builds and image scanning: the public runtime reported 0 critical / 0 high / 1 medium. The only medium advisory is a nested `js-yaml` under Nest Swagger; track this separately. The tested Node image digest is pinned in the Dockerfile, preventing an unreviewed tag move. The restricted maintenance image's dependency scan is recorded separately because it intentionally includes Prisma CLI and its own maintenance-only dependency risks.

**Minimal maintenance image result:** GitHub Actions run 37071248673 verified a one-package root manifest (`prisma@6.19.3`, 35 locked transitive packages), no compiled HTTP API, a non-root entrypoint and successful execution against temporary PostgreSQL. The final maintenance-image filesystem scan reported **0 critical, 1 high**. That remaining `deepmerge-ts` advisory is inherited from the trusted Prisma CLI and is **not resolved**; private network access, trusted schema-only input, short-lived DDL credentials and explicit operational risk review remain mandatory before the image is used on a real database.
