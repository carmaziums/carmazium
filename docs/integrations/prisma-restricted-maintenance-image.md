# Restricted Prisma maintenance image — operational runbook

**Status: proposed; must pass Docker CI and an infrastructure review before
changing the running Fly API.** The two image targets are built from the same
source revision with the same Prisma schema/client versions but have different
capabilities.

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

The maintenance image is not a new continuously running server and does not
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

The maintenance image must not be deployed as another public Fly service.
Before any cutover from the existing API image, the platform owner must
confirm a short-lived, access-restricted maintenance-job procedure that
preserves backups, incident recovery and manual SQL deployment.

## Image security acceptance

1. CI builds *both* targets on the repo's Dockerfile (Node 20 Alpine)
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
5. If Node 20 runtime warnings from `geoip-lite` are encountered, run a
   separate Node-compatibility review. Do not silently change production's
   Node major version during this security remediation.
6. A human operator verifies a private, short-lived maintenance task can
   read the *non-production* database and migrate status, then approves an
   incident-recovery exercise and the operational handover **before** changing
   production image deployment behaviour.

Production partner API and SimpleDMS partner credentials remain disabled
until the separate privacy/data-sharing gates are complete.
