# CarMazium independent Storage recovery: private-operator runbook

**Status, 3 October 2026: implementation and offline tests only; NO live file export or real-vault restore has been performed.** This is separate from Supabase-managed PostgreSQL backups and from the synthetic-only SimpleDMS API stage. This runbook is designed for an authorised private backup operator and security reviewer, not for deployment as a public API endpoint or a GitHub Action that receives live customer files.

## Evidence and scope

The owner reported a Supabase dashboard database backup dated **2 October 2026, 11:59 pm** (the dashboard time zone was not supplied). Provider-managed database backups preserve Storage metadata, **not Storage object bytes**. Never attempt to restore that database backup over production. Its real restoreability remains a separate acceptance gate.

A 3 October **read-only** SQL inventory found **seven** production Storage buckets. These baseline counts are point-in-time evidence, not immutable expected totals:

| Bucket | Classification | Objects at inspection |
| --- | --- | ---: |
| `admin-broadcasts` | public | 0 |
| `auction-handover-documents` | **private** | 9 |
| `chat-attachments` | **private** | 0 |
| `dealer-kyc-documents` | **private** | 59 |
| `listings` | public | 12,128 |
| `sale-cancellation-evidence` | **private** | 0 |
| `tradexchange-documents` | **private** | 0 |

Total **12,196** at the inspection. The actual inventory may change during operation. A verified snapshot must contain **every expected bucket** and meet a freshly checked, deliberately approved *per-bucket minimum*, not just an overall count. Lower a baseline only after checking legitimate removals; never lower it merely to make a failed backup succeed.

