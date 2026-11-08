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

### A. Private independent backup + source-independent recovery (preferred implementation)

- The stronger previously tested [PR #382](https://github.com/carmaziums/carmazium/pull/382) implementation has been ported to this current-main draft to avoid duplicating incompatible backup systems. The earlier exploratory rclone script and Jest tests were **removed** from this branch. Only the private Python runner is the intended reviewed path.
- `backend/scripts/security/storage_offsite_backup.py` is a **private-runner-only** script, NOT installed into the public web/Node API, NOT a scheduled live cron and NOT run against production by any GitHub Action. It uses the seven explicitly classified live Storage buckets, including all private KYC/handover objects.
- Its production backup-mode guard requires both `BACKUP_APPROVED_LIVE_RUN=yes` and `BACKUP_POSTPILOT_RELEASE_APPROVED=yes`, plus `BACKUP_ENCRYPTED_PRIVATE_RUNNER=yes`, the exact production Supabase source ref and separate approved AWS destination/UK KMS key. All real credentials remain outside GitHub and CI. Without the explicit post-pilot approval, backup mode fails closed.
- It requires an independently controlled *existing* private/versioned London AWS S3 vault and confirmed KMS encryption. The script does **not create infrastructure, incur a storage subscription by itself, or accept a public destination**. It confirms the exact seven-bucket inventory and fresh per-bucket minima before copying. It detects source modifications and prevents overwriting an existing snapshot.
- It stores customer source filenames only in an encrypted private signed manifest and uses secret-keyed HMAC-derived remote object keys. Object bytes are checked by **downloading from the independent vault and verifying SHA-256**. A separately signed `COMPLETE.json` marker is written only after every object is verified.
- The `verify` path can validate ALL vaulted object bytes and an authenticated manifest **without any Supabase source connection or source keys**. The `restore_sample` path can recover one sample from each populated bucket into a pre-approved private 0700 directory, check it, and erase it. These are independent recovery **implementations and synthetic proofs**, not evidence that any production file has yet been backed up/restored.
- `backend/scripts/security/test_storage_offsite_backup.py` uses fake providers and no live data to rehearse tampering, missing buckets, corrupted downloads, missing approvals and restricted restore paths. `.github/workflows/carmazium-independent-storage-backup.yml` runs those offline Python tests on the draft PR and verifies pinned Python SDK imports.
- Original documented deployment procedure: [private-runner recovery runbook in PR #382](https://github.com/carmaziums/carmazium/blob/security/carmazium-independent-storage-backup-20261003/docs/integrations/independent-storage-backup-runbook.md). **Its 3 October baseline counts are stale**; use the refreshed 24 October inventory below and review every source/private bucket before any real run. Do not reuse that old guide's exact example secrets or counts.
- **Remaining blockers:** independently owned vault and IAM/KMS policies, written owner approval for any real cost/transfer, private isolated runner/key custody, source-specific read credentials, operational alerting and real 10 GB backup + isolated post-pilot restore. Production or paid tasks remain on hold.

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

**Consolidation note:** A previous rclone sketch was deliberately superseded by the stricter object-by-object manifest-authenticated implementation; never run both as parallel backup systems.

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
