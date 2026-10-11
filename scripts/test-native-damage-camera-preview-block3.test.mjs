import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../carmazium app/carmazium app/src/', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const seller = read('screens/sell/SellCarFlowScreen.tsx');
const mapper = seller.slice(seller.indexOf('function Damage3DMapper('), seller.indexOf('// ─── Main Screen'));
const viewer = read('components/damage/ThreeDVehicleViewer.tsx');

test('seller inline form offers actual camera and single-image gallery pickers with preview', () => {
  assert.match(mapper, /ImagePicker\.requestCameraPermissionsAsync\(\)/);
  assert.match(mapper, /ImagePicker\.launchCameraAsync\(\{/);
  assert.match(mapper, /ImagePicker\.launchImageLibraryAsync\(\{/);
  assert.match(mapper, /allowsMultipleSelection: false/);
  assert.match(mapper, /onPress=\{\(\) => \{ void pickDamagePhoto\('camera'\); \}\}/);
  assert.match(mapper, /onPress=\{\(\) => \{ void pickDamagePhoto\('gallery'\); \}\}/);
  assert.match(mapper, /source=\{\{ uri: pendingDamagePhotoUri \}\}/);
  assert.match(mapper, /accessibilityLabel="Remove selected damage photo"/);
});

test('cancelled picker and denied camera access preserve active description and existing staged photo', () => {
  assert.match(mapper, /if \(!permission\.granted\) \{/);
  assert.match(mapper, /if \(!result\.canceled && result\.assets\?\.\[0\]\?\.uri\)/);
  assert.match(mapper, /setPendingDamagePhotoUri\(result\.assets\[0\]\.uri\)/);
  assert.match(mapper, /photoPickerInFlightRef\.current = true/);
  assert.match(mapper, /finally \{\s*photoPickerInFlightRef\.current = false;/);
  assert.match(mapper, /disabled=\{pickingDamagePhoto\}/);
  assert.match(mapper, /setDmgDesc/);
});

test('Save & Add Another associates local photo with one damage, prevents double-taps and resets next entry', () => {
  assert.match(seller, /localDamagePhotoUri\?: string/);
  assert.match(mapper, /pendingDamagePhotoUri \? \{ localDamagePhotoUri: pendingDamagePhotoUri \}/);
  assert.match(mapper, /function confirmAdd\(\) \{\s*if \(!addingZone \|\| pickingDamagePhoto \|\| savingDamageRef\.current\) return;/);
  assert.match(mapper, /savingDamageRef\.current = true/);
  assert.match(mapper, /onAdd\(\{[\s\S]*?localDamagePhotoUri:[\s\S]*?\}\);\s*\/\/ Ready for another direct tap/);
  assert.match(mapper, /resetDamageEditor\(\);/);
  assert.match(mapper, /setPendingDamagePhotoUri\(null\)/);
  assert.match(mapper, />SAVE & ADD ANOTHER</);
  assert.match(mapper, /r\.localDamagePhotoUri && \(/);
  assert.match(mapper, /source=\{\{ uri: r\.localDamagePhotoUri \}\}/);
});

test('old viewer Photo pill is suppressed only in seller quick-entry mode; buyer stays read only', () => {
  assert.match(viewer, /inlineDamageEditor\?: boolean/);
  assert.match(viewer, /!readOnly && !inlineDamageEditor/);
  assert.match(viewer, /inlineDamageEditor \? null : zones\.find/);
  assert.match(mapper, /inlineDamageEditor\s+onSurfaceTap=/);
  assert.match(read('components/damage/BuyerDamageViewer.tsx'), /readOnly/);
  assert.doesNotMatch(read('components/damage/BuyerDamageViewer.tsx'), /inlineDamageEditor/);
});

test('publishing fails closed before any listing writes or fee charge for local-only damage photos', () => {
  const publishing = seller.slice(seller.indexOf('async function handlePublish()'), seller.indexOf('// Damage records are saved via a dedicated endpoint', seller.indexOf('async function handlePublish()')));
  const guard = publishing.indexOf('damageRecords.some(record => Boolean(record.localDamagePhotoUri))');
  const writes = publishing.indexOf('const payload: Record<string, any> =');
  assert.ok(guard > 0 && writes > guard);
  assert.match(publishing, /setStep\(2\);\s*setPhotoTab\('Damage'\);/);
  assert.match(publishing, /Damage photos not uploaded/);
  assert.match(publishing, /publishingInFlightRef\.current = true/);
});
