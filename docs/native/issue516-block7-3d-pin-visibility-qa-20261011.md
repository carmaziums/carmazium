# Issue #516 — Block 7/10: 3D damage marker visibility and seller review

Date: 2026-10-11. Source only, no release/QA APK, 70% *code milestone*.

## Changes
- Seller's inline annotation viewer prioritizes actual arbitrary mesh taps by hiding generic preset hotspot overlays **in the seller editor only**. Manual area selection remains immediately below the model. Existing buyer read-only zone markers and other viewer consumers retain their old behaviour.
- Saved damage records get 44dp high-contrast, category-coloured, numbered buttons (Scratch/Scuff amber; Dent/Crack red; Other accent), visible photo indicator, accessible individual edit label and selected outline. Buttons use stable defect UUID and selected ID; two same-panel defects remain independent.
- A pure, deterministic collision layout works in *native screen coordinates*. Only closely overlapping projections move; a thin leader line connects every displaced pin to its original 3D screen projection. All record `surfacePoint` mesh coordinates and underlying GLB remain untouched.
- WebView camera projection still runs only during model/camera changes with existing 100ms throttling; native position updates are ignored unless visibility changes or coordinates move >0.16 percentage points. No per-frame mesh raycast or unbounded bridge traffic.
- Seller summary now displays total damages, 3D-located pins and uploaded photos, plus category breakdown and number of manually reported (no exact 3D point) records. Existing automatic 1–5 exterior grade formula and photo-optional behaviour are unchanged.
- The selected damage record in the editable list gets a visible border and an “Editing” label. Existing photo, retry, draft recovery and backend protocols unchanged.
- Regression script `scripts/test-native-damage-pin-visibility-block7.test.mjs` added to One Product Parity and Release Certification, and inherited Block 5 test updated for the changed pin presentation.

## Deferred or unverified
- Real Samsung and iOS device gestures, touch targets, side-angle visibility and dense-pin overlap must be physically tested before release; source/typecheck is not device proof.
- Collision displacement does not claim the generic GLB matches the customer's actual body panels. Buyer-facing read-only history currently uses its established legacy coordinates and is not upgraded in this block (Block 8).
- More complex close-pin grouping/selection and VoiceOver/TalkBack testing scheduled for Blocks 9–10.
- **Security issue #521 remains unresolved**: the backend damage-save endpoint must enforce listing ownership with authorization tests before any production merge or release.
- PR is stacked on draft #523 which is stacked on earlier drafts. Do not merge, deploy to customers, publish APK or mutate live listings.

## Suggested manual QA
1. Two defects within a few pixels of each other on one door: numbered markers remain distinguishable, leader lines show original locations, and clicking either edits the correct record/photo.
2. Rotate front/side/rear and ensure pins move with the mesh but do not block drag; blank car surfaces still accept a new tap. ScrollView remains locked only during viewer interaction.
3. Add a manual interior defect without model point; list displays its record but does not fabricate a pin. Summary notes manual-only item.
4. Verify photo indicator vs photo-less pin, selected outline vs inactive, colour categories and condition grade.
5. Switch between seller/buyer modes and app/site; existing buyer mode and legacy 2D damage map stay intact.
6. Validate frame pacing on lower-spec Android and physical iPhone, especially 10–30 marks. Confirm accessibility controls in Blocks 9–10.

## Rollback
Close/revert this draft branch without reverting Blocks 1–6. No schema migration, customer storage changes, release or app binary.
