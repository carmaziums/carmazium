# Issue #516 — Block 6/10: Seller damage draft recovery and evidence cleanup

Date: 2026-10-11. **Draft source only. No production release or verified device test.**

## Implemented
1. Persistent owner-scoped `SellWizardDraft.damageRecords`, with stable UUID, zone, category, description, `surfacePoint` and permanent HTTPS `damagePhotoUrl`. The existing `czm-sell-wizard-v2:<owner>` storage isolation is retained. Sanitization strips local photo URIs and rejects duplicate/malformed IDs or non-finite/out-of-range positions.
2. Damage/media edits autosave independently of Next or Save & Exit once the authenticated owner explicitly resumes or starts a draft. An empty initial screen cannot overwrite a pre-existing saved draft before the Resume prompt. Existing explicit Save & Exit and Next snapshots include damageRecords.
3. On Resume, records and independent media URLs are rehydrated together. Any record-owned HTTPS damage image missing from the category array is restored; no duplicate photo URL. Old drafts without damageRecords remain compatible.
4. While a damage editor is open/uploading, Back, Save Draft & Exit and Next are guarded. The seller is directed to save or cancel the unfinished entry; failed uploads retain the selected photo locally **within that active session**.
5. Remove/replace/edit a defect's photo by detaching its association in the unsaved gallery and record. Do not immediately delete a server-referenced image on edit.
6. Intentional delete, replacement and Start Fresh enqueue only owner-scoped `/<seller>/damage/*.jpg` candidate objects in a separate owner-scoped AsyncStorage queue. Reconciliation after a **24-hour grace period** verifies the authenticated user, *current plus persisted draft and known backend listing references*, and defers deletion on permission/network/QA-read-only failure. Storage deletes still enforce owner permissions. The cleanup queue survives app restarts; legacy server files and edit-mode media are never queued.

## Important boundaries
- This is best-effort device-local draft recovery. It does **not** synchronize draft edits between Android, iPhone and website.
- An **unfinished photo picker selection** is still a temporary device URI until the user taps Save & Add Another; it cannot be safely resurrected after the OS kills the app. Navigation warns instead of promising the raw picker URI will survive.
- No live Supabase authenticated upload/restart/cleanup test has been run. CI source tests and TypeScript checks do not prove device durability, persistent AsyncStorage latency or backend retention.
- Orphan reconciliation is conservative: a candidate can remain queued if a saved draft/server file might reference it or cleanup fails. This is safer than deleting evidence.
- Edit-mode damage records still depend on the backend. **Security issue #521 is an unresolved release blocker:** POST /damage/:listingId/save must validate listing ownership before customer rollout.
- Cross-platform web parity, visual 3D pin clarity, comprehensive accessibility and physical Samsung/iPhone QA remain Blocks 7–10.

## QA
- Start a dummy seller draft, add 2 damages to the same panel, each with its own HTTPS photo, exit/restart, tap Resume: inspect both IDs, descriptions, photos and separate 3D positions.
- Switch to a different account: ensure no prior owner's damage/media appears; sign back in and restore correctly.
- Remove/replace photo and return to listing: ensure other defect evidence is retained. Existing server listing photo deletion must only be staged until a successful edit.
- Start Fresh on unsent draft; verify nothing referenced by another record or server listing gets physically removed. After 24h grace, cleanup retries only genuinely unreferenced owner folder media.
- Denied camera, cancelled picker, app offline, QA_READ_ONLY upload, rapid save, Android hardware Back, and interrupted upload should never silently mark photo as permanently uploaded.
- Run `node --test scripts/test-native-damage-draft-recovery-block6.test.mjs`; inherited Blocks 1–5 regression tests; Mobile Listing CI and One Product Parity/typechecks.
- No APK, merge, or public release until user approves and security issue #521 and device tests are closed.

## Rollback
Close/revert draft PR for Block 6 alone. No destructive migration; existing stored drafts without damageRecords remain supported. If rolling back, retained owner-scoped damage snapshots are ignored by old client versions; live listing/photo storage untouched.
