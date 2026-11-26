# Original Android signer enrolment in Google Play

The original installed CarMazium signer is SHA-256 `ea9b8d6733ee68d6e36ce092e81c0e360330a56dde9ed0b4edb2c421c8600f24`. A Google-generated signer must not replace it: existing website APK installations need compatible Play updates.

On 26 November 2026 the owner approved publication of the existing apps. Play Console's pre-release signing settings permitted importing the original key. The checked-in PEM is Google's **public encryption key**, downloaded from that app's signed-in Play Console (`uk.carmazium.app`). It contains no private signing material. Its exact SHA-256 is pinned in the transfer workflow; Google's PEPK JAR is independently checksum-pinned after matching the Console download to the official gstatic download.

Run `carmazium-google-play-key-transfer.yml` only on the reviewed exact main SHA, with `OWNER_APPROVED_ORIGINAL_KEY_TRANSFER`. It tests the export with disposable non-production credentials before accessing existing repository signing secrets. It then verifies the original certificate, encrypts the retained private key to Google's pinned public key, deletes the temporary keystore and retains only the encrypted ZIP and public provenance for one day. Passwords never appear in Java process arguments. It does not build an app, generate a production key or upload to Google.

Download the exact successful artifact, independently compare its SHA-256 with `transfer-evidence.json`, and upload `original-signer-google-encrypted.zip` through **Provide a copy of your app signing key** in the original app's Play Console. Verify the resulting Play signing certificate equals the original fingerprint above before distributing an app. Never upload a raw JKS or password file. Never change the existing website APK key or application ID.

Validation: `python3 scripts/test-play-key-transfer.py /path/to/checksummed/pepk.jar` uses temporary test keys. It verifies successful encrypted export and rejection of a wrong signer, wrong recipient hash, wrong password and missing alias, while checking that error output contains no supplied passwords.
