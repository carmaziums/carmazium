# Issue #516 — Block 1/10: seller-only direct 3D surface-tap foundation

Date: 2026-10-11
Status: SOURCE REVIEW ONLY — NO APK / DEVICE ACCEPTANCE

## What is now wired

- This work is **stacked on draft PR #513** to retain existing parent ScrollView lock, touch gesture and model render-performance improvements.
- The 3D WebView raycasts the actual rendered model on a short single-finger **tap**. It does not select damage from clicking empty background. One-finger rotation, slow touches, drags above 10px, cancelled pointers and secondary touch cannot emit a damage tap.
- The raycast converts world hit coordinates back to model bounding-box fractions `fx/fy/fz` (each 0..1). It suggests the nearest known exterior panel by id; it does **not** assume this generic model is the exact real vehicle.
- Native bridge validates zone identity and all finite 0..1 coordinates, and enables the callback only when the seller explicitly provides `onSurfaceTap`; buyer `readOnly` views do not enable it.
- The existing seller Damage3DMapper selects the suggested panel, remembers the preliminary hit coordinate in the **local** DamageEntry and keeps manual zone selectors. Switching to a manual selector clears the pending hit coordinate.

## What is NOT complete

- The existing long panel list is still present and the form still appears below it. Block 2 will move the fast editor directly under the 3D vehicle and make the list optional.
- The image picker still lives in the old overlay pill and doesn't safely persist its `file://` URI to storage. Do **not** put this branch in a customer APK until Block 3/4 photo flow and upload association are complete.
- `surfacePoint` currently lives in local component state only. **It is not persisted to the server or recovered from saved drafts**. Block 5/6 will connect stable per-defect coordinates and media to the backend; legacy record hydration must be tested.
- The nearest panel is a **suggestion**, not a verified anatomical mapping. It requires a manual correction UI (Block 2) and cross-body-type accuracy testing.
- No actual physical Samsung touch tests, screenshot review, iPhone validation, or final merged APK exists for this block.
- Existing WebView hotspot overlay still wins taps on its predefined markers; that is intentional in this first compatibility block.

## CI / review checklist

1. `node --test scripts/test-native-3d-gesture-performance.test.mjs`
2. `node --test scripts/test-native-damage-surface-tap-block1.test.mjs`
3. Native typecheck plus release workflow and One Product Parity.
4. Later device-only acceptance: rotate/tilt without parent scroll; stationary taps on bumper, wing, door and roof prompt correct *suggestion*; blank space doesn't select; multi-finger, fast flick and long press do not mark.
5. Existing hotspot and buyer read-only behavior unchanged.
6. No network calls, live listings, bids, KYC, payment or photo uploads added in Block 1.

## Rollback

The source PR is isolated. Close the PR or revert the commits on `feature/native-damage-surface-tap-block1-20261011` without reverting unrelated #513 gesture fixes. Do not cherry-pick the unfinished surface picker into production.
