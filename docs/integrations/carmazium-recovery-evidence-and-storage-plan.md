# CarMazium recovery evidence and storage protection plan
**Status: non-production planning and read-only verification. No paid branch, no paid storage target, no live configuration changes.**

## Verified state — 3 October 2026

| Protection | Evidence | State |
| --- | --- | --- |
| Supabase managed daily DB backups | CarMazium organisation is **Pro**; official Supabase policy includes **daily project database backups, latest seven days available** | **Entitled; actual completed recovery points NOT verified** |
| Supabase point-in-time recovery | Available as a separate Pro add-on | **Whether enabled is unknown; do not assume it is available or purchase it** |
| Legacy weekly application DB dump | Running Fly machine connects to inspected production project; backup bucket missing, upload service key absent, installed pg_dump 16 vs project PostgreSQL 17.6 | **Cannot work as currently configured; do not rely on it** |
| Draft replacement code | Draft PR #346 includes pg_dump 17 client, shell-free parameters, separate-role fail-closed option and missing-private-bucket/credential preflight | **Verified in synthetic CI; NOT deployed; NOT an independent private backup runner** |
| Recovery of Storage objects | Database backups do NOT include uploaded file contents | **No independently verified Storage-object backup** |
| Full production restore | Only selected synthetic tables and policy/ACL checks restored on two temporary PostgreSQL 17 CI servers | **Real end-to-end production-equivalent recovery is unverified** |

Read-only live Storage inventory at review time: 7 buckets, **12,162 objects** and approximately **8.57 GB** of reported file data:
- Public listings: 12,094 objects (~8.51 GB); these may still be business-critical even though publicly viewable.
- Private dealer KYC: 59 objects (~60 MB), highly sensitive.
- Private auction handover documents: 9 objects (~4 MB), sensitive.
- Other four buckets had zero recorded objects at inspection time.
Object counts and reported sizes are snapshots and will change. They are **not** evidence of independent recoverability.

## Immediate verification: use the existing Pro service, no added cost

An authorised CarMazium Supabase organisation administrator should inspect the production project's **Database → Backups → Scheduled** page:

https://supabase.com/dashboard/project/bwtnzmevjlowwronylxm/database/backups/scheduled

Record internally: latest successful backup date/time (UTC), list of other available daily recovery points and their status, whether Point-in-Time Recovery is actually enabled and any displayed latest restore timestamp. Do **not** press Restore on production: Supabase documents that restoration makes the project inaccessible while it runs. Do not copy project access tokens, database URLs or KYC/customer files into an ordinary GitHub issue or chat screenshot.

The current Supabase connector does not expose backup listing. A one-time repository GitHub Actions workflow attempted an **authorised management-token presence check only** and established that the repository has **no** pre-configured Supabase Management API token. No token was requested, generated, printed or persisted; the workflow was removed after that check. This is an access limitation, **not** evidence that managed backups are missing.

If successful daily snapshots are visible, this provides a potential 7-day DB recovery window but not proof of a completed restore, recovery-time target or Storage-object recovery. If no successful recent snapshots are visible, urgently contact Supabase Support through the organisation account to clarify recovery options rather than initiating a destructive restore.

Sources:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/api/v1-list-all-backups

## Storage-object protection: separate approval required

Before claiming full recovery readiness, adopt a separately approved **encrypted, access-controlled, independently retained Storage-object backup**. Supabase database backups preserve Storage object metadata but not the contents of the files. Deleting a Storage object after the database snapshot is not reversed by restoring the database.

Recommended private architecture subject to security, cost and data-handling approval:

1. Establish a separate, authorised short-lived private backup runner, **not** a permanent secret in the public Fly HTTP backend. Require restrictive credentials with explicit access only to the approved Storage buckets and the independent backup destination.
2. Export a **metadata-only object manifest** for each bucket (IDs/paths, sizes and if available checksums), but do not place private document paths or customer IDs in unprotected logs or public CI artifacts.
3. Copy objects over encrypted transport to independently retained private storage; preserve logical bucket separation and destination-side encryption. Dealer ID, KYC and handover evidence must never be mirrored to public listings or an unauthorised third party. Review legal basis, processor terms, data retention and deletion obligations before transfer.
4. Demonstrate a controlled, **non-production sample restore** for listing images plus private handover/KYC test files (use synthetic substitutes whenever possible), and compare manifest entries and checksums. Validate permission boundaries and a documented deletion/retention mechanism.
5. Agree on backup frequency, retention, RPO/RTO, key rotation, periodic restore drills, cost ceiling and on-call failure alerting. Do not create paid storage or run bulk exports without explicit owner approval.

Supabase's documented S3-compatible Storage and CLI export options may support an authorised backup runner:
https://supabase.com/docs/guides/storage/management/download-objects

## Application database backup replacement

The running Fly service cannot produce the configured weekly application dump: it lacks the necessary private bucket and upload key and still uses an incompatible pg_dump client. Draft PR #346 includes corrected dependencies and fail-fast tests, but **do not fix production by inserting a privileged Supabase service key or privileged BACKUP_DATABASE_URL into the public HTTP application**.

Instead, design an isolated, on-demand or scheduled backup task with independently supplied short-lived credentials, protected private destination, backups of actual full schema, documented rotation and success/failure monitoring. Only disable the legacy cron using `BACKUP_JOB_ENABLED=false` **after** the replacement has produced an independently tested recoverable backup. The code and selected-schema test cannot establish the correctness of managed Supabase snapshots.

The production database role cutover, `REVOKE CREATE ON SCHEMA public FROM PUBLIC`, live SQL migrations, SimpleDMS partner credential release and production deployment remain **blocked** until separately approved gates are satisfied.

## Checklist for closing issue #364

- [ ] Actual successful recent Pro managed backup point confirmed by authorised admin (or Supabase Support)
- [ ] PITR availability recorded as enabled/disabled without purchase or assumption
- [ ] Recovery procedure rehearsed *without in-place production restore*; representative actual schema dependencies accounted for
- [ ] Storage-object backup target, sensitive-data handling and cost approved; protected sample restored
- [ ] Private backup task and independent DB/Storage credentials established and audited
- [ ] Complete backup and representative isolated restore, integrity check and alert test evidenced
- [ ] Only then agree production image/cron/DB-role cutover and separately review SimpleDMS launch gates

**Do not declare the incident closed on the strength of code compilation, synthetic CI or subscription entitlement alone.**