The old in-app weekly DB backup runner is separately broken (no `backups` Storage bucket, no runtime service key and old deployed PostgreSQL client in earlier live configuration). **Do not equate that failing runner with the separately owner-confirmed managed backup**. Do not disable it until the replacement and notification flow are tested. Track full recovery through [issue #364](https://github.com/carmaziums/carmazium/issues/364).

## Architecture and necessary existing capabilities

`backend/scripts/security/storage_offsite_backup.py` reads **all seven** production Supabase Storage buckets using Supabase's S3-compatible read path. It writes into an **already existing, independent AWS S3 vault** in a separately controlled account, with versioning, all four public-access blocks and an exact approved AWS KMS default encryption key. It does not create a paid bucket, buy a Supabase branch, alter live data, access the PostgreSQL database or handle Stripe or platform service-role credentials.

Before any real operation, independently confirm:

1. An existing independently controlled AWS S3 destination, current explicit owner approval for any associated data-transfer/Storage/KMS charges, versioning **Enabled**, public access **fully blocked**, a default **AWS KMS** key and an IAM identity without object-delete permission. Consider S3 Object Lock/retention if that existing bucket already supports it. The script **fails** if the expected bucket controls are absent; it does not silently downgrade encryption. Establish region, retention, incident notification and separate access audit. If this infrastructure does **not** exist, **STOP**: the operator must supply an approved existing vault or separately authorise new infrastructure.
2. An ephemeral/private **encrypted** Linux runner outside CarMazium's public Fly/Railway API, with Python 3.11+ and a reviewed compatible boto3/botocore installation. Run the validated, pinned standalone Python dependencies from a controlled environment. Do not attach source or destination secrets to GitHub Actions, public service variables, code, chat, logs, or external SimpleDMS communications. Provide at least 512 MiB available memory; each object is bounded to 128 MiB.
3. **Supabase Storage → Configuration → S3** enabled for the production project, with a newly generated **temporary** scoped access key/secret. Prefer the minimum available privileges and short-lived use. The S3 endpoint is locked in code to the reviewed production project; a normal Supabase service-role key is **not** required or allowed by the runner.
4. An AWS execution identity authorised only to access the approved vault prefix, list/read/write, and use the exact KMS encrypt/decrypt key, and a **separate randomly generated 32+-byte manifest signing key** stored outside both services. The runner must not be able to delete existing snapshots. Rotate/revoke temporary source access after the verified run.

**Do not** execute the real backup in GitHub CI, export or upload KYC/handover documents to GitHub artifacts, copy live private objects into the separate CarMazium Development project, create a new paid Supabase branch or issue SimpleDMS production credentials.

Official current provider documentation: [Supabase Storage S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility), [Storage download options](https://supabase.com/docs/guides/storage/management/download-objects), [managed database backup scope](https://supabase.com/docs/guides/platform/backups).

## Required read-only production inventory preflight

Run **read-only** in the production SQL editor or connected authorised database tool. This query reports counts but no customer file names:

```sql
SELECT b.id AS bucket, b.public, COUNT(o.id) AS objects
FROM storage.buckets AS b
LEFT JOIN storage.objects AS o ON o.bucket_id = b.id
GROUP BY b.id, b.public
ORDER BY b.id;
```

Review the seven actual buckets, privacy classification, any newly created buckets and the latest legitimate removals. Approve a new baseline in a **private operator configuration** (not GitHub). The example below reflects the point-in-time 3 October inspection only:

```text
BACKUP_MIN_OBJECTS=12196
BACKUP_MIN_BUCKET_COUNTS_JSON={"admin-broadcasts":0,"auction-handover-documents":9,"chat-attachments":0,"dealer-kyc-documents":59,"listings":12128,"sale-cancellation-evidence":0,"tradexchange-documents":0}
```

Any new or missing bucket requires a reviewed update to the exact seven-bucket allowlist and privacy status in the script; such a change must pass fresh tests before live execution.

## Isolated backup procedure — no credentials in command history

Load the following environment variables **inside the approved private secret-injected runner**. These are names, not values. Do not export values into shell history, paste values into a support conversation or save them to the repo:

```text
BACKUP_MODE=backup
BACKUP_APPROVED_LIVE_RUN=yes
BACKUP_ENCRYPTED_PRIVATE_RUNNER=yes
BACKUP_SOURCE_PROJECT_REF=<reviewed production project ref>
SUPABASE_S3_ACCESS_KEY_ID=<temporary private secret>
SUPABASE_S3_SECRET_ACCESS_KEY=<temporary private secret>
BACKUP_DEST_BUCKET=<existing independent versioned private AWS bucket>
BACKUP_DEST_KMS_KEY_ARN=<approved AWS KMS key ARN>
BACKUP_MANIFEST_HMAC_KEY_B64=<base64 encoding of independent random 32+ bytes>
BACKUP_MIN_OBJECTS=<freshly approved metadata count threshold>
BACKUP_MIN_BUCKET_COUNTS_JSON=<freshly approved complete seven-bucket minimum map>
AWS_REGION=<independent AWS vault region>
BACKUP_PRINT_SNAPSHOT_ID=yes
```

No `DATABASE_URL`, `BACKUP_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` or ordinary public-app credentials may be present. After preparing the reviewed environment in a private runner, execute the standalone script:

```bash
python3 backend/scripts/security/storage_offsite_backup.py
```

The job first verifies vault **versioning**, **four public blocks**, **exact default KMS key**, **independent endpoint**, and source bucket set/minima. For each listed object it copies the content into an **obfuscated destination object key**, verifies the live source has not changed, and **downloads the copied destination bytes to check exact SHA-256**. Individual objects are size-limited to 128 MiB. The manifest containing original paths is KMS-encrypted in the **private** vault, protected by a separate HMAC signing key. Only after all seven-bucket work and independent byte checks succeed will it place a `COMPLETE.json` marker. An interrupted/failed upload without this marker is **NOT** a backup. Normal output contains only aggregate per-bucket counts/total bytes; the optional snapshot ID must be retained in protected operator records.

This is a sequential best-effort *observed inventory snapshot*, **not a transactionally consistent point-in-time Supabase Storage snapshot**. Files created while copying may be captured on the next run. A file modified in the middle causes a hard failure. Schedule future private runs at a sensible cadence once the destination and recovery drills have been approved; monitor failed runs, deviations and vault retention.

## Source-independent restore drill

On a **separate** secure encrypted operator environment with *no Supabase keys, no live database network access and no customer-facing web service*, inject only the vault read and KMS decrypt identity and the independently stored HMAC key:

```text
BACKUP_MODE=verify
BACKUP_APPROVED_VERIFY_ONLY=yes
BACKUP_ENCRYPTED_PRIVATE_RUNNER=yes
BACKUP_DEST_BUCKET=<approved existing vault>
BACKUP_DEST_KMS_KEY_ARN=<approved KMS ARN>
BACKUP_MANIFEST_HMAC_KEY_B64=<same protected signing key>
BACKUP_VERIFY_SNAPSHOT=<protected immutable snapshot ID>
AWS_REGION=<vault region>
```

Run the same private script. It must retrieve the `COMPLETE.json` marker, retrieve the manifest from the **independent AWS vault**, validate the HMAC and sha256 of the manifest and read **every independently stored object byte** to verify its hash and category. It never contacts Supabase or copies files back into production. A missing/altered file or manifest fails the entire drill.

For a more tangible **one-sample-per-populated-bucket physical restore**, run with `BACKUP_MODE=restore_sample`, add `BACKUP_APPROVED_SAMPLE_RESTORE=yes`, and set `BACKUP_SAMPLE_RESTORE_DIR` to an existing absolute, operator-owned, **0700** directory on the encrypted isolated Linux runner. After verifying every object, this mode re-downloads one sample from each populated bucket, writes the samples to a new private temporary directory, verifies their hashes and immediately removes the temporary test files. It must never run on a public server, write personal documents into CI, or be pointed to production Storage. Save only aggregate success/failure evidence and the independently protected snapshot ID.

## Acceptance evidence and deployment gates

Keep [recovery issue #364](https://github.com/carmaziums/carmazium/issues/364) **OPEN** until all are documented:

- A fresh provider-managed DB backup timestamp with exact display time zone and a **real, non-production database restore exercise** proving usable application schema, grants and critical records.
- A successful **actual** offsite snapshot copying all seven source buckets with approved per-bucket counts, private destination versioning/KMS controls, source-read restrictions, completion marker, SHA-256 verification, stored snapshot ID and relevant protected audit evidence.
- An independent `verify` drill performed **without any Supabase credentials** and a private `restore_sample` exercise demonstrating actual KYC/handover bytes recover from the independent encrypted vault, without exposing those bytes or names in any logs.
- Private retention/immutability and IAM-delete restrictions, credential revocation, alerts, rerun strategy, and regular supervised repeat drills.
- Separately complete production-schema/RLS/DB-role security review [issue #356](https://github.com/carmaziums/carmazium/issues/356), and negotiate/sign the SimpleDMS historical-data/privacy schedule before releasing external production partner access.

**Known hard dependency:** Neither an independently controlled existing encrypted AWS vault nor privately injected short-lived Supabase S3 access keys is available through the current connected tools. The implementation and synthetic tests must not be represented as proof that live customer files are backed up. No paid resource or production restore is authorised by this document.
