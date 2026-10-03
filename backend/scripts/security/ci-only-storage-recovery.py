"""Synthetic-only Storage-object backup/restore contract; no live data or network."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import stat
import tarfile
import tempfile
import unittest

# Illustrative identifiers, deliberately NOT actual Supabase bucket names.
POLICY = {"sample-listings": False, "sample-private-kyc": True, "sample-private-handover": True}
SAMPLES = {
    ("sample-listings", "vehicle/sample-image.jpg"): b"SYNTHETIC-PUBLIC-PHOTO-\x00\xfe",
    ("sample-private-kyc", "dealer/sample-id.bin"): b"SYNTHETIC-PRIVATE-ID-\x01\xfd",
    ("sample-private-handover", "auction/sample-proof.bin"): b"SYNTHETIC-PRIVATE-HANDOVER-\x02\xfc",
}


def valid_key(bucket, key):
    p = PurePosixPath(key)
    if bucket not in POLICY or not key or p.is_absolute() or any(x in ("", ".", "..") for x in key.split("/")) or "\\" in key:
        raise ValueError("Unapproved bucket or unsafe object key")
    return f"objects/{bucket}/{key}"


def write_backup(archive, manifest_path, objects=SAMPLES):
    manifest = []
    archive.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tarfile.open(archive, "w:gz") as tar:
        for (bucket, key), data in sorted(objects.items()):
            name = valid_key(bucket, key)
            manifest.append({"bucket": bucket, "key": key, "private": POLICY[bucket], "size": len(data),
                             "sha256": hashlib.sha256(data).hexdigest()})
            item = tarfile.TarInfo(name)
            item.size, item.mode = len(data), (0o600 if POLICY[bucket] else 0o644)
            tar.addfile(item, io.BytesIO(data))
    manifest_path.write_text(json.dumps(manifest, sort_keys=True))
    archive.chmod(0o600)
    manifest_path.chmod(0o600)
    return manifest


def verified_restore(archive, manifest_path, destination):
    """Reject the entire archive before writing if it deviates from the protected manifest."""
    manifest = json.loads(manifest_path.read_text())
    expected = {}
    for item in manifest:
        name = valid_key(item["bucket"], item["key"])
        if name in expected or type(item["private"]) is not bool or POLICY[item["bucket"]] != item["private"]:
            raise ValueError("Duplicate object or invalid privacy classification")
        expected[name] = item
    checked = {}
    with tarfile.open(archive, "r:gz") as tar:
        members = tar.getmembers()
        if len(members) != len(expected) or {m.name for m in members} != set(expected):
            raise ValueError("Archive and manifest object sets differ")
        for member in members:
            if not member.isfile() or member.issym() or member.islnk():
                raise ValueError("Non-regular object in archive")
            item = expected[member.name]
            payload = tar.extractfile(member).read()
            if len(payload) != item["size"] or hashlib.sha256(payload).hexdigest() != item["sha256"]:
                raise ValueError("Archive content does not match manifest")
            checked[member.name] = payload
    # This routine only restores to a fresh, disposable synthetic destination.
    if destination.exists():
        raise ValueError("Refuse to replace an existing restore destination")
    destination.mkdir(mode=0o700, parents=True)
    for name, payload in checked.items():
        item = expected[name]
        target = destination.joinpath(*PurePosixPath(name).parts)
        bucket_dir = destination / "objects" / item["bucket"]
        bucket_dir.mkdir(mode=0o700 if item["private"] else 0o755, parents=True, exist_ok=True)
        bucket_dir.chmod(0o700 if item["private"] else 0o755)
        target.parent.mkdir(mode=0o700 if item["private"] else 0o755, parents=True, exist_ok=True)
        target.parent.chmod(0o700 if item["private"] else 0o755)
        target.write_bytes(payload)
        target.chmod(0o600 if item["private"] else 0o644)
    return len(checked)


class SyntheticStorageRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.sandbox = tempfile.TemporaryDirectory(prefix="synthetic-storage-only-")
        self.addCleanup(self.sandbox.cleanup)
        self.base = Path(self.sandbox.name)
        self.archive = self.base / "vault" / "objects.tar.gz"
        self.manifest = self.base / "vault" / "manifest.json"
        self.destination = self.base / "isolated-restore"
        write_backup(self.archive, self.manifest)

    def test_full_public_and_private_round_trip(self):
        self.assertEqual(verified_restore(self.archive, self.manifest, self.destination), 3)
        for (bucket, key), expected in SAMPLES.items():
            self.assertEqual((self.destination / "objects" / bucket / key).read_bytes(), expected)

    def test_backup_metadata_not_public(self):
        self.assertEqual(stat.S_IMODE(self.archive.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.manifest.stat().st_mode), 0o600)

    def test_restored_private_files_not_world_readable(self):
        verified_restore(self.archive, self.manifest, self.destination)
        for bucket in ("sample-private-kyc", "sample-private-handover"):
            folder = self.destination / "objects" / bucket
            self.assertEqual(stat.S_IMODE(folder.stat().st_mode), 0o700)
            for path in folder.rglob("*"):
                if path.is_file():
                    self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_manifest_mismatch_fails_before_any_restore(self):
        values = json.loads(self.manifest.read_text())
        values[0]["sha256"] = "0" * 64
        self.manifest.write_text(json.dumps(values))
        with self.assertRaises(ValueError):
            verified_restore(self.archive, self.manifest, self.destination)
        self.assertFalse(self.destination.exists())

    def test_missing_archive_object_rejected(self):
        missing = dict(SAMPLES)
        missing.pop(next(iter(missing)))
        write_backup(self.archive, self.manifest, missing)
        values = json.loads(self.manifest.read_text())
        values.append({"bucket": "sample-listings", "key": "missing/image.jpg", "private": False,
                       "size": 0, "sha256": hashlib.sha256(b"").hexdigest()})
        self.manifest.write_text(json.dumps(values))
        with self.assertRaises(ValueError):
            verified_restore(self.archive, self.manifest, self.destination)
        self.assertFalse(self.destination.exists())

    def test_path_traversal_rejected(self):
        values = json.loads(self.manifest.read_text())
        values[0]["key"] = "../escape"
        self.manifest.write_text(json.dumps(values))
        with self.assertRaises(ValueError):
            verified_restore(self.archive, self.manifest, self.destination)
        self.assertFalse(self.destination.exists())

    def test_privacy_downgrade_rejected(self):
        values = json.loads(self.manifest.read_text())
        next(x for x in values if x["private"])["private"] = False
        self.manifest.write_text(json.dumps(values))
        with self.assertRaises(ValueError):
            verified_restore(self.archive, self.manifest, self.destination)
        self.assertFalse(self.destination.exists())

    def test_existing_destination_never_overwritten(self):
        self.destination.mkdir()
        with self.assertRaises(ValueError):
            verified_restore(self.archive, self.manifest, self.destination)


if __name__ == "__main__":
    unittest.main(verbosity=2)
