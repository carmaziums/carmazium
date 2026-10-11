# Issue #516 — Block 3/10: Camera/gallery in 3D damage editor

Date: 2026-10-11
Status: SOURCE-ONLY DRAFT — not ready for users, pending Block 4 durable upload.

## Implemented
- Seller-only quick editor from Block 2 now offers **Take Photo** and **Gallery** using Expo ImagePicker. Camera asks permission with a clear denial path; library selects one image.
- Selected damage evidence is shown as a local image preview inside the current panel editor. **Remove Photo** clears just that selection. Picker cancel, denied permission and picker errors do not overwrite the user's existing description or photo.
- **Save & Add Another** adds the current typed damage category and description, optional preliminary 3D surface point and optional local photo URI as one in-memory damage entry, resets the editor, and keeps the 3D vehicle available for the next tap.
- Existing damage records list includes a photo thumbnail with a clear **Photo awaiting upload** label.
- Rapid repeated Save taps are guarded by `savingDamageRef`; picker calls are serialized by `photoPickerInFlightRef`, with save/cancel disabled while the picker is open.
- In seller quick-entry mode the older floating Mark/Hide/Photo pill is suppressed to avoid two competing photo workflows. All other uses of ThreeDVehicleViewer (including buyer read-only) retain existing behavior.
- **Fail closed**: publishing is blocked before listing mutations/payments if any damage record still contains a local-only photo URI. It is never silently sent to `/damage/:id/save` as `imageUrl` or treated as a durable URL.

## Not yet implemented
- Block 4 must upload the photo to durable storage, attach the exact HTTPS URL to the correct damage record and handle retries/cleanup. Nothing in Block 3 claims photo persistence.
- Block 5 stable per-record IDs, multiple evidence images and precise backend coordinates; Block 6 draft persistence/recovery.
- Website UI parity, real Samsung/iOS evidence and final release acceptance remain for later blocks.
- The current temporary preview URI may disappear if the system reclaims it or the upload flow unmounts. This branch **must not** be deployed until Block 4–6 resolve it.

## Regression checks
- `scripts/test-native-damage-camera-preview-block3.test.mjs` covers picker actions, permission/cancellation handling, staged image previews, separation between independent entries, rapid save guard, buyer mode and publish safety.
- Run in One Product Parity CI and release certification when based on main; native/Web/backend typecheck must pass.
- Later device-only tests: grant/deny camera permission, capture and retake, gallery selection and cancel, keyboard description, rotate without page drag, rapid double-save, move to next panel, and publication restriction for local images.

## Rollback
Draft PR stacked on Blocks 1–2. Close/revert this PR to remove local preview/picker changes without reverting the existing gesture performance or inline editor work.
