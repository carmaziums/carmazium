#!/usr/bin/env python3
"""Offline synthetic contract tests for the independently encrypted backup runner.

These fakes never access any real Supabase bucket, AWS vault, production object,
customer data, service key or network resource.
"""
import base64
import hashlib
import hmac
import io
import json
import os
import sys
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from storage_offsite_backup import (
    BackupUnsafe, BUCKET_PRIVACY, canonical, enumerate_source, expected_vault,
    load_config, make_snapshot, verify_without_source, vault_key,
)

KMS = "arn:aws:kms:eu-west-2:123456789012:key/fictional-synthetic"
VAULT = "independent-example-private-vault"
MAC = b"synthetic-only-test-signing-key-40bytes-test!"
WHEN = datetime(2026, 10, 3, 10, 0, tzinfo=timezone.utc)
NONCE = "0123456789abcdeffedcba98"


class FakeSource:
    def __init__(self, objects=None):
        self.objects = objects or {
            (bucket, f"fictional/nested/{bucket}.txt"):
                (f"SYNTHETIC-ONLY-{bucket}").encode()
            for bucket in BUCKET_PRIVACY
        }
        self.buckets = set(BUCKET_PRIVACY)
        self.meta = SimpleNamespace(endpoint_url="https://fictional.supabase.co/storage/v1/s3")
        self.change_head = False
        self.duplicate_page = False

    def list_buckets(self):
        return {"Buckets": [{"Name": b} for b in sorted(self.buckets)]}

    def list_objects_v2(self, **kwargs):
        bucket = kwargs["Bucket"]
        values = sorted((key, body) for (b, key), body in self.objects.items() if b == bucket)
        offset = int(kwargs.get("ContinuationToken", "0"))
        page_size = min(kwargs.get("MaxKeys", 1000), 2)  # exercise real pagination
        batch = values[offset:offset + page_size]
        rows = [{"Key": key, "Size": len(body), "ETag": hashlib.sha256(body).hexdigest()}
                for key, body in batch]
        if self.duplicate_page and offset:
            rows.append({"Key": values[0][0], "Size": len(values[0][1]),
                         "ETag": hashlib.sha256(values[0][1]).hexdigest()})
        end = offset + page_size
        return {"Contents": rows, "IsTruncated": end < len(values),
                **({"NextContinuationToken": str(end)} if end < len(values) else {})}

    def get_object(self, **kwargs):
        blob = self.objects[(kwargs["Bucket"], kwargs["Key"])]
        return {"Body": io.BytesIO(blob), "ContentLength": len(blob)}

    def head_object(self, **kwargs):
        blob = self.objects[(kwargs["Bucket"], kwargs["Key"])]
        e = hashlib.sha256(blob).hexdigest()
        if self.change_head:
            e = "changed-mid-snapshot"
        return {"ContentLength": len(blob), "ETag": e}


class FakeVault:
    def __init__(self):
        self.meta = SimpleNamespace(endpoint_url="https://s3.eu-west-2.amazonaws.com")
        self.objects = {}
        self.public = False
        self.versioning = "Enabled"
        self.kms = KMS
        self.corrupt_new_read = False
        self.deny_new_read = False

    def get_bucket_versioning(self, **kwargs):
        return {"Status": self.versioning}

    def get_public_access_block(self, **kwargs):
        return {"PublicAccessBlockConfiguration": {
            k: not self.public for k in (
                "BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")
        }}

    def get_bucket_encryption(self, **kwargs):
        return {"ServerSideEncryptionConfiguration": {"Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "aws:kms", "KMSMasterKeyID": self.kms}
        }]}}

    def list_objects_v2(self, **kwargs):
        prefix = kwargs.get("Prefix", "")
        keys = [x for x in self.objects if x.startswith(prefix)]
        return {"Contents": [{"Key": k} for k in keys]}

    def put_object(self, **kwargs):
        assert kwargs["Bucket"] == VAULT
        assert kwargs["ServerSideEncryption"] == "aws:kms"
        assert kwargs["SSEKMSKeyId"] == KMS
        assert kwargs["Key"] not in self.objects, "no overwrite"
        self.objects[kwargs["Key"]] = bytes(kwargs["Body"])

    def get_object(self, **kwargs):
        key = kwargs["Key"]
        if self.deny_new_read and "/objects/" in key:
            raise OSError("synthetic read denied")
        blob = self.objects[key]
        if self.corrupt_new_read and "/objects/" in key:
            blob = b"tampered-vault-bytes"
        return {"Body": io.BytesIO(blob), "ContentLength": len(blob)}


