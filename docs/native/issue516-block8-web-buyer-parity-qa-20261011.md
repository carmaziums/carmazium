# Issue #516 — Block 8/10: website and buyer damage parity

Date: 2026-10-11. **Draft source only. Stop at 80%. No release/APK.**

## Website seller damage wizard
- The existing lazily loaded React Three Fiber GLB can receive direct click/tap on its rendered mesh, not merely preset + hotspots, when used in seller mode. Uses group world bounds to derive clamped `fx/fy/fz` after model scaling and suppresses >8px drag clicks. A nearest **suggested** exterior zone is inferred from generic normalized zone positions and must be correctable.
- Web `VehicleDamageMapper` now follows the same *Tap surface → suggested panel → optional camera/gallery photo + type/description → Save & Add Another* sequence as Android/iOS. A *Change panel* button preserves a previous hit when correcting a known panel; a manual chooser is collapsed by default and remains usable for interior/custom areas or WebGL fallback.
- Multiple scratches on one panel use distinct UUIDs, optional persisted `surfacePoint`, independent HTTPS `photoUrl`, typed damage category and original legacy `x/y/view/bodyType` properties. Existing selected defect can be edited without creating a duplicate. Numbered 3D pins are projected from normalized GLB bounds. AutoRotate is disabled during active seller marking.
- File picker provides native browser camera capture or gallery; upload uses existing `uploadImage`. On failed upload, **no base64/data URI is treated as durable evidence**; the seller can select the photo again or explicitly continue without one. HTTPS validation and form guard prevent silent proof loss. Existing browser-based photo upload authorization/storage rules require separate production QA.

## Buyer-facing website and app
- Website vehicle detail and native `BuyerDamageViewer` now select one damage **record ID** instead of all scratches on the same panel. Distinct 3D pins follow saved `coords.surfacePoint` where present. Existing legacy records without normalized positions retain list and zone-selector access; fake precise 3D points are not invented.
- Buyers can inspect the selected record's type/description and attached seller photo. Native enlarged photo preview is read-only; website retains its existing full-photo lightbox. The buyer's viewer never receives seller mesh-write callbacks.
- Native empty-state copy says *seller reported no damage*, not falsely *vehicle checked clean*. Display is clearly seller-reported, not an independent inspection.

## Known caveats / release blockers
- Web GLB assets are body-type dependent, while the native app still uses its bundled generic body GLB; 3D model appearance is **not identical** yet. Marking and reviewing interaction is aligned but needs real comparative UI screenshots in Block 10.
- This is **source and CI parity**, not a physical mobile or web-browser acceptance test. Safari iOS, Android Chrome, small-screen mesh coordinate accuracy, keyboard and autoRotate need hands-on verification.
- Backend **security issue #521 remains a hard stop**: authenticated owner verification is absent from `/damage/:listingId/save`. Do not merge/release this branch until addressed and independently tested.
- The current storage/schema keeps one proof image per defect and uses existing owner-scoped native uploads; full cross-device draft sync, historical browser mapping and deletion permissions still require integration review.
- The damage grade policy remains unchanged; no changes to seller rewards, auction fees, Stripe, public listings or customer records.

## Gates and rollback
- `node --test scripts/test-damage-web-buyer-parity-block8.test.mjs` and prior Blocks 1–7 regression tests, mobile/web/backend typecheck, Mobile Listing CI, One Product Parity. Browser visual proof is still pending.
- QA scenarios: web tap bumper/roof/wing → suggested area → photo/type/description → another spot; correct panel, manual interior, same-panel two pins, select/edit/delete one without changing the other. Refresh/list saved edits; buyers open individual images and descriptions. Confirm cancellation, offline photo failure and small screens.
- PR stacked on #524. Closing the Block 8 PR reverts only the web/native buyer parity source changes, not Blocks 1–7. No production deploy.
