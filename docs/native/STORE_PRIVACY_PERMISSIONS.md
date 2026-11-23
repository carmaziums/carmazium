# Native Store Privacy & Permission Contract

This document records the code-controlled privacy and permission surface for the
CarMazium iPhone and Android applications. It is the implementation source of
truth for store declarations; App Store Connect and Google Play Console must be
kept consistent with it.

## Current native permission surface

CarMazium currently uses:

- **Photos/documents:** user-initiated system pickers for vehicle photos,
  profile images, chat attachments, KYC/provider documents, handover/cancellation
  evidence and similar uploads.
- **Foreground location:** only after the seller taps **Locate Me** in the
  listing flow. The coordinate is used to find a nearby postcode.
- **Notifications:** the OS notification permission is used for CarMazium push
  alerts.

CarMazium does **not** currently need:

- camera capture;
- microphone recording;
- contacts;
- SMS or call-log access;
- broad Android photo/video-library access;
- background location;
- Android location foreground-service permission.

If a future feature genuinely needs one of these capabilities, update this
contract, the Privacy Policy, app configuration, store declarations and release
gate in the same change.

## Android permission minimisation

The Expo app config explicitly blocks:

- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`
- `android.permission.READ_MEDIA_IMAGES`
- `android.permission.READ_MEDIA_VIDEO`

`expo-image-picker` has `microphonePermission: false`. It retains a specific
`NSCameraUsageDescription` **iOS purpose string** because Apple's automated
binary scan previously reported ITMS-90683: the linked image-picker SDK contains
camera-capable APIs even though no current CarMazium UI launches the camera.
The purpose string is explanatory metadata, **not** a permission grant or an
automatic camera prompt. Android `CAMERA` remains independently blocked by
`android.blockedPermissions`. No current app flow may request camera access.

Photo selection uses the system picker. Code must not call
`requestMediaLibraryPermissionsAsync()` merely to let a member select one or a
few images.

`expo-location` is configured with iOS background location, Android background
location and Android location foreground-service modes all disabled.

## Apple privacy manifest

The Expo iOS config carries an app privacy manifest with:

- tracking explicitly set to false;
- no tracking domains;
- required-reason API coverage for UserDefaults, file timestamps and disk space
  used by the current Expo/native dependency graph.

iOS Info.plist retains a narrowly scoped `NSCameraUsageDescription` whose
text must **exactly match** the Expo Image Picker plugin's `cameraPermission`
string, avoiding another Apple ITMS-90683 missing-purpose rejection. This does
not mean that CarMazium has added camera capture or collects camera data. The
generated Info.plist must omit `NSMicrophoneUsageDescription` while the
microphone remains disabled. The App Store build and permissions must still be
independently verified before submission.

The photo and foreground-location usage descriptions must remain specific to
the actual CarMazium actions that trigger them.

## Store-console declaration checklist

Before each store submission, review the generated native binary and make the
store forms match actual behaviour.

### Apple App Store Connect

Review the App Privacy questionnaire against the public Privacy Policy and the
production data flows. At minimum, check the categories represented by account
and contact data, user content/listing media, precise/approximate location when
Locate Me is used, identifiers/push token, payments/payout administration,
messages/support/moderation, product interaction/analytics, verification/KYC
data and AI interactions.

Do not declare native cross-app tracking unless a native tracking SDK or other
tracking behaviour is actually introduced.

### Google Play Data safety / permissions

Keep the Data safety form consistent with the same production data flows.

The app should not submit a broad Photos and Videos permission declaration while
it relies on the system picker and blocks `READ_MEDIA_IMAGES` and
`READ_MEDIA_VIDEO`.

Do not request background location, contacts, SMS/call logs, camera or
microphone unless a future user-facing feature makes that access genuinely
necessary and the corresponding Play declaration/review has been completed.

## Release evidence

The code-controlled release gate verifies the permission-minimisation contract.
A signed store build should also be inspected before submission so merged
Android manifests and the generated iOS privacy manifest match this source
configuration. Store-console questionnaires remain external evidence and are
not assumed complete merely because repository checks pass.
