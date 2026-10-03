# CarMazium: no-cost synthetic Storage-object recovery check

**3 October 2026. Non-production only; no actual Supabase objects, credentials or provider restore.**

This supplements, but does not replace, the existing successful two-server PostgreSQL 17 synthetic database rehearsal. The live project has no verified independently retained copy of its Storage object bytes; provider-managed database snapshots hold metadata, not file contents.

## What is now testable without paid infrastructure
Run \`python3 backend/scripts/security/ci-only-storage-recovery.py\` locally or inspect the separate GitHub Actions workflow \`.github/workflows/carmazium-storage-object-recovery.yml\`. The test creates exactly three harmless fake binary objects: a public listing photograph, a private dealer identity document and a private handover proof. It writes a synthetic compressed archive and separately protected SHA-256 manifest, restores to a fresh temporary directory, and checks all three byte-for-byte.

Eight tests exercise intact restore, restrictive archive/manifest permissions, private restored-file permissions, corruption detection, missing-object rejection, traversal blocking, attempted privacy downgrade rejection, and refusal to overwrite an existing destination. The validator first checks the **entire archive against its manifest**, and only then writes any restored objects. These tests consume no customer data and use neither Supabase credentials nor any existing Storage bucket. The workflow publishes no backup artifacts.

**Important limits:** SHA-256 manifest integrity is meaningful only when the manifest itself has independently authenticated, tamper-resistant custody. This prototype demonstrates local integrity validation and filesystem protections, **not encryption**, remote credential separation, actual Supabase Storage API authorization or an independent recoverable copy. Synthetic fixture bucket labels deliberately differ from production.

## Proposed zero-new-paid-infrastructure operational sequence (requires security and data-owner sign-off before accessing actual files)
1. **Managed database protection:** the authorised Supabase owner should inspect production Scheduled Backups and PITR in the existing Pro dashboard, recording *actual* latest and oldest successful UTC recovery points. Never click Restore on production. Pro entitlement alone is not completion evidence. An existing management API access token may list backups, but none is configured in this repository; do not create a new permanent token solely for this check.
2. **Independent Storage destination:** first inventory any existing **approved** encrypted private destination with independent retention. Storage inside the *same* project is insufficient evidence of independent recovery. Do not create new paid infrastructure or bulk-export anything before authorisation.
3. **Private execution boundary:** run a short-lived and separately authorised backup job on an approved existing private compute mechanism, not the public Fly HTTP process or unrestricted CI. Provide ephemeral, least-privilege access to only the approved source buckets and destination. Never set a new privileged \`BACKUP_DATABASE_URL\` or \`SUPABASE_SERVICE_ROLE_KEY\` inside the public API. Keep KYC and handover documents subject to distinct access and retention rules.
4. **Integrity and encryption:** stream files over TLS to independently retained encrypted private storage; separately authenticate and protect a versioned manifest containing approved bucket/key mappings, object sizes and SHA-256 checksums. Preserve object bytes and their privacy classifications. Enforce privacy/legal agreements, deletion commitments and access logging. Do not publish private file paths in public CI or GitHub logs.
5. **Isolated recovery drill:** restore a synthetic public and private sample into a newly isolated, access-controlled destination; compare object hashes, check private access denial and signed-URL expiry. With separate approval, additionally test an actual production-equivalent complete database schema, role grants, extensions, RLS and transaction/session continuity using a safely isolated environment.
6. **Cutover only after proof:** establish RPO/RTO, off-site retention, alert receipt, full backup integrity, and successful isolated restore. Only then approve a private backup runner and disable the old application cron with \`BACKUP_JOB_ENABLED=false\`. The legacy app cron currently cannot complete; draft code changes are not deployed.

Existing paid Supabase staging branching remains prohibited. Historical manually applied SQL must be reconciled before any migration tool is enabled. Retain draft security PR #346 and issue #364 until *actual* recovery evidence exists, and do not release SimpleDMS keys or make a production DB-role change.

References:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/storage/s3/compatibility
- https://github.com/carmaziums/carmazium/issues/364
