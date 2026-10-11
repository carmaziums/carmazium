import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const webModel = read('src/components/listing/ThreeDVehicleViewer.tsx');
const webSeller = read('src/components/listing/VehicleDamageMapper.tsx');
const webBuyer = read('src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx');
const nativeBuyer = read('carmazium app/carmazium app/src/components/damage/BuyerDamageViewer.tsx');
const nativeViewer = read('carmazium app/carmazium app/src/components/damage/ThreeDVehicleViewer.tsx');

test('web seller uses actual mesh click with normalized stable surface coordinates', () => {
  assert.match(webModel, /onSurfaceTap\?: \(tap: \{ zoneId: string; point: SurfacePoint \}\) => void/);
  assert.match(webModel, /onClick=\{onSurfaceTap \? handleMeshTap : undefined\}/);
  assert.match(webModel, /if \(event\.delta > 8\) return/);
  assert.match(webModel, /const bounds = new THREE\.Box3\(\)\.setFromObject\(group\)/);
  assert.match(webModel, /fx: clampUnit/);
  assert.match(webModel, /fy: clampUnit/);
  assert.match(webModel, /fz: clampUnit/);
  assert.match(webModel, /autoRotate=\{!onSurfaceTap && damagePins\.length === 0\}/);
});

test('web seller direct-tap editor precedes optional manual list and uses same photo/type workflow', () => {
  const viewer = webSeller.indexOf('<ThreeDVehicleViewer\n');
  const editor = webSeller.indexOf('{/* Pending zone panel */}');
  const chooser = webSeller.indexOf('Choose area manually {manualOpen');
  assert.ok(viewer > -1 && editor > viewer && chooser > editor);
  assert.match(webSeller, /onSurfaceTap=\{handleSurfaceTap\}/);
  assert.match(webSeller, /capture="environment"/);
  assert.match(webSeller, /Take Photo/);
  assert.match(webSeller, />Gallery/);
  assert.match(webSeller, /Damage type/);
  assert.match(webSeller, /Description \(optional\)/);
  assert.match(webSeller, /Save & Add Another/);
  assert.match(webSeller, /aria-expanded=\{manualOpen\}/);
});

test('multiple website damages share a panel but not their identity, photo or exact location', () => {
  assert.match(webSeller, /id: edited\?\.id \?\? crypto\.randomUUID\(\)/);
  assert.match(webSeller, /surfacePoint\?: SurfacePoint/);
  assert.match(webSeller, /photoUrl: pendingPhoto/);
  assert.match(webSeller, /type: pendingType/);
  assert.match(webSeller, /records\.map\(item => item\.id === edited\.id \? rec : item\)/);
  assert.match(webModel, /key=\{pin\.id\}/);
  assert.match(webModel, /onDamagePinPress\?\.\(pin\.id\)/);
});

test('website upload does not persist base64 previews when storage fails', () => {
  assert.match(webSeller, /await uploadImage\(file, "listings", "damage"\)/);
  assert.match(webSeller, /if \(!url\.startsWith\("https:\/\/"\)\) throw/);
  assert.match(webSeller, /setUploadError\(/);
  assert.match(webSeller, /Continue without photo/);
  assert.match(webSeller, /disabled=\{uploading \|\| Boolean\(uploadError\)\}/);
  assert.doesNotMatch(webSeller, /readAsDataURL|FileReader\(/);
});

test('both buyers select defect ID, preserving individual records and evidence on the same panel', () => {
  assert.match(webBuyer, /const \[selectedDamageId, setSelectedDamageId\]/);
  assert.match(webBuyer, /damagePins=\{buyerDamagePins\}/);
  assert.match(webBuyer, /selectedDamageId=\{selectedDamageId\}/);
  assert.match(webBuyer, /onDamagePinPress=\{id => setSelectedDamageId/);
  assert.match(webBuyer, /key=\{record\.id \?\? i\}/);
  assert.match(nativeBuyer, /setSelectedDamageId/);
  assert.match(nativeBuyer, /selectedDamageId=\{selectedDamageId\}/);
  assert.match(nativeBuyer, /onDamagePinPress=\{id => setSelectedDamageId/);
  assert.match(nativeBuyer, /onPress=\{\(\) => setSelectedDamageId/);
  assert.match(nativeBuyer, /selectedRecord\.imageUrl/);
});

test('buyer pin interactions remain read-only and legacy missing surface locations are not fabricated', () => {
  assert.match(nativeViewer, /\(!readOnly \|\| Boolean\(onDamagePinPress\)\)/);
  assert.match(nativeBuyer, /validSurfacePoint\(record\.coords\?\.surfacePoint\)/);
  assert.match(nativeBuyer, /readOnly/);
  assert.doesNotMatch(nativeBuyer, /onSurfaceTap=/);
  assert.match(webBuyer, /if \(!point \|\| !\['fx', 'fy', 'fz'\]\.every/);
  assert.match(webBuyer, /record\.coords\?\.surfacePoint/);
});

test('seller-reported damage is not falsely represented as independent vehicle inspection', () => {
  assert.match(nativeBuyer, /This is the seller’s report, not an independent inspection/);
  assert.match(nativeBuyer, /No damage reported by the seller/);
  assert.match(webBuyer, /No damage reported by the seller/);
  assert.match(nativeBuyer, /getDescription\(selectedRecord\.type\)/);
});
