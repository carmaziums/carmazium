# CarMazium — deferred production release: independent Storage recovery + platform security

**Prepared:** 24 October 2026. **Status:** DEVELOPMENT / CI-ONLY / NOT LIVE.  
**Owner direction:** implement and test now; hold release until owner chooses a post-pilot release. This is NOT a certification of completed independent backup or production security remediation. Neither a new external backup account nor extra paid capacity has been authorised.

## Facts independently observed read-only on 24 October

- Supabase project \`bwtnzmevjlowwronylxm\` remains the CarMazium production system in eu-west-2.
- Supabase owner screenshot on 18 October showed eight managed physical DB restore-point entries dated 11–18 October; no isolated database recovery drill has been demonstrated.
- Live Supabase Storage metadata-only inventory (do not copy private files to GitHub):

| Bucket | Public | Object count | Apparent bytes |
| --- | --- | ---: | ---: |
| admin-broadcasts | Yes | 0 | 0 |
| auction-handover-documents | No | 9 | 4,051,734 |
| chat-attachments | No | 0 | 0 |
| dealer-kyc-documents | No | 78 | 78,072,730 |
| listings | Yes | 14,598 | 9,943,985,634 |
| sale-cancellation-evidence | No | 0 | 0 |
| tradexchange-documents | No | 0 | 0 |

- Supabase database snapshots protect Postgres metadata, **not Storage object bytes**: https://supabase.com/docs/guides/platform/backups .
- Supabase security advisors on 24 October: 32 informational RLS-no-policy findings; warnings for 8 anonymous GraphQL table exposures, 29 authenticated GraphQL table exposures and 5 callable SECURITY DEFINER helpers. A warning is not, alone, proof that RLS permits data disclosure.
- Read-only live metadata confirmed inherited \`public\` schema CREATE and USAGE privileges for \`anon\` and \`authenticated\`. Actual business-path dependencies and default grants must be evaluated before any cutover.

## Work prepared in draft code, not released

### A. Safe backup runner

- \`backend/scripts/backup/independent-storage-snapshot.cjs\` has a default **plan-only** mode and an allowlisted 7-bucket inventory that includes private KYC, handover and all current empty buckets.
- It requires *all three explicit execution attestations*: \`CM_OFFSITE_OWNER_APPROVED=true\`, \`CM_OFFSITE_POSTPILOT_RELEASE_APPROVED=true\`, \`CM_OFFSITE_INDEPENDENT_DESTINATION_CONFIRMED=true\`, together with \`CM_OFFSITE_MODE=execute\`.
- The source rclone remote must use **read-only access** to the project's Storage S3-compatible API; the **different** destination remote must be a \`crypt\` remote layered on independently controlled storage. An operator must inspect the physical provider and encryption/key custody—matching different remote names alone is insufficient.
- Copies use snapshot-versioned paths and \`rclone copy --immutable\`, not sync/deletion. \`rclone check\` verifies source/destination consistency for each bucket; an independent restore drill and strong checksum/sample restoration are still required to establish actual recovery.
- Source and destination credentials reside solely in a privately operated backup runner or access-controlled secret store, not the web app, repo, ChatGPT, email or logs. Do not attach private data to CI artifacts.
- \`backend/src/tasks/independent-storage-snapshot.spec.ts\` tests the default non-execution, all seven buckets, crypto remote validation, release tripwire, safe commands and failed-copy stop conditions using fake rclone operations. It does not download private objects.

### B. Database backup-service correction

- Draft [PR #630](https://github.com/carmaziums/carmazium/pull/630) now includes \`backend/src/tasks/backup-connection.ts\` and its tests, plus the actual patched \`db-backup.service.ts\` and expanded spec.
- This removes raw database URI from command-line arguments, treats private backup destination/credentials as a precondition, avoids raw error disclosure, and supports a separate backup DB role.
- **Not an independent durable production backup:** the legacy application cron writes into a \`backups\` bucket expected in the *same* Supabase project, which is not presently verified. The existing backend Docker runner uses PostgreSQL **16** client against project PostgreSQL **17**, so actual restore/runtime compatibility remains unresolved. Do not deploy or call this end-to-end complete.
- A genuinely separate restricted backup runner, compatible PG17 \`pg_dump\`, independently encrypted offsite database artefact destination, alerting and restore drill are still required and need owner approval before real external storage is purchased or used.

### C. Broader security rehearsal

- The draft \`backend/scripts/security/ci-only-privileged-helper-hardening.sql\` runs **only against a disposable database named \`cm_helper_ci\`**. It tests revoking inherited schema CREATE while preserving USAGE, and correctly scoping five privileged helper EXECUTE grants/search paths, using synthetic user/dealer/staff/admin identities.
- Workflow \`.github/workflows/carmazium-five-helper-security-ci.yml\` runs that script against **PostgreSQL 17-alpine** on ephemeral GitHub Actions service.
- This is a **synthetic regression harness**, not a reviewed live migration; it does not grant permission to revoke live access. Preserve actual \`public\` schemas/functions/policies until a proper dependency inventory, rollback plan and tested production-equivalent replica exist.
- Before a post-pilot release, add/verify per-object anon/authenticated GraphQL/RLS access checks (including sensitive finance, dealer-KYC and identity tables), genuine PostgREST/JWT tests, privilege-dependent app flows, and a scoped incremental migration with a rollback plan. Do not simply disable GraphQL or revoke schema grants without those tests.

## Independent restore acceptance and production release gates

1. Owner approves destination choice, quoted cost/terms, UK data-protection controls, encryption keys and safe backup-operator identity.
2. Inventory ALL Storage buckets and validate the 7 known buckets or update manifest; check no new buckets silently omitted.
3. Approve a secure offsite data transfer plan for approximately 10 GB, including private KYC. Do not start transfer simply by merging code.
4. Execute encrypted backup in a separate runner only after owner-approved post-pilot release flags; verify inventory and write complete/integrity receipts without file contents.
5. Restore representative public and *restricted private* objects into an isolated account with strict access controls, verify bytes/hash and authenticated download, then delete only the temporary restore artifacts.
6. Restore a logical Postgres export separately and validate key business data, roles/RLS, sessions and data/Storage consistency. Never run the dashboard **Restore** against production.
7. In a disposable reproduction, verify role grants, GraphQL/RLS permissions, actual API flows and rollback. Obtain owner production change-window sign-off.
8. Record successful CI, isolated recovery evidence and operational monitoring; only then mark this workstream completed/releasable.

**Pilot separation:** The 24 October unsigned SimpleDMS Revision 4 permits omitting these new CarMazium-specific programmes **as launch conditions for the initial free 90-day pilot only**. They are not deemed completed, and the contract does not itself set a guaranteed automatic post-pilot release date. A future release/change agreement and final security and privacy acceptance are separate steps. No production partner key, switch, new provider/fee, live download, privilege change or private-data movement is authorised by this preparation.
