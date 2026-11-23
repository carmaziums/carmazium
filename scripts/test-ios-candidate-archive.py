#!/usr/bin/env python3
"""Synthetic IPA rejection tests; never contacts Expo or Apple."""
import hashlib
import importlib.util
import json
import plistlib
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("verify-ios-candidate-archive.py")
spec = importlib.util.spec_from_file_location("ios_archive", SCRIPT)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ReviewedIpaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ios-archive-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def ipa(self, changes=None, *, binary=False, names=None, raw_plist=None):
        info = {
            "CFBundleIdentifier": "uk.carmazium.app",
            "CFBundleShortVersionString": "1.0.2",
            "CFBundleVersion": "127",
            "CFBundleSupportedPlatforms": ["iPhoneOS"],
        }
        info.update(changes or {})
        path = self.root / "candidate.ipa"
        data = raw_plist if raw_plist is not None else plistlib.dumps(
            info, fmt=plistlib.FMT_BINARY if binary else plistlib.FMT_XML
        )
        with zipfile.ZipFile(path, "w") as archive:
            for name in names if names is not None else ["Payload/CarMazium.app/Info.plist"]:
                archive.writestr(name, data)
            archive.writestr("Payload/CarMazium.app/FixtureBytes", b"x" * 2048)
        metadata = {
            "expected_ipa_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "bundle_identifier": "uk.carmazium.app",
            "app_version": "1.0.2",
            "app_build_version": "127",
        }
        return path, metadata

    def test_accepts_xml_and_binary_plist_without_claiming_device_qa(self):
        for binary in [False, True]:
            with self.subTest(binary=binary):
                path, metadata = self.ipa(binary=binary)
                result = validator.verify_archive(path, metadata)
                self.assertEqual(result["ipa_sha256"], metadata["expected_ipa_sha256"])
                self.assertEqual(result["packaged_bundle_identifier"], "uk.carmazium.app")
                self.assertFalse(result["physical_device_tested"])
                self.assertFalse(result["approved_for_customer_distribution"])

    def test_rejects_wrong_and_missing_reviewed_checksum(self):
        path, metadata = self.ipa()
        for digest in ["0" * 64, "", "a" * 63, "not-a-checksum"]:
            with self.subTest(digest=digest):
                with self.assertRaises(ValueError):
                    validator.verify_archive(path, {**metadata, "expected_ipa_sha256": digest})

    def test_rejects_changed_download_bytes(self):
        path, metadata = self.ipa()
        with path.open("ab") as output:
            output.write(b"tampered")
        with self.assertRaisesRegex(ValueError, "bytes differ"):
            validator.verify_archive(path, metadata)

    def test_rejects_wrong_metadata_identity(self):
        path, metadata = self.ipa()
        for key, value in [("bundle_identifier", "uk.carmazium.qa"), ("app_version", "1.0.1")]:
            with self.subTest(key=key):
                with self.assertRaisesRegex(ValueError, "original CarMazium"):
                    validator.verify_archive(path, {**metadata, key: value})

    def test_rejects_wrong_packaged_bundle_version_or_build(self):
        for key, value in [
            ("CFBundleIdentifier", "uk.carmazium.qa"),
            ("CFBundleShortVersionString", "1.0.1"),
            ("CFBundleVersion", "126"),
        ]:
            with self.subTest(key=key):
                path, metadata = self.ipa({key: value})
                with self.assertRaisesRegex(ValueError, "Packaged iOS"):
                    validator.verify_archive(path, metadata)

    def test_rejects_simulator_and_malformed_platform_values(self):
        for value in [[], ["iPhoneSimulator"], "iPhoneOS", "not-iPhoneOS", ["iPhoneOS", 123]]:
            with self.subTest(value=value):
                path, metadata = self.ipa({"CFBundleSupportedPlatforms": value})
                with self.assertRaisesRegex(ValueError, "physical iPhone"):
                    validator.verify_archive(path, metadata)

    def test_rejects_missing_or_ambiguous_main_application(self):
        for names in [[], ["Payload/One.app/Info.plist", "Payload/Two.app/Info.plist"]]:
            with self.subTest(names=names):
                path, metadata = self.ipa(names=names)
                with self.assertRaisesRegex(ValueError, "exactly one"):
                    validator.verify_archive(path, metadata)

    def test_rejects_oversized_or_invalid_main_plist(self):
        path, metadata = self.ipa(raw_plist=b"x" * (1024 * 1024 + 1))
        with self.assertRaisesRegex(ValueError, "bounded"):
            validator.verify_archive(path, metadata)
        path, metadata = self.ipa(raw_plist=b"invalid plist")
        with self.assertRaises(Exception):
            validator.verify_archive(path, metadata)

    def test_rejects_small_files_and_symlinks(self):
        path, metadata = self.ipa()
        link = self.root / "linked.ipa"
        link.symlink_to(path)
        with self.assertRaisesRegex(ValueError, "regular file"):
            validator.verify_archive(link, metadata)
        path.write_bytes(b"small")
        with self.assertRaisesRegex(ValueError, "regular file"):
            validator.verify_archive(path, metadata)

    def test_cli_records_verified_bytes_and_refuses_to_overwrite_existing_evidence(self):
        path, metadata = self.ipa()
        input_path, output_path = self.root / "metadata.json", self.root / "verified.json"
        input_path.write_text(json.dumps(metadata), encoding="utf-8")
        args = [sys.executable, str(SCRIPT), str(path), str(input_path), str(output_path)]
        result = subprocess.run(args, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        evidence = json.loads(output_path.read_text(encoding="utf-8"))
        self.assertEqual(evidence["ipa_sha256"], metadata["expected_ipa_sha256"])
        self.assertFalse(evidence["approved_for_customer_distribution"])
        again = subprocess.run(args, capture_output=True, text=True)
        self.assertNotEqual(again.returncode, 0)


if __name__ == "__main__":
    unittest.main()
