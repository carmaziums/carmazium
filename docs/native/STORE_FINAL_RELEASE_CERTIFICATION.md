# Final Store Release Certification

This is the final 90% → 100% release contract for CarMazium's iPhone and
Android apps.

It deliberately separates **code-complete** from **store-release certified**.
CI being green is not enough to claim that the signed binaries, store accounts,
reviewer access and real-device behaviour are ready.

## Release source

Both signed native release candidates must be built from the exact same full
40-character Git commit SHA that is supplied to the manual GitHub
**Release Certification** workflow.

Do not certify:
- an iOS build from one commit and an Android build from another;
- a rebuilt artifact whose hash differs from the one tested/uploaded;
- a branch build when the certification workflow is running against a
  different commit.

## Build signed candidates

CarMazium includes a build-only EAS workflow:

`carmazium app/carmazium app/.eas/workflows/create-store-release-candidate.yml`

Run it from the Expo project after production build credentials have been
configured.

Equivalent EAS CLI production builds are:

`eas build --platform ios --profile production`

`eas build --platform android --profile production`

The production Android output must be an AAB. The iOS output must be a signed
store archive suitable for App Store Connect/TestFlight.

### Credential setup

Signing credentials remain external and must not be committed.

Configure EAS production build credentials for both platforms. Configure the
Google Play service-account credential in EAS credentials rather than relying
on a repository-local JSON file. Configure an App Store Connect API key or
another supported EAS Submit credential for iOS.

## Artifact evidence

For each final candidate record:

- EAS/store build identifier;
- source Git SHA;
- user-facing app version and native build version;
- artifact SHA-256 digest;
- iOS Xcode version;
- iOS SDK version;
- build timestamp.

The strict evidence gate validates the two build IDs and both artifact hashes.
It also requires Xcode 26+ and iOS SDK 26+ for the iOS archive.

Generate a SHA-256 digest from the exact downloaded artifact that is uploaded
for testing. Do not hash a different local rebuild.

## Store identity evidence

The strict workflow also requires the authoritative external values:

- App Store Connect numeric Apple app ID;
- Apple Developer Team ID;
- Google Play app-signing SHA-256 certificate fingerprint.

Those values are then checked against the live CarMazium association endpoints:

- `https://www.carmazium.com/.well-known/apple-app-site-association`
- `https://www.carmazium.com/.well-known/assetlinks.json`

Until the real identities are configured, these endpoints intentionally fail
closed rather than publishing invented associations.

## Real-device QA

Complete the device matrix in
`docs/native/STORE_ACCESSIBILITY_DEVICE_QA.md` against the same signed release
candidate.

Final certification specifically requires confirmation of:

- representative real-device QA;
- VoiceOver, TalkBack and large-text testing;
- foreground/background/killed-state push receipt and tap routing;
- native payment presentation and a safe test transaction;
- installed Universal Links / Android App Links.

Do not certify simulator-only results as physical-device evidence.

## Pre-release store uploads

Before the strict final gate is allowed to pass:

- upload the exact iOS candidate to TestFlight;
- upload the exact Android candidate to Google Play internal testing.

CarMazium's Android EAS submit profile targets the Play **internal** track.
The repository no longer points to a local `google-service-account.json`;
submission credentials must be managed externally.

The two store uploads must refer to the same artifact hashes recorded in the
release evidence.

## Store-console evidence

Block 9's external confirmations remain mandatory:

- reviewer/demo credentials are configured and tested;
- metadata, privacy/Data safety, age/content and app-content declarations are
  complete;
- release-candidate screenshots and feature graphics are uploaded.

Reviewer passwords, API keys, service-account files, KYC documents and payment
credentials must never be placed in Git or release notes.

## Final manual GitHub certification

Run **Release Certification** manually with `strict_external=true` and supply
all store/signing/build values plus every confirmation toggle.

The strict workflow must pass all of the following:

1. one-product parity;
2. code-controlled release readiness;
3. web TypeScript;
4. native Expo production config and TypeScript;
5. backend typecheck, full tests and build;
6. live production web smoke checks;
7. Fly backend health;
8. store-console/reviewer/asset confirmations;
9. Apple and Android signing identity validation;
10. signed artifact/build evidence;
11. real-device QA confirmations;
12. TestFlight and Play internal-test upload confirmations;
13. live Apple Universal Link association;
14. live Android App Link association.

Only after that workflow is green should the release be described as **store
release certified**.

## Current external blockers

At the time this contract was added, the repository, connected Gmail, available
Library evidence and authorised development-device list did not expose the real
Apple Team ID, App Store Connect numeric app ID or Google Play app-signing
SHA-256 certificate fingerprint. No authorised physical development computer
was connected.

Those items are therefore external release dependencies, not values to infer or
fabricate.
