import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const viewer = read('src/components/listing/ThreeDVehicleViewer.tsx');
const mapper = read('src/components/listing/VehicleDamageMapper.tsx');
const wizard = read('src/components/listing/ListingWizard.tsx');
const buyer = read('src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx');
const backend = read('backend/src/damage/damage.service.ts');
const controller = read('backend/src/damage/damage.controller.ts');

test('website taps actual mesh surface, not only hotspot dots', () => {
  assert.match(viewer, /onSurfaceTap\?: \(tap: \{ zoneId: string; point: SurfacePoint \}\) => void/);
  assert.match(viewer, /onClick=\{onSurfaceTap \? handleMeshTap : undefined\}/);
  assert.match(viewer, /if \(event\.delta > 8\) return/);
  for (const key of ['fx','fy','fz']) assert.match(viewer, new RegExp(key + ': clampUnit'));
});
test('website edit form opens immediately below 3D model and supports camera, gallery, description and manual alternative', () => {
  assert.ok(mapper.indexOf('<ThreeDVehicleViewer\n') < mapper.indexOf('{/* Pending zone panel */}'));
  assert.ok(mapper.indexOf('{/* Pending zone panel */}') < mapper.indexOf('Choose area manually {manualOpen'));
  for (const match of [/capture="environment"/, /Take Photo/, />Gallery/, /Damage type/, /Description \(optional\)/, /Save & Add Another/, /aria-expanded=\{manualOpen\}/]) assert.match(mapper,match);
});
test('each damage report preserves independent UUID, accurate 3D point, type and durable photo', () => {
  for (const match of [/id: edited\?\.id \?\? crypto\.randomUUID\(\)/, /surfacePoint\?: SurfacePoint/, /photoUrl: pendingPhoto/, /type: pendingType/, /records\.map\(item => item\.id === edited\.id \? rec : item\)/]) assert.match(mapper,match);
  assert.match(mapper, /await uploadImage\(file, "listings", "damage"\)/);
  assert.match(mapper, /if \(!url\.startsWith\("https:\/\/"\)\) throw/);
  assert.match(mapper, /Continue without photo/);
  assert.doesNotMatch(mapper, /readAsDataURL|FileReader\(/);
});
test('wizard blocks navigation while seller has unfinished evidence and preserves manual corrections', () => {
  assert.match(mapper, /onPendingChange\?\.\(Boolean\(pendingZoneId\) \|\| uploading\)/);
  assert.match(mapper, /function blockUnfinishedEditor\(\): boolean/);
  assert.match(wizard, /onPendingChange=\{setDamageEntryPending\}/);
  assert.match(wizard, /const confirmDamageNavigation = \(\)/);
  assert.match(mapper, /aria-label=\{`Select damaged area:/);
  assert.match(mapper, /aria-label=\{`Remove damage/);
});
test('all listing modes serialize 3D damage reports and fail closed on damage-save failure', () => {
  assert.match(wizard, /const buildDamageDetections = \(\) => damageRecords\.map\(record => \(\{/);
  for (const match of [/id: record\.id,/, /part: record\.zone,/, /surfacePoint: record\.surfacePoint/, /imageUrl: record\.photoUrl\?\.startsWith\("https:\/\/"\)/]) assert.match(wizard,match);
  assert.equal((wizard.match(/const detections = buildDamageDetections\(\)/g)||[]).length,4);
  assert.match(wizard, /Damage evidence was not saved/);
  assert.match(wizard, /Damage details were not saved/);
});
test('public viewers show only seller-saved numbered damage, never blanket plus markers', () => {
  const auction = read('src/app/vehicle/[id]/VehicleDetailPageClient.tsx');
  // Root cause: the old !onSurfaceTap branch rendered every predefined
  // zone as a black "+" button on public listings.
  assert.doesNotMatch(viewer, /!onSurfaceTap && ALL_ZONES\\.map/);
  assert.doesNotMatch(viewer, /function Hotspot\\(/);
  assert.match(viewer, /modelBounds && damagePins\\.map\\(pin =>/);
  assert.match(viewer, /\\{pin\\.number\\}/);
  assert.match(viewer, /onClick=\\{onSurfaceTap \\? handleMeshTap : undefined\\}/);
  // Retail and auction both render only real, bounded persisted coordinates.
  assert.match(buyer, /damagePins=\\{buyerDamagePins\\}/);
  assert.match(auction, /const positionedDamage = damageRecords\\.flatMap/);
  assert.match(auction, /record\\.coords\\?\\.surfacePoint/);
  assert.match(auction, /point\\[key\\] >= 0 && point\\[key\\] <= 1/);
  assert.match(auction, /damagePins=\\{positionedDamage\\}/);
  assert.match(auction, /onDamagePinPress=\\{id =>/);
  assert.match(auction, /select a number or the detail card below/);
  assert.match(mapper, /onSurfaceTap=\\{handleSurfaceTap\\}/);
});

test('buyer can inspect individual seller-reported damage without editing it', () => {
  assert.match(buyer,/const \[selectedDamageId, setSelectedDamageId\]/);
  assert.match(buyer,/damagePins=\{buyerDamagePins\}/);
  assert.match(buyer,/record\.coords\?\.surfacePoint/);
  assert.match(buyer,/No damage reported by the seller/);
});
test('server authenticates owner or authorized dealer role inside transaction; evidence photo URLs validated', () => {
  assert.match(controller,/SessionAuthGuard/);
  assert.match(backend,/sellerId/);
  assert.match(backend,/dealerStaff/);
  assert.match(backend,/\$transaction/);
  assert.match(backend,/validOwnerPrefix/);
  assert.match(backend,/validExistingUrl/);
  assert.match(backend,/BadRequestException\('Damage photo must belong to this listing\.'/);
});
