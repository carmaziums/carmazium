import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../carmazium app/carmazium app/src/', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const seller = read('screens/sell/SellCarFlowScreen.tsx');
const store = read('lib/sellWizardStore.ts');
const draft = read('lib/damageDraft.ts');
const cleanup = read('lib/damageOrphanCleanup.ts');

test('seller draft persists only independent defect ID, panel, description, location and HTTPS evidence', () => {
  assert.match(store, /damageRecords: DraftDamageRecord\[\]/);
  assert.match(store, /damageRecords: sanitizeDamageDraft\(state\.damageRecords\)/);
  assert.match(store, /damageRecords: sanitizeDamageDraft\(partial\.damageRecords\)/);
  assert.match(draft, /export interface DraftDamageRecord \{/);
  assert.match(draft, /description: string/);
  assert.match(draft, /surfacePoint\?: DraftDamagePoint/);
  assert.match(draft, /damagePhotoUrl\?: string/);
  assert.doesNotMatch(draft.slice(draft.indexOf('export interface DraftDamageRecord'), draft.indexOf('const DAMAGE_CATEGORIES')), /localDamagePhotoUri/);
});

test('damaged item sanitizer guards duplicate UUIDs, invalid positions and temporary device photo URIs', () => {
  assert.match(draft, /ids\.has\(item\.id\)/);
  assert.match(draft, /UUID_RE\.test\(item\.id\)/);
  assert.match(draft, /Number\.isFinite\(item\[key\]\)/);
  assert.match(draft, /item\[key\] as number\) <= 1/);
  assert.match(draft, /item\.damagePhotoUrl\.startsWith\('https:\/\/'\)/);
  assert.match(draft, /results\.push\(\{/);
  assert.doesNotMatch(draft, /localDamagePhotoUri\s*:/);
});

test('resume prompts before restoring and prevents newly mounted empty media overwriting existing account draft', () => {
  assert.match(seller, /const \[activeDamageDraftOwner, setActiveDamageDraftOwner\] = useState<string \| null>\(null\)/);
  assert.match(seller, /if \(editMode \|\| !currentUserId \|\| activeDamageDraftOwner !== currentUserId\) return/);
  assert.match(seller, /await loadSellWizardDraftForUser\(currentUserId\)/);
  const chooser = seller.indexOf("Alert.alert('Resume draft?'");
  const setRecords = seller.indexOf('setDamageRecords(recoveredDamage)');
  assert.ok(setRecords > chooser);
  assert.match(seller, /const recoveredDamage = sanitizeDamageDraft\(store\.damageRecords\)/);
  assert.match(seller, /setActiveDamageDraftOwner\(currentUserId\)/);
  assert.match(store, /czm-sell-wizard-v2:\$\{userId\}/);
});

test('photo recovery repairs gallery listing references if stored record exists but image array is stale', () => {
  assert.match(seller, /const recoveredDamageImages = \[\.\.\.\(store\.damageImages \?\? \[\]\)\]/);
  assert.match(seller, /!recoveredDamageImages\.some\(uri =>\s*parseVehicleImageMetadata\(uri\)\.src === source\)/);
  assert.match(seller, /recoveredDamageImages\.push\(encodeVehicleImageCategory\(source, 'DAMAGE'\)\)/);
  assert.match(seller, /setDamageImages\(recoveredDamageImages\);\s*setDamageRecords\(recoveredDamage\)/);
});

test('auto-saves damage after successful upload, including Next and Save Draft, but never raw temporary photo path', () => {
  assert.match(seller, /updateDraft\(\{\s*damageRecords: sanitizeDamageDraft\(damageRecords\),\s*damageImages,/);
  assert.match(seller, /damageRecords: sanitizeDamageDraft\(damageRecords\),\s*auctionStartMode/);
  assert.match(seller, /const clearDraftAndStopDamageAutosave = \(\) => \{\s*setActiveDamageDraftOwner\(null\);\s*clearDraft\(\)/);
  assert.match(seller, /if \(damageUploadInFlightRef\.current\) return;/);
});

test('Back, Save Draft & Exit and Next protect pending damage photo editors', () => {
  assert.match(seller, /function handleBack\(\) \{\s*if \(damageUploadInFlightRef\.current \|\| damageEditorPending\)/);
  assert.match(seller, /function handleSaveDraftExit\(\) \{\s*if \(damageUploadInFlightRef\.current \|\| damageEditorPending\)/);
  assert.match(seller, /Finish damage entry/);
  assert.match(seller, /if \(damageUploadInFlightRef\.current \|\| damageEditorPending\) \{/);
});

test('deleted or replaced proofs are detached from gallery without deleting referenced server files', () => {
  assert.match(seller, /withoutUnreferencedDamagePhoto\(prev, url, remaining\)/);
  assert.match(seller, /withoutUnreferencedDamagePhoto\(appended, existing\.damagePhotoUrl, \[\.\.\.otherRecords, saved\]\)/);
  assert.match(seller, /markDamagePhotoAbandoned\(currentUserId, existing\.damagePhotoUrl\)/);
  assert.match(seller, /markDamagePhotoAbandoned\(currentUserId, url\)/);
  assert.match(seller, /backendReferencedPhotoSourcesRef\.current\.has\(source\)/);
  assert.match(draft, /remaining\.some\(item => item\.damagePhotoUrl === removedUrl\)/);
});

test('orphan cleanup is owner scoped, survives restarts, waits 24 hours, and fails safely offline', () => {
  assert.match(cleanup, /const GRACE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(cleanup, /czm-damage-orphans-v1:\$\{ownerId\}/);
  assert.match(cleanup, /parsed\.pathname\.startsWith\(marker\)/);
  assert.match(cleanup, /keep\.has\(item\.url\) \|\| now - item\.queuedAt < GRACE_MS/);
  assert.match(cleanup, /await deletePublicStorageObject\(item\.url, 'listings'\)/);
  assert.match(cleanup, /Offline, QA read-only or no permission/);
  assert.match(seller, /sanitizeDamageDraft\(draft\.damageRecords\)/);
  assert.match(seller, /cleanAbandonedDamagePhotos\(currentUserId, keep\)/);
  assert.match(seller, /if \(!currentUserId \|\| activeDamageDraftOwner !== currentUserId \|\| editMode/);
});
