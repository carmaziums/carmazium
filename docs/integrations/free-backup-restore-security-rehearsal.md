# Free synthetic backup-and-restore rehearsal for restricted DB roles

**No paid Supabase branch, no production credentials and no live data.**
This tests a realistic limitation of the proposed least-privilege application
login in a disposable PostgreSQL 17 instance on the repository's existing
GitHub Actions runners.

## Why the test matters

CarMazium's currently deployed weekly backup service
(`backend/src/tasks/db-backup.service.ts`) invokes `pg_dump` using the
application's `DATABASE_URL`, compresses the archive and uploads it to a
private Supabase Storage bucket. A read-only on-host inspection established
that the currently deployed Prisma and `pg.Pool` connections authenticate
as privileged `postgres`. Reducing that account's privileges without
separating backup execution could break backups or produce incomplete data.

## What the isolated workflow establishes

`.github/workflows/carmazium-free-backup-restore.yml`:

1. Starts a disposable PostgreSQL 17 server, checks the
   `cm_core_ci` safety guard, provisions synthetic seller/dealer, live and
   ended auctions, an eligible bid and a non-sensitive session record.
2. Intentionally tries a full archive using the synthetic restricted
   application login; **the backup must fail**. It must never be treated as a
   reliable backup identity.
3. Runs `pg_dump` as a separately controlled synthetic schema owner
   (`cm_core_migrator`) and validates that the archive contains important
   table data.
4. Restores the archive into an entirely separate, empty PostgreSQL 17
   **server** after explicitly provisioning only the required synthetic
   roles. Preserves ACLs and object ownership instead of stripping them.
   Checks synthetic record counts, session JSON/expiry, table ownership,
   selected RLS policies, restored runtime read access and denied DDL.
5. Uses synthetic-only credentials, writes no customer records, makes no
   connection to Supabase/Fly and does not change the existing backup cron.

Run [37077903691](https://github.com/carmaziums/carmazium/actions/runs/37077903691)
passed all of these checks on separate disposable source and restore
PostgreSQL servers. The targeted private backup operation uses the
synthetic schema owner as its elevated identity only for this rehearsal.

The rehearsal's synthetic schema represents **selected** production-observed
columns, not the complete production schema. It does not prove a restore of
63 production tables, required extensions, owner privileges, policies,
scheduled jobs or an actual Supabase Storage backup object.

## Production release boundary

- The schema owner in CI doubles as a privileged backup identity **for
  rehearsal only**; the actual production design needs a separate,
  short-lived backup/restore identity and secret-management procedure.
  Since the live `DbBackupService` still uses the application
  `DATABASE_URL`, a credential cutover **must not** precede an approved,
  tested `BACKUP_DATABASE_URL` or independently scheduled backup service. Do not
  use the proposed restricted application role to run `pg_dump`.
- Audit current `DbBackupService` failure alerts, secure subprocess
  execution, storage bucket access and backup retention. An independent
  private backup task should be exercised in a production-equivalent staging
  environment before changing any live `DATABASE_URL`. Do not create a
  permanent elevated role or copy production connection credentials in CI.
- Full restore validation should use an isolated environment with all
  required roles, extensions, RLS policies, triggers and schema objects.
  These tests are not a substitute for a full restore drill.
- Historical manual database SQL is not fully represented in Prisma migration
  history. Neither `prisma migrate deploy` nor `prisma db push` is
  authorised on production by this rehearsal.
- SimpleDMS partner-key distribution and data/privacy agreement are
  separately gated. No production deploy or partner credentials are implied.

Review evidence in the workflow run before integrating this test into the
parent draft security PR #346.
