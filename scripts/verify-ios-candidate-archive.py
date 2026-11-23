#!/usr/bin/env python3
"""Verify reviewed IPA bytes and the original app's packaged Info.plist.

This does not claim physical-device QA, validate Apple distribution approval,
submit an app, or change signing credentials.
"""
import hashlib
import json
import re
import sys
import zipfile
import plistlib
from pathlib import Path


def verify_archive(ipa_path, metadata):
    path = Path(ipa_path)
    expected = metadata.get("expected_ipa_sha256", "")
    if not re.fullmatch(r"[a-f0-9]{64}", expected):
        raise ValueError("Reviewed IPA checksum is missing or invalid")
    if metadata.get("bundle_identifier") != "uk.carmazium.app" or metadata.get("app_version") != "1.0.2":
        raise ValueError("Reviewed IPA identity must remain the original CarMazium app")
    if path.is_symlink() or not path.is_file() or not 1024 <= path.stat().st_size <= 1024 ** 3:
        raise ValueError("IPA must be a regular file between 1 KiB and 1 GiB")
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest()
    if actual != expected:
        raise ValueError("IPA bytes differ from the explicit reviewed SHA-256")
    with zipfile.ZipFile(path) as archive:
        entries = [
            item for item in archive.infolist()
            if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", item.filename)
        ]
        if len(entries) != 1 or not 0 < entries[0].file_size <= 1024 * 1024:
            raise ValueError("IPA must contain exactly one bounded main-app Info.plist")
        info = plistlib.loads(archive.read(entries[0]))
    if info.get("CFBundleIdentifier") != metadata["bundle_identifier"]:
        raise ValueError("Packaged iOS bundle identifier differs from the reviewed original app")
    if info.get("CFBundleShortVersionString") != metadata["app_version"]:
        raise ValueError("Packaged iOS app version differs from the reviewed candidate")
    if str(info.get("CFBundleVersion", "")) != metadata.get("app_build_version"):
        raise ValueError("Packaged iOS build number differs from EAS metadata")
    platforms = info.get("CFBundleSupportedPlatforms")
    if not isinstance(platforms, list) or any(not isinstance(value, str) for value in platforms) or "iPhoneOS" not in platforms:
        raise ValueError("IPA is not packaged for a physical iPhone")
    return {
        **metadata,
        "ipa_sha256": actual,
        "ipa_size_bytes": path.stat().st_size,
        "packaged_bundle_identifier": info["CFBundleIdentifier"],
        "packaged_app_version": info["CFBundleShortVersionString"],
        "packaged_build_version": str(info["CFBundleVersion"]),
        "approved_for_customer_distribution": False,
        "physical_device_tested": False,
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) != 4:
            raise ValueError("Usage: verify-ios-candidate-archive.py <ipa> <metadata.json> <verified.json>")
        metadata = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
        evidence = verify_archive(sys.argv[1], metadata)
        with Path(sys.argv[3]).open("x", encoding="utf-8") as output:
            json.dump(evidence, output, indent=2)
            output.write("\n")
        print("Exact reviewed IPA bytes, bundle, app version and build number verified; no public release approval.")
    except Exception as error:
        print("iOS IPA verification blocked: " + str(error), file=sys.stderr)
        sys.exit(1)