def snapshot(src=None, vault=None, minimum=7):
    src = src or FakeSource()
    vault = vault or FakeVault()
    report = make_snapshot(src, vault, VAULT, KMS, MAC, minimum,
                           now=WHEN, nonce=NONCE)
    return src, vault, report


class IndependentOffsiteBackupTests(unittest.TestCase):
    def test_all_seven_public_private_buckets_and_manifest_roundtrip(self):
        source, vault, report = snapshot()
        self.assertEqual(report["objects"], 7)
        self.assertEqual(report["verified_bytes"], sum(map(len, source.objects.values())))
        self.assertEqual(set(report["bucket_counts"]), set(BUCKET_PRIVACY))
        self.assertTrue(all(v == 1 for v in report["bucket_counts"].values()))
        prefix = report["snapshot"]
        self.assertTrue(prefix + "/COMPLETE.json" in vault.objects)
        self.assertFalse(any("fictional/nested" in key for key in vault.objects))
        independently = verify_without_source(vault, VAULT, KMS, MAC, prefix)
        self.assertEqual(independently["status"], "RESTORE_BYTES_VERIFIED")
        self.assertEqual(independently["objects"], 7)

    def test_recovery_without_any_source_connection_or_supabase_credentials(self):
        source, vault, report = snapshot()
        source.objects.clear()
        recovered = verify_without_source(vault, VAULT, KMS, MAC, report["snapshot"])
        self.assertEqual(recovered["bucket_counts"]["dealer-kyc-documents"], 1)

    def test_enumerates_paginated_source_without_losing_items(self):
        source = FakeSource()
        source.objects.update({("listings", f"synthetic/more/{i}.jpg"): bytes([i]) for i in range(6)})
        self.assertEqual(len(enumerate_source(source)), 13)
        report = make_snapshot(source, FakeVault(), VAULT, KMS, MAC, 13,
                               now=WHEN, nonce=NONCE)
        self.assertEqual(report["bucket_counts"]["listings"], 7)

    def test_unrecognised_or_missing_bucket_cannot_be_silently_skipped(self):
        for action in ("add", "remove"):
            source = FakeSource()
            if action == "add":
                source.buckets.add("new-untested-private-bucket")
            else:
                source.buckets.remove("dealer-kyc-documents")
            vault = FakeVault()
            with self.assertRaisesRegex(BackupUnsafe, "allowlist"):
                make_snapshot(source, vault, VAULT, KMS, MAC, 1)
            self.assertEqual(vault.objects, {})

    def test_independent_vault_privacy_versioning_and_kms_are_required(self):
        for key, bad in (("public", True), ("versioning", "Suspended"), ("kms", "AES256")):
            vault = FakeVault()
            setattr(vault, key, bad)
            with self.assertRaises(BackupUnsafe):
                make_snapshot(FakeSource(), vault, VAULT, KMS, MAC, 7)
            self.assertFalse(vault.objects)

    def test_inventory_floor_and_separate_endpoints_are_required(self):
        src, vault = FakeSource(), FakeVault()
        with self.assertRaisesRegex(BackupUnsafe, "minimum"):
            make_snapshot(src, vault, VAULT, KMS, MAC, 12)
        vault.meta.endpoint_url = src.meta.endpoint_url
        with self.assertRaisesRegex(BackupUnsafe, "independent"):
            make_snapshot(src, vault, VAULT, KMS, MAC, 1)

    def test_source_mutation_refuses_to_complete_snapshot(self):
        src, vault = FakeSource(), FakeVault()
        src.change_head = True
        with self.assertRaisesRegex(BackupUnsafe, "changed"):
            make_snapshot(src, vault, VAULT, KMS, MAC, 7, now=WHEN, nonce=NONCE)
        self.assertNotIn(f"carmazium-storage/v1/20261003T100000Z-{NONCE}/COMPLETE.json",
                         vault.objects)

    def test_vault_download_corruption_never_marks_backup_complete(self):
        src, vault = FakeSource(), FakeVault()
        vault.corrupt_new_read = True
        with self.assertRaisesRegex(BackupUnsafe, "checksum"):
            make_snapshot(src, vault, VAULT, KMS, MAC, 7, now=WHEN, nonce=NONCE)
        self.assertFalse(any(x.endswith("COMPLETE.json") for x in vault.objects))

    def test_vault_download_error_never_marks_backup_complete(self):
        src, vault = FakeSource(), FakeVault()
        vault.deny_new_read = True
        with self.assertRaisesRegex(BackupUnsafe, "Could not retrieve"):
            make_snapshot(src, vault, VAULT, KMS, MAC, 7, now=WHEN, nonce=NONCE)
        self.assertFalse(any(x.endswith("COMPLETE.json") for x in vault.objects))

    def test_tampered_manifest_or_blob_is_detected_on_offsite_drill(self):
        _, vault, report = snapshot()
        prefix = report["snapshot"]
        m = prefix + "/manifest.json"
        saved = vault.objects[m]
        vault.objects[m] = saved[:-1] + b" "
        with self.assertRaisesRegex(BackupUnsafe, "integrity"):
            verify_without_source(vault, VAULT, KMS, MAC, prefix)
        vault.objects[m] = saved
        blob_key = next(k for k in vault.objects if "/objects/" in k)
        vault.objects[blob_key] = b"altered"
        with self.assertRaises(BackupUnsafe):
            verify_without_source(vault, VAULT, KMS, MAC, prefix)

    def test_forged_manifest_references_cannot_be_recovered_even_with_mac(self):
        _, vault, report = snapshot()
        prefix = report["snapshot"]
        m = prefix + "/manifest.json"
        cp = prefix + "/COMPLETE.json"
        data = json.loads(vault.objects[m])
        data["objects"][0]["vault_key"] = prefix + "/objects/traversal"
        raw = canonical(data)
        vault.objects[m] = raw
        c = json.loads(vault.objects[cp])
        c["manifest_sha256"] = hashlib.sha256(raw).hexdigest()
        c["manifest_hmac_sha256"] = hmac.new(MAC, raw, hashlib.sha256).hexdigest()
        vault.objects[cp] = canonical(c)
        with self.assertRaisesRegex(BackupUnsafe, "entry invalid"):
            verify_without_source(vault, VAULT, KMS, MAC, prefix)

    def test_existing_snapshot_prefix_never_overwritten(self):
        source, vault, _ = snapshot()
        with self.assertRaisesRegex(BackupUnsafe, "already exists"):
            make_snapshot(source, vault, VAULT, KMS, MAC, 7, now=WHEN, nonce=NONCE)

    def test_wrong_hmac_key_or_bad_identifier_fails_offsite_restore(self):
        _, vault, report = snapshot()
        for mac, prefix in ((b"this-is-the-wrong-very-long-secret-12345", report["snapshot"]),
                            (MAC, "../invalid")):
            with self.assertRaises(BackupUnsafe):
                verify_without_source(vault, VAULT, KMS, mac, prefix)

    def test_fail_closed_live_runner_environment(self):
        good = {
            "BACKUP_APPROVED_LIVE_RUN": "yes", "BACKUP_ENCRYPTED_PRIVATE_RUNNER": "yes",
            "SUPABASE_S3_ACCESS_KEY_ID": "SYNTHETIC",
            "SUPABASE_S3_SECRET_ACCESS_KEY": "SYNTHETIC",
            "BACKUP_DEST_BUCKET": VAULT,
            "BACKUP_DEST_KMS_KEY_ARN": KMS,
            "BACKUP_MANIFEST_HMAC_KEY_B64": base64.b64encode(MAC).decode(),
            "BACKUP_MIN_OBJECTS": "12000", "BACKUP_SOURCE_PROJECT_REF": "bwtnzmevjlowwronylxm",
            "AWS_REGION": "eu-west-2",
        }
        secret, minimum = load_config(good)
        self.assertEqual(secret, MAC)
        self.assertEqual(minimum, 12000)
        for change in (
            {"DATABASE_URL": "synthetic-invalid-db-url"},
            {"SUPABASE_SERVICE_ROLE_KEY": "synthetic-unexpected-key"},
            {"STRIPE_SECRET_KEY": "synthetic-unexpected-key"},
            {"BACKUP_APPROVED_LIVE_RUN": "no"},
            {"BACKUP_SOURCE_PROJECT_REF": "other-project"},
            {"BACKUP_MIN_OBJECTS": "0"},
            {"BACKUP_MANIFEST_HMAC_KEY_B64": "bad-invalid"},
        ):
            with self.subTest(change=set(change)):
                with self.assertRaises(BackupUnsafe):
                    load_config({**good, **change})


if __name__ == "__main__":
    unittest.main(verbosity=2)
