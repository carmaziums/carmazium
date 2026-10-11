# Issue #516 — Block 5/10: independent 3D pins and stable IDs

Date: 2026-10-11
Status: SOURCE DRAFT; not deployed, not QA certified

## Implemented
- **Several defects on one panel:** every tap/record has a separate UUID and optional bounding-box-normalized 3D hit `{fx,fy,fz}`; the panel name is descriptive metadata, not the identifier.
- **Distinct numbered pins:** Three.js projects saved hit points through the active camera to React Native numbered buttons without continuous raycasting. Tapping a saved numbered pin opens the exact record for edit; a matching numbered list button also supports non-3D/custom/interior locations.
- **Edit without duplication:** quick editor preloads category, description, original hit and per-record durable photo URL. Saving updates the same UUID, with or without a new photo, leaving unrelated records untouched. Delete removes only that record.
- **Server identity survives save/reopen:** existing `DamageRecord.id` UUID key is passed on save (backward compatible: older clients omit it); exact surface point is stored in existing `coords` JSON alongside legacy `{x,y,view}`. Edit listing restores the same ID, photo URL and hit point. No production migration is required; no schema change.
- **Validation:** rejects duplicated/malformed UUIDs and non-finite or out-of-range 3D coordinates before deleting the existing set.
- **Regression:** source-contract test in `scripts/test-native-damage-multiple-pins-block5.test.mjs` and behavioral Jest tests in `backend/src/damage/damage.service.spec.ts`; inherited Blocks 1–4 checks remain.

## Deliberate limitations / risks
- Marker coordinates refer to a generic illustrative 3D body, not a photogrammetric scan of the actual vehicle; missing historic positions only appear in the numbered review list and legacy standard zone hotspots, never fabricated exact pins.
- Distinct numbered pins may visually overlap on very close marks; small-screen tap disambiguation remains part of Blocks 7/9 physical QA.
- Backend damage-save ownership is NOT resolved by this block. **Security issue #521 remains a hard release blocker.**
- Schema persists exactly **one image URL per damage record**. Multi-image album schema, delete orphan cleanup, offline drafts and recovery are future work (Block 6).
- Backend saves still replace full damage set atomically; this is fine for one seller editing in their own session but must be verified for concurrency with admin/dealer staff and strict listing ownership.
- No real authenticated Android/iOS uploads or viewport QA; no public/private APK, merge, or production deployment. Keep stacked PRs as drafts.

## QA verification plan
1. On a dummy vehicle, mark two different scratches on the same door; verify two numbered 3D pins, two distinct UUIDs and photos, 2D legacy coordinates preserved.
2. Edit pin 1's description or take a new photo; verify pin 2's URL/location/ID never changes, and pin 1's ID remains the same.
3. Reload the listing from backend; the two hit points, thumbnails and IDs should return separately.
4. Remove only pin 1; make sure pin 2 remains, and draft count/grade correctly changes.
5. Rotate rapidly while pins are visible; scroll lock and 3D controls from #513 must not regress.
6. Check existing listings with legacy missing `coords.surfacePoint` and no client id.
7. Check that no anonymous/other-owner user can mutate damage records before release (#521).
8. CI: One Product Parity source tests plus backend Jest, Mobile Listing CI native typecheck.

Rollback: Close Block 5 draft PR and revert its source commits without undoing Blocks 1–4. Do NOT deploy stacked drafts.
