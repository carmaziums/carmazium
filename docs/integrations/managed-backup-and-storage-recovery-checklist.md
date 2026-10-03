# CarMazium: managed database and Storage recovery evidence
**As of 3 October 2026. Read-only findings and operator checklist. No live restore, deployment, paid branch or database changes authorised.**

## Verified inventory
- Supabase organisation Carmazium Ltd is on the **Pro** subscription. The inspected live project `mazium` is active and runs PostgreSQL 17.6. 
- Supabase's published policy provides **automatic daily database backups** to Pro projects, normally retaining the previous **seven days**. If the separate paid PITR add-on is enabled, it replaces ordinary daily backups with a rolling point-in-time window. Plan entitlement is **not proof** that a particular restore point currently exists or is usable.
- A read-only GitHub Actions check (run [37082076798](https://github.com/carmaziums/carmazium/actions/runs/37082076798)) established there is **no already-configured `SUPABASE_ACCESS_TOKEN` repository secret** for querying the provider's backup-inventory Management API. The temporary workflow was removed immediately. The connected Supabase tool does not expose backup listing or restore verification. **The owner has since confirmed one dashboard-displayed database backup dated 2 October 2026, 11:59 pm; the dashboard time zone, further provider recovery points, PITR configuration and actual restoreability are still unverified.**
- Earlier read-only Supabase Storage metadata showed **seven buckets**: five private containing 68 objects and two public containing 12,094 objects (12,162 total, about 8.57 GB of approximate metadata-reported size at that earlier inspection). A NEW read-only count on 3 October showed seven expected buckets and **12,196 objects**: 9 private handover, 59 private dealer KYC, 12,128 public listing files and zero objects in the other four buckets. Counts change as the business operates. No customer object bytes, private documents or live service credentials were accessed.
- The running public backend's own weekly backup pathway is independently confirmed **misconfigured**, per [issue #364](https://github.com/carmaziums/carmazium/issues/364): the expected private `backups` bucket is absent, the deployed Fly service has no Supabase service-role key configured, and its installed `pg_dump` major version 16 is older than the actual PostgreSQL 17 server. These observations do **not** negate or verify provider-managed backups.
- Supabase explicitly states that managed **database backups contain Storage object metadata but not the uploaded files**. An old database restore cannot re-create deleted or missing Storage objects.

## Immediate provider evidence check — no infrastructure purchase required
An authorised CarMazium Supabase organisation owner should open the [live project's Scheduled Backups dashboard](https://supabase.com/dashboard/project/bwtnzmevjlowwronylxm/database/backups/scheduled) and check the [Point in Time view](https://supabase.com/dashboard/project/bwtnzmevjlowwronylxm/database/backups/pitr).
Record these limited, non-secret facts in [issue #364](https://github.com/carmaziums/carmazium/issues/364) or the organisation's private security records:
1. Whether the project presents completed **Scheduled** backups or an enabled **PITR** recovery window; do not assume both should be shown together.
2. For scheduled backups: the UTC timestamps and completed/available states of the latest and oldest listed backups. For PITR: the earliest and latest eligible recovery points and the paid entitlement already in force (do not purchase an add-on here).
3. Any visible project-specific error/warning. Do not paste access tokens, signed download links, customer records or an unredacted database connection.
4. Confirm the intended recovery-point objective against the user-facing auction, fee, bid and handover transactional requirements. Daily backups alone may permit losing up to roughly a day of changes between recovery points.
5. **Do not click Restore on the live project.** Restoring provider-managed backups on the same project is disruptive and could overwrite newer production transactions. An isolated *full* restore drill is a separate change subject to explicit infrastructure cost and approval.

A properly scoped management token is an alternative to the dashboard (Supabase `GET /v1/projects/{ref}/database/backups`), but none is currently available to the existing tooling. Do not create or store a management token in GitHub purely to satisfy this check.

## Storage continuity and incident response
Database backup evidence is **not** enough to restore the thousands of live Storage objects (12,196 at the latest 3 October metadata inspection). The photo, listing-media and any private-document assets need a **separately designed backup/replication and restore process** with explicit authorisation, minimal scope, encrypted private storage and least-privilege access. Never export private KYC/identity documents to a public bucket, GitHub artifact, developer laptop, assistant chat or unsecured email.
- Preserve object bytes *and* relative keys/bucket mappings/access policies; metadata alone is insufficient. Use approved private infrastructure only, and document independent retention and deletion rules compatible with applicable privacy obligations.
- Verify a few **synthetic** public and private object upload/download/delete/restore cases in an approved non-production bucket before expanding. Test expiring signed URLs and private access after recovery.
- Check whether any **already-operated** cloud-provider backup, retention or offsite copy service exists before purchasing a new one. Avoid presuming that Supabase's daily database backup covers files.
- A private-runner independent AWS S3 Storage-backup implementation and signed, source-independent restore verifier are developed in [this runbook](independent-storage-backup-runbook.md) and draft PR #382. Synthetic tests do **not** establish a real offsite copy. A storage-wide real export is NOT yet authorised or operational because no existing independently controlled, encrypted destination/private execution credentials are accessible through the connected tools. Keep private KYC/handover objects away from public HTTP machines and GitHub CI.

## Remaining production release gates
The verified free synthetic GitHub Actions PostgreSQL tests and successful separate-server backup/restore are useful but reproduce only **selected** database objects. They do not replace an isolated full-schema restore from current production metadata with all actual extensions, functions, triggers, RLS policies and production-compatible role boundaries. The owner specifically declined a paid Supabase staging branch; do not create one by implication.

Before switching the public Fly backend away from privileged `postgres` or approving SimpleDMS external credentials:
- Confirm **actual provider backup restore points** (or verified equivalent external recovery) and separate file recovery, with documented incident ownership.
- Approve a genuinely private, time-limited backup runner and independent DB credentials; never put a privileged `BACKUP_DATABASE_URL` or service-role key inside the public HTTP runtime.
- Demonstrate restricted role compatibility, session continuity and production-equivalent backup/recovery in a separately approved safe environment. Avoid automatic `prisma db push` or `prisma migrate deploy` against the live manually evolved schema.
- Complete independent SimpleDMS privacy/data-sharing, staging API and security-review requirements.

Sources: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups), [Supabase Management API backup listing](https://supabase.com/docs/reference/api/v1-list-all-backups), [issue #364](https://github.com/carmaziums/carmazium/issues/364).
