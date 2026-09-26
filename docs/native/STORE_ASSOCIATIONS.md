# Native Store Association Release Contract

CarMazium uses `uk.carmazium.app` for both the iOS bundle identifier and Android application ID.

## Production web environment

Configure these server-only variables on the production web project:

- `APPLE_APP_TEAM_ID` — the 10-character Apple Developer Team ID.
- `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS` — the SHA-256 certificate fingerprint that signs the installed Google Play build. Multiple fingerprints may be comma-, semicolon-, or newline-separated.

Do not guess either value. For Google Play, use the **App signing key certificate** SHA-256 from Play Console App integrity when Play App Signing is enabled; the upload-key fingerprint is not interchangeable with the app-signing fingerprint.

## Canonical URLs

The web app serves:

- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`

Both are internal rewrites to server route handlers. There is no redirect in the association path.

The handlers fail closed with HTTP 503 while their required identity is absent or malformed.

## App Store Connect submission identity

The repository intentionally contains no fake Apple ID, Team ID or App Store Connect ID.

For a strict release-certification run, supply:

- `asc_app_id` — the numeric App Store Connect Apple ID for the CarMazium app.
- `apple_team_id` — the Apple Developer Team ID.
- `android_sha256_fingerprint` — the Google Play app-signing SHA-256 fingerprint.

The strict workflow compares the supplied Apple/Google identities with the JSON actually deployed on `www.carmazium.com`.

## Android submit credential

`eas.json` declares `./google-service-account.json` for Google Play submission. The credential file is intentionally external and must never be committed.

## Release rule

A production store release is not certified until:

1. code-controlled release checks pass;
2. normal production web/backend smoke checks pass;
3. the strict release workflow is run with the real store identifiers;
4. both deployed association responses exactly match those supplied identities.
