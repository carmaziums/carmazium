# Issue #516 — Block 2/10: Fast inline damage editor

Date: 2026-10-11
Status: SOURCE-ONLY DRAFT — waiting for owner's **proceed** before Block 3.

## Implemented
- When a seller taps a 3D hotspot or a visible model surface, its *existing* damage-type/description editor opens immediately underneath the 3D viewer, without a long chip list in between.
- The suggested exterior panel is visible and labelled **Suggested damage area**; generic 3D positioning is clearly a *suggestion*, not an exact body-panel claim.
- Seller can press **Change panel** in the quick editor. This opens the same known-panel chooser to correct the suggestion while preserving the original normalized mesh coordinate, including chosen type and text.
- **Choose area manually** is a separate closed-by-default accessible disclosure for all exterior, interior and wheel regions, plus custom areas. Normal manual selection clears the mesh hit coordinates; custom correction clears them because a custom panel cannot be mapped to the illustrative GLB.
- Picker sections/chips, grade calculation, record deletion, existing listing save, 3D gesture scroll lock from PR #513, and buyer read-only view remain in place.
- Type/description editor, save and cancel remain functional. Touch targets and accessibility expanded/selected state provided for chooser and chips.

## Deliberately not yet implemented
- The editor's camera/gallery action and **Save & Add Another** loop are Block 3. The old 3D photo pill may still appear on preset hotspots temporarily. We cannot yet guarantee per-damage photos are durable, so **do not release this draft to customers**.
- Persistent independent defect coordinates/photo URLs, backend schema validation, drafts and web parity are Blocks 4–8.
- Physical Samsung/iOS taps, accessibility reader usability, uploader end-to-end QA, APK and deployment are deferred until final acceptance. CI is not physical-device proof.

## Regression / review
- New `scripts/test-native-damage-inline-editor-block2.test.mjs` contract checks fast editor ordering, manual-list guard, correction coordinate handling, seller/buyer separation, and preservation of existing damage controls.
- Runs in both One Product Parity (for stacked PR branches) and Release Certification (once targeting main).
- Test manual paths: tap surface -> editor is directly beneath; correct suggested bonnet to wing -> description/type unchanged and surface point retained; tap manual list -> point cleared; enter custom interior damage; cancel and retry; drag car -> no new form.

## Dependencies and rollback
- PR #513 (gesture controls) -> PR #517 (mesh surface taps) -> current Block 2 PR.
- Revert/close only the Block 2 PR to restore the original panel-list-above-form layout without deleting Block 1 precise surface taps. Do not squash unrelated draft PR #512 theme changes here.
