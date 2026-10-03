#!/usr/bin/env python3
"""Private, manually authorised CarMazium Supabase Storage -> independent AWS S3 backup.

Not a web API, cron task, GitHub Actions live-data job or a replacement for
managed PostgreSQL backups. Production execution needs privately configured
Supabase S3 credentials and a pre-existing independent AWS KMS-protected vault.
Never print source paths, object bytes, IAM credentials or object-key metadata.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import os
import secrets
import sys
from datetime import datetime, timezone

# Explicit production allowlist. An unexpected NEW bucket blocks completion.
# This list is metadata only; no customer records or object names are committed.
BUCKET_PRIVACY = {
    "admin-broadcasts": False,
    "auction-handover-documents": True,
    "chat-attachments": True,
    "dealer-kyc-documents": True,
    "listings": False,
    "sale-cancellation-evidence": True,
    "tradexchange-documents": True,
}
LIVE_PROJECT_REF = "bwtnzmevjlowwronylxm"
MAX_SINGLE_OBJECT = 128 * 1024 * 1024  # observed bucket limits max at 100 MiB
PUBLIC_BLOCK_SETTINGS = ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")


class BackupUnsafe(RuntimeError):
    """Safe failure messages only; do not wrap raw boto3/provider errors in logs."""


def canonical(record):
    return json.dumps(record, sort_keys=True, separators=(",", ":")).encode("utf-8")


def expected_vault(dest, vault_bucket, kms_arn):
    """Verify the EXISTING independent vault; never create a bucket or grant."""
    try:
        if dest.get_bucket_versioning(Bucket=vault_bucket).get("Status") != "Enabled":
            raise BackupUnsafe("Independent vault bucket versioning is required")
        block = dest.get_public_access_block(Bucket=vault_bucket)["PublicAccessBlockConfiguration"]
        if not all(block.get(setting) is True for setting in PUBLIC_BLOCK_SETTINGS):
            raise BackupUnsafe("Independent vault must block all public access")
        rules = dest.get_bucket_encryption(Bucket=vault_bucket)["ServerSideEncryptionConfiguration"]["Rules"]
        if not any(
            rule["ApplyServerSideEncryptionByDefault"].get("SSEAlgorithm") == "aws:kms"
            and rule["ApplyServerSideEncryptionByDefault"].get("KMSMasterKeyID") == kms_arn
            for rule in rules
        ):
            raise BackupUnsafe("Independent vault must default to the approved KMS key")
    except BackupUnsafe:
        raise
    except Exception:
        raise BackupUnsafe("Could not verify independent vault versioning, privacy and KMS") from None


def enumerate_source(source):
    """Read only. Deterministic inventory; never silently omit newly created buckets."""
    try:
        got = {b["Name"] for b in source.list_buckets()["Buckets"]}
        if got != set(BUCKET_PRIVACY):
            raise BackupUnsafe("Source bucket inventory differs from the reviewed seven-bucket allowlist")
        inventory = []
        for bucket in sorted(BUCKET_PRIVACY):
            continuation = None
            seen = set()
            while True:
                opts = {"Bucket": bucket, "MaxKeys": 1000}
                if continuation:
                    opts["ContinuationToken"] = continuation
                page = source.list_objects_v2(**opts)
                for item in page.get("Contents", []):
                    key, size = item["Key"], item["Size"]
                    if not isinstance(key, str) or not key or key in seen or size < 0 or size > MAX_SINGLE_OBJECT:
                        raise BackupUnsafe("Source contains duplicate, invalid or oversized object")
                    seen.add(key)
                    inventory.append((bucket, key, size, item.get("ETag", "")))
                if not page.get("IsTruncated"):
                    break
                continuation = page.get("NextContinuationToken")
                if not continuation:
                    raise BackupUnsafe("Incomplete source inventory pagination")
        return inventory
    except BackupUnsafe:
        raise
    except Exception:
        raise BackupUnsafe("Source Storage inventory was not fully accessible") from None


def vault_key(prefix, bucket, key):
    # Obscures customer filenames/VRMs from independent vault *object keys*.
    digest = hashlib.sha256((bucket + "\0" + key).encode()).hexdigest()
    category = base64.urlsafe_b64encode(bucket.encode()).decode().rstrip("=")
    return f"{prefix}/objects/{category}/{digest}"


def read_bounded(body, expected_size):
    try:
        payload = body.read(MAX_SINGLE_OBJECT + 1)
        if len(payload) != expected_size or len(payload) > MAX_SINGLE_OBJECT:
            raise BackupUnsafe("Source object changed size or exceeded permitted limit")
        return payload
    finally:
        close = getattr(body, "close", None)
        if callable(close):
            close()


def assert_restorable(dest, bucket, key, expected_sha, expected_size):
    try:
        fetched = dest.get_object(Bucket=bucket, Key=key)
        restored = read_bounded(fetched["Body"], expected_size)
        if hashlib.sha256(restored).hexdigest() != expected_sha:
            raise BackupUnsafe("Independent vault checksum verification failed")
    except BackupUnsafe:
        raise
    except Exception:
        raise BackupUnsafe("Could not retrieve backed-up bytes from independent vault") from None


def make_snapshot(source, dest, vault_bucket, kms_arn, mac_key, min_objects,
                  now=None, nonce=None, min_bucket_counts=None):
    """Fail closed. COMPLETE sentinel written last, after real restore reads."""
    if len(mac_key) < 32 or min_objects < 1:
        raise BackupUnsafe("Private manifest signing key and minimum object count required")
    if getattr(source.meta, "endpoint_url", "") == getattr(dest.meta, "endpoint_url", ""):
        raise BackupUnsafe("Storage backup vault must be an independent endpoint")
    expected_vault(dest, vault_bucket, kms_arn)
    inventory = enumerate_source(source)
    if len(inventory) < min_objects:
        raise BackupUnsafe("Source inventory fell below approved minimum object count")
    source_counts = {bucket: sum(1 for entry in inventory if entry[0] == bucket)
                     for bucket in BUCKET_PRIVACY}
    if min_bucket_counts is not None:
        if set(min_bucket_counts) != set(BUCKET_PRIVACY) or any(
            type(v) is not int or v < 0 or source_counts[k] < v
            for k, v in min_bucket_counts.items()
        ):
            raise BackupUnsafe("Source inventory fell below approved per-bucket minimum")
    instant = now or datetime.now(timezone.utc)
    nonce = nonce or secrets.token_hex(12)
    prefix = f"carmazium-storage/v1/{instant.strftime('%Y%m%dT%H%M%SZ')}-{nonce}"
    try:
        preexisting = dest.list_objects_v2(Bucket=vault_bucket, Prefix=prefix + "/", MaxKeys=1)
        if preexisting.get("Contents"):
            raise BackupUnsafe("Snapshot destination already exists; refusing overwrite")
    except BackupUnsafe:
        raise
    except Exception:
        raise BackupUnsafe("Could not confirm an unused independent-vault snapshot path") from None
    kwargs = {"ServerSideEncryption": "aws:kms", "SSEKMSKeyId": kms_arn}
    manifest = {"schema": 1, "snapshot": prefix, "captured_utc": instant.isoformat(),
                "complete": True, "source": "CarMazium Supabase Storage",
                "buckets": {k: {"private": v} for k, v in sorted(BUCKET_PRIVACY.items())},
                "objects": []}
    counts = {k: 0 for k in BUCKET_PRIVACY}
    for bucket, key, size, etag in inventory:
        try:
            received = source.get_object(Bucket=bucket, Key=key)
            if int(received.get("ContentLength", -1)) != size:
                raise BackupUnsafe("Source object length changed during backup")
            payload = read_bounded(received["Body"], size)
            observed = source.head_object(Bucket=bucket, Key=key)
            if observed.get("ContentLength") != size or (etag and observed.get("ETag") != etag):
                raise BackupUnsafe("Source object changed while being backed up")
            sha = hashlib.sha256(payload).hexdigest()
            output_key = vault_key(prefix, bucket, key)
            dest.put_object(Bucket=vault_bucket, Key=output_key, Body=payload, **kwargs)
            # This is an actual independent restore read, not a metadata-only HEAD.
            assert_restorable(dest, vault_bucket, output_key, sha, size)
            manifest["objects"].append({
                "bucket": bucket, "key": key, "private": BUCKET_PRIVACY[bucket],
                "bytes": size, "sha256": sha, "vault_key": output_key,
            })
            counts[bucket] += 1
        except BackupUnsafe:
            raise
        except Exception:
            raise BackupUnsafe("Private object copying or verification failed; snapshot incomplete") from None
    manifest["counts"] = counts
    raw = canonical(manifest)
    signature = hmac.new(mac_key, raw, hashlib.sha256).hexdigest()
    manifest_key = prefix + "/manifest.json"
    try:
        dest.put_object(Bucket=vault_bucket, Key=manifest_key, Body=raw, **kwargs)
        saved = dest.get_object(Bucket=vault_bucket, Key=manifest_key)
        if read_bounded(saved["Body"], len(raw)) != raw:
            raise BackupUnsafe("Manifest read-back failed")
        completion = canonical({"schema": 1, "manifest_sha256": hashlib.sha256(raw).hexdigest(),
                                "manifest_hmac_sha256": signature, "objects": len(inventory),
                                "verified_bytes": sum(x[2] for x in inventory)})
        dest.put_object(Bucket=vault_bucket, Key=prefix + "/COMPLETE.json",
                        Body=completion, **kwargs)
        assert_restorable(dest, vault_bucket, prefix + "/COMPLETE.json",
                          hashlib.sha256(completion).hexdigest(), len(completion))
    except BackupUnsafe:
        raise
    except Exception:
        raise BackupUnsafe("Could not atomically mark verified snapshot complete") from None
    return {"snapshot": prefix, "objects": len(inventory), "verified_bytes": sum(x[2] for x in inventory),
            "bucket_counts": counts}


def verify_without_source(dest, vault_bucket, kms_arn, mac_key, prefix):
    """Disaster drill: verify every vaulted byte without any Supabase access.

    This does not write production objects, fetch live credentials or create
    any restore infrastructure. The bytes remain in encrypted private memory.
    """
    import re
    if len(mac_key) < 32 or not re.fullmatch(
        r"carmazium-storage/v1/\d{8}T\d{6}Z-[a-f0-9]{24}", prefix
    ):
        raise BackupUnsafe("Valid private key and immutable snapshot identifier required")
    expected_vault(dest, vault_bucket, kms_arn)
    try:
        complete_body = dest.get_object(Bucket=vault_bucket, Key=prefix + "/COMPLETE.json")
        completion_raw = read_bounded(complete_body["Body"], complete_body["ContentLength"])
        completion = json.loads(completion_raw)
        manifest_body = dest.get_object(Bucket=vault_bucket, Key=prefix + "/manifest.json")
        manifest_raw = read_bounded(manifest_body["Body"], manifest_body["ContentLength"])
    except BackupUnsafe:
        raise
    except Exception:
        raise BackupUnsafe("Snapshot is incomplete or manifest cannot be retrieved") from None
    if completion.get("schema") != 1 or \
       not hmac.compare_digest(completion.get("manifest_sha256", ""),
                               hashlib.sha256(manifest_raw).hexdigest()) or \
       not hmac.compare_digest(completion.get("manifest_hmac_sha256", ""),
                               hmac.new(mac_key, manifest_raw, hashlib.sha256).hexdigest()):
        raise BackupUnsafe("Independent backup manifest failed integrity/authenticity checks")
    try:
        manifest = json.loads(manifest_raw)
        objects = manifest["objects"]
        if manifest["schema"] != 1 or manifest["snapshot"] != prefix or \
           manifest["buckets"] != {k: {"private": v} for k, v in sorted(BUCKET_PRIVACY.items())} \
           or not objects or len(objects) != completion["objects"]:
            raise BackupUnsafe("Independent backup manifest schema, scope or count invalid")
        seen = set()
        verified_bytes = 0
        counts = {k: 0 for k in BUCKET_PRIVACY}
        for item in objects:
            bucket, key = item["bucket"], item["key"]
            if bucket not in BUCKET_PRIVACY or item["private"] is not BUCKET_PRIVACY[bucket] \
               or not isinstance(key, str) or not key or (bucket, key) in seen \
               or item["vault_key"] != vault_key(prefix, bucket, key) \
               or item["bytes"] < 0 or item["bytes"] > MAX_SINGLE_OBJECT:
                raise BackupUnsafe("Independent backup manifest object entry invalid")
            seen.add((bucket, key))
            assert_restorable(dest, vault_bucket, item["vault_key"],
                              item["sha256"], item["bytes"])
            verified_bytes += item["bytes"]
            counts[bucket] += 1
        if verified_bytes != completion["verified_bytes"] or counts != manifest["counts"]:
            raise BackupUnsafe("Independent backup inventory or byte totals do not match")
        return {"status": "RESTORE_BYTES_VERIFIED", "objects": len(objects),
                "verified_bytes": verified_bytes, "bucket_counts": counts}
    except BackupUnsafe:
        raise
    except Exception:
        raise BackupUnsafe("Independent recovery verification failed") from None


def load_config(env):
    """No secrets are accepted on the command line or written to any logs."""
    required = ("BACKUP_APPROVED_LIVE_RUN", "BACKUP_ENCRYPTED_PRIVATE_RUNNER",
                "SUPABASE_S3_ACCESS_KEY_ID", "SUPABASE_S3_SECRET_ACCESS_KEY",
                "BACKUP_DEST_BUCKET", "BACKUP_DEST_KMS_KEY_ARN",
                "BACKUP_MANIFEST_HMAC_KEY_B64", "BACKUP_MIN_OBJECTS",
                "BACKUP_MIN_BUCKET_COUNTS_JSON", "BACKUP_SOURCE_PROJECT_REF", "AWS_REGION")
    if any(not env.get(k) for k in required) or env["BACKUP_APPROVED_LIVE_RUN"] != "yes" \
       or env["BACKUP_ENCRYPTED_PRIVATE_RUNNER"] != "yes" \
       or env["BACKUP_SOURCE_PROJECT_REF"] != LIVE_PROJECT_REF:
        raise BackupUnsafe("Approved isolated runner, complete credentials and exact live source required")
    if any(env.get(k) for k in ("DATABASE_URL", "BACKUP_DATABASE_URL",
                                "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY")):
        raise BackupUnsafe("Private Storage runner must not inherit database or payment credentials")
    try:
        key = base64.b64decode(env["BACKUP_MANIFEST_HMAC_KEY_B64"], validate=True)
        minimum = int(env["BACKUP_MIN_OBJECTS"])
        minima = json.loads(env["BACKUP_MIN_BUCKET_COUNTS_JSON"])
        if len(key) < 32 or minimum < 1 or not isinstance(minima, dict) or \
           set(minima) != set(BUCKET_PRIVACY) or any(
               type(v) is not int or v < 0 for v in minima.values()
           ):
            raise ValueError()
    except (ValueError, TypeError):
        raise BackupUnsafe("Invalid private manifest signing key or minimum inventory") from None
    arn = env["BACKUP_DEST_KMS_KEY_ARN"]
    if not arn.startswith("arn:aws:kms:") or env["BACKUP_DEST_BUCKET"] in BUCKET_PRIVACY:
        raise BackupUnsafe("Independent AWS S3 bucket and KMS key required")
    return key, minimum, minima


def main():
    try:
        mode = os.environ.get("BACKUP_MODE", "backup")
        if mode == "verify":
            if os.environ.get("BACKUP_ENCRYPTED_PRIVATE_RUNNER") != "yes" or \
               os.environ.get("BACKUP_APPROVED_VERIFY_ONLY") != "yes" or \
               any(os.environ.get(k) for k in (
                   "SUPABASE_S3_SECRET_ACCESS_KEY", "SUPABASE_SERVICE_ROLE_KEY",
                   "DATABASE_URL", "BACKUP_DATABASE_URL", "STRIPE_SECRET_KEY")):
                raise BackupUnsafe("Independent restore drill requires a separate private runner without live secrets")
            cfg = os.environ
            try:
                signing = base64.b64decode(cfg["BACKUP_MANIFEST_HMAC_KEY_B64"], validate=True)
                if len(signing) < 32:
                    raise ValueError()
                from botocore.config import Config  # only after private checks
                import boto3
                dest = boto3.client("s3", region_name=cfg["AWS_REGION"],
                                    config=Config(signature_version="s3v4"))
                out = verify_without_source(dest, cfg["BACKUP_DEST_BUCKET"],
                                            cfg["BACKUP_DEST_KMS_KEY_ARN"],
                                            signing, cfg["BACKUP_VERIFY_SNAPSHOT"])
            except (KeyError, ValueError):
                raise BackupUnsafe("Independent restore drill configuration incomplete") from None
        elif mode == "backup":
            key, minimum, minima = load_config(os.environ)
            import boto3
            from botocore.config import Config
            source = boto3.client(
                "s3",
                endpoint_url=f"https://{LIVE_PROJECT_REF}.supabase.co/storage/v1/s3",
                region_name="eu-west-2",
                aws_access_key_id=os.environ["SUPABASE_S3_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["SUPABASE_S3_SECRET_ACCESS_KEY"],
                config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            )
            dest = boto3.client("s3", region_name=os.environ["AWS_REGION"])
            out = make_snapshot(source, dest, os.environ["BACKUP_DEST_BUCKET"],
                                os.environ["BACKUP_DEST_KMS_KEY_ARN"], key, minimum,
                                min_bucket_counts=minima)
            out["status"] = "VERIFIED"
            # Record the immutable snapshot ID ONLY in protected operator logs.
            # Do not log paths, raw keys or the signed manifest to CI artifacts.
            if os.environ.get("BACKUP_PRINT_SNAPSHOT_ID") == "yes":
                print("INDEPENDENT_SNAPSHOT_ID=" + out["snapshot"])
        else:
            raise BackupUnsafe("Unsupported backup operation")
        print(json.dumps({"status": out["status"], "objects": out["objects"],
                          "verified_bytes": out["verified_bytes"],
                          "bucket_counts": out["bucket_counts"]}, sort_keys=True))
    except BackupUnsafe as exc:
        print("STORAGE_BACKUP_FAILED: " + str(exc), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("STORAGE_BACKUP_FAILED: private-runner failure; inspect protected logs",
              file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
