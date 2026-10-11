# Issue #516 — Block 9/10: accessibility, touch isolation and dense damage pins

Date: 2026-10-11. **Draft code only**. 90% source milestone, not 90% device approval.

## Implemented in this block
- Seller/Buyer native 3D damage pin labels distinguish **Edit** (seller) vs **Inspect** (buyer) and include numbered defect, part, damage type, photo/no-photo state, selected and disabled state. Photo icon is decorative for screen readers. Vehicle model announces touch/rotation instructions; direction controls announce status and do not require dragging.
- Native legacy hotspot hit slop enlarged to 14dp on each edge; saved defect pins remain 44 × 44dp. Selected defect marker renders last above any dense cluster after the deterministic 49dp collision layout, with its original 3D data and tether line untouched.
- Native seller and buyer now provide a **directly below the model** horizontal selector of numbered, ≥48dp buttons. Each button is keyed by immutable damage UUID, labelled with the exact panel/type/photo status and highlights the selected record. This is a robust accessible fallback for several nearly coincident pins and for keyboard/switch/screen-reader navigation. Existing long editable/review lists still work.
- Native seller's type buttons cannot change while camera/photo upload is pending. Save button announces **Save changes / Retry save / Uploading** appropriately; delete buttons distinguish multiple defects on the same panel.
- Browser 3D Canvas has `touch-action: none` within the model viewport so model rotations do not scroll the containing page, while ordinary page scrolling outside the viewport remains available. Website model is labelled as an interactive group with a manual/list fallback, and HTML damage pin targets are 44px with strong keyboard focus and differentiated buyer/seller action labels. Standard HTML button keyboard focus and Enter/Space actions retained; browser fallback `Choose area manually` and damage record lists remain intact.
- No schema migration, seller fee changes, backend authentication change, data mutation, or public deployment. Existing source tests adjusted for improved accessible state and selected marker ordering.

## Test gates
- Source contracts: `scripts/test-damage-accessibility-gesture-block9.test.mjs` and inherited Blocks 1–8 tests.
- Native, web and backend TypeScript checks plus Web Listing CI and One Product Parity. A source test is not real VoiceOver/TalkBack certification.
- Physical acceptance still required on Samsung Android and iPhone: tap and drag at various screen widths, 5/10/30 same-panel marks, camera permissions and denied permission, selected marker above neighbours, VoiceOver/TalkBack traversal and labels, font scaling and keyboard switch selection.
- Browser testing required on mobile Chrome and Safari and desktop keyboard: page scroll outside canvas, drag rotation within, keyboard Enter/Space on pin/manual options, focus visible, photo alt and inline error retry.

## Explicit deferred risks / boundaries
- The native quick selector is horizontally scrolling; real assistive-tech testing must confirm navigation under increased text size. The main record list provides a vertical alternative.
- Browser models and native GLB shapes still differ. The illustration is generic and inferred panel positions are suggestions, not verified photographs of an actual car.
- **Security issue #521 remains an absolute blocker**: `POST /damage/:listingId/save` must enforce listing ownership and authorize dealer staff before production release. Source changes from this block do not resolve it.
- Block 10 must assemble a safe QA installation, harden backend authorization, verify actual storage durability, confirm browser/native UX with a physical device and obtain explicit owner release approval. If these gates cannot be completed, mark release blocked rather than claiming fully finished.

Rollback: close/revert only draft Block 9 PR. No destructive migrations, deployed APK or live customer records affected.
