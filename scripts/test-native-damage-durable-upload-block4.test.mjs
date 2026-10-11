import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const seller = readFileSync(new URL('../carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
const mapper = seller.slice(seller.indexOf('function Damage3DMapper('), seller.indexOf('// ─── Main Screen'));
const uploader = seller.slice(seller.indexOf('async function handleAddDamageEntry('), seller.indexOf('async function handlePickPhoto()', seller.indexOf('async function handleAddDamageEntry(')));
const publishing = seller.slice(seller.indexOf('async function handlePublish()'), seller.indexOf('// Damage records are saved via a dedicated endpoint', seller.indexOf('async function handlePublish()')));

test('damage evidence uploads to owner-scoped Supabase storage, never a local file URI', () => {
  assert.match(uploader, /const sellerId = useAuthStore\.getState\(\)\.user\?\.id/);
  assert.match(uploader, /if \(!sellerId\) throw/);
  assert.match(uploader, /await convertAndCompress\(entry\.localDamagePhotoUri\)/);
  assert.match(uploader, /const objectPath = `\$\{sellerId\}\/damage\/\$\{createValuationJourneyId\(\)\}\.jpg`/);
  assert.match(uploader, /await uploadToStorage\(compressedUri, 'listings', objectPath, 'image\/jpeg'\)/);
  assert.match(uploader, /source\.startsWith\('https:\/\/'\)/);
  assert.match(uploader, /source\.includes\('\/storage\/v1\/object\/public\/listings\/'\)/);
  assert.match(uploader, /setDamageRecords\(prev => \[\.\.\.prev, \{[\s\S]*?damagePhotoUrl: source,[\s\S]*?localDamagePhotoUri: undefined/);
});

test('new upload is counted as listing DAMAGE image and limits enforced before storage', () => {
  assert.match(uploader, /if \(photoCount >= MAX_PHOTOS\)/);
  assert.ok(uploader.indexOf('if (photoCount >= MAX_PHOTOS)') < uploader.indexOf('await uploadToStorage('));
  assert.match(uploader, /encodeVehicleImageCategory\(source, 'DAMAGE'\)/);
  assert.match(uploader, /newlyUploadedPhotoSourcesRef\.current\.add\(source\)/);
  assert.match(uploader, /onProgress\(10\)/);
  assert.match(uploader, /onProgress\(45\)/);
  assert.match(uploader, /onProgress\(90\)/);
  assert.match(uploader, /onProgress\(100\)/);
});

test('one defect owns its HTTPS evidence; editing legacy saved records preserves their URLs', () => {
  assert.match(seller, /damagePhotoUrl\?: string/);
  assert.match(seller, /damagePhotoUrl: parseVehicleImageMetadata\(r\.imageUrl\)\.src/);
  assert.match(seller, /imageUrl: r\.damagePhotoUrl && r\.damagePhotoUrl\.startsWith\('https:\/\/'\)/);
  assert.doesNotMatch(seller.slice(seller.indexOf('detections: damageRecords.map(r =>'), seller.indexOf('}),', seller.indexOf('detections: damageRecords.map(r =>'))), /zonePhotos\[zone\.id\]/);
});

test('upload errors keep the original editor text and photo; retry uses same evidence', () => {
  assert.match(mapper, /await onAdd\(\{[\s\S]*?localDamagePhotoUri: pendingDamagePhotoUri[\s\S]*?\}, setDamageUploadPercent\)/);
  assert.match(mapper, /catch \(error: any\) \{[\s\S]*?setDamageUploadError\(/);
  const start = mapper.indexOf('async function confirmAdd()');
  const end = mapper.indexOf('const markedLabels', start);
  const save = mapper.slice(start, end);
  assert.ok(save.indexOf('await onAdd(') < save.indexOf('resetDamageEditor()'));
  assert.ok(save.indexOf('resetDamageEditor()') < save.indexOf('catch (error: any)'));
  assert.match(mapper, /'RETRY SAVE'/);
  assert.match(mapper, /Uploading damage photo — \{damageUploadPercent\}%/);
});

test('listing cannot be published or advanced with an uncommitted or in-flight damage photo', () => {
  assert.match(seller, /if \(damageUploadInFlightRef\.current \|\| damageEditorPending\) \{/);
  assert.match(publishing, /damageUploadInFlightRef\.current \|\| damageEditorPending \|\| damageRecords\.some\(/);
  assert.ok(publishing.indexOf('damageUploadInFlightRef.current') < publishing.indexOf('publishingInFlightRef.current = true'));
  assert.match(mapper, /onPendingChange\?\.\(Boolean\(addingZone\) \|\| pickingDamagePhoto \|\| uploadingDamagePhoto\)/);
});

test('deleting a defect only deletes its unique evidence when no other defect needs the URL', () => {
  assert.match(seller, /async function handleRemoveDamageEntry\(id: string\)/);
  assert.match(seller, /!damageRecords\.some\(item => item\.id !== id && item\.damagePhotoUrl === url\)/);
  assert.match(seller, /await removePhoto\('Damage', encodeVehicleImageCategory\(url, 'DAMAGE'\)\)/);
});
