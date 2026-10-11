# Issue #516 — Block 4/10: durable, defect-owned photo upload

Date: 2026-10-11
Status: SOURCE-ONLY DRAFT — NOT RELEASE/DEVICE APPROVED

## Scope completed in source
- Quick editor `Save & Add Another` now awaits a successful photo upload to owner-scoped public Supabase `listings/<sellerId>/damage/<randomUUID>.jpg` (using the existing React Native ArrayBuffer upload helper and JPEG compression) before committing a damage record and resetting the editor.
- Each damage record gets its **own** `damagePhotoUrl: https://...`, and the backend `/damage/:listingId/save` `imageUrl` is sourced from that record, never a panel-wide dictionary. A local `file://` URI is kept ONLY in the transient editor while the upload is pending/failed.
- Uploaded photos also enter the `DAMAGE` listing image category and count toward the existing 100-photo maximum. The uploader honours authenticated user folder scope, no anonymous storage uploads.
- Shows approximate stage progress (10% selected, 45% compressed, 90% storage confirmation, 100% local commit). **These are stage indicators, not network byte transfer progress.**
- Network/storage errors preserve exact selected panel, image preview, damage category and free-text; user gets a **Retry Save** action. Double-saving, concurrent photo picker and leaving the step during an upload are guarded.
- Publish is blocked before payment/listing mutations when any damage is unsaved, uploading, or still local-only; the same check applies to Next from the Media step.
- Existing edit-mode damage records hydrate their own `imageUrl` to `damagePhotoUrl` instead of being silently dropped on resave. Deleting a new per-defect record detaches its image from listing images, using the existing owner-only delete helper where safe.
- Existing seller 3D touch/rotate, buyer read-only view, camera/gallery UX and the old manual selector are preserved.

## Limitations and dependencies
- **No real device photo upload or authenticated Supabase end-to-end confirmation** has been performed. CI source/typecheck alone is insufficient. Test with a private owner QA identity and dummy vehicle before merging.
- **Backend authorization audit is required before release**: the existing `damage/:listingId/save` API has a session guard but currently does not independently check listing ownership. This is a security risk independent of these native UI changes; do NOT ship until ownership rules are enforced and verified (future backend hardening).
- Block 5 adds stable per-defect IDs/multiple markers and precise persisted surface coordinates; Block 6 adds draft recovery, permanent edit/resume and orphan cleanup. Do not claim full per-defect draft persistence yet.
- The backend still stores one `imageUrl` per damage row (not a photo album); this block supports one evidence photo per entry. A gallery of multiple photos per defect needs later schema support.
- The existing `/damage/:listingId/save` response is surfaced as a publish warning on failure, but its save sequencing is out of scope here. Additional failure rollback may be necessary.
- Cross-platform web/iOS UI parity, real TalkBack/VoiceOver, performance on physical Samsung and final QA APK remain planned.

## Regression gates
- `node --test scripts/test-native-damage-durable-upload-block4.test.mjs`
- Existing Block 1–3 tests retained and updated only for the new asynchronous save semantics.
- One Product Parity CI, Mobile Listing CI, native/backend/web typechecks.
- Manual QA: authenticated seller opens damage tab, picks photo, saves, receives HTTPS source, reloads/edit lists and sees correct panel evidence; 2 defects on same panel show different photos; disconnect network -> Retry Save retains text/photo; cancel camera permission -> no data lost; QA read-only build -> upload blocked; 100-image cap and deletion cleanup checked; buyer sees correct saved image without device-local URL.

## Rollback
PR is stacked on draft #519. Close or revert ONLY the Block 4 PR to restore local-only preview/publish lock behaviour without removing the #513 movement or Blocks 1–3 source changes. No live customer records or production branches modified.
