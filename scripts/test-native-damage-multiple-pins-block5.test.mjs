import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../carmazium app/carmazium app/src/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const seller = read('screens/sell/SellCarFlowScreen.tsx');
const mapper = seller.slice(seller.indexOf('function Damage3DMapper('), seller.indexOf('// ─── Main Screen'));
const viewer = read('components/damage/ThreeDVehicleViewer.tsx');
const html = read('assets/3d/viewer.html');
const service = readFileSync(new URL('../backend/src/damage/damage.service.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../backend/prisma/schema.prisma', import.meta.url), 'utf8');

test('saved defects have independent UUIDs, never use the parent panel as ID', () => {
  assert.match(mapper, /id: editingDamageId \?\? createValuationJourneyId\(\)/);
  assert.match(seller, /id: typeof r\.id === 'string'/);
  assert.match(mapper, /records\.flatMap\(\(record, index\) =>\s*record\.surfacePoint \? \[\{ id: record\.id, number: index \+ 1, point: record\.surfacePoint \}\]/);
  assert.match(schema, /model DamageRecord \{[\s\S]*?id\s+String\s+@id @default\(uuid\(\)\)/);
});

test('each point projects through live 3D camera, with no idle raycast', () => {
  assert.match(html, /window\.setDamagePins = function\(json\)/);
  assert.match(html, /function doSetDamagePins\(json\)/);
  assert.match(html, /function postZonePositions\(\) \{/);
  assert.match(html, /pinWorld = resolveZoneWorldPos\(pin\)/);
  assert.match(html, /pinWorld\.clone\(\)\.project\(camera\)/);
  assert.match(html, /type: 'damagePinPositions'/);
  assert.match(html, /_damagePins\.length/);
  assert.match(html, /lastProjectionMs >= 100/);
  assert.match(viewer, /const pinWire = useMemo/);
  assert.match(viewer, /window\.setDamagePins\(/);
  assert.match(viewer, /msg\.type === 'damagePinPositions'/);
});

test('numbered saved pin opens exact defect editor, independent from other scratches on the same panel', () => {
  assert.match(viewer, /damagePins\.map\(pin => \{/);
  assert.match(viewer, /key=\{pin\.id\}/);
  assert.match(viewer, /onPress=\{\(\) => onDamagePinPress\?\.\(pin\.id\)\}/);
  assert.match(viewer, /\{pin\.number\}/);
  assert.match(mapper, /onDamagePinPress=\{editDamage\}/);
  assert.match(mapper, /const editDamage = \(id: string\) =>/);
  assert.match(mapper, /records\.find\(item => item\.id === id\)/);
  assert.match(mapper, /setEditingDamageId\(record\.id\)/);
  assert.match(mapper, /setDmgDesc\(record\.description\)/);
  assert.match(mapper, /setPreservedDamagePhotoUrl\(record\.damagePhotoUrl\)/);
  assert.match(mapper, /accessibilityLabel=\{`Edit damage/);
});

test('editing updates just one ID and retains pre-existing HTTPS photo without re-uploading', () => {
  assert.match(mapper, /editingDamageId \?\? createValuationJourneyId\(\)/);
  assert.match(mapper, /!pendingDamagePhotoUri && preservedDamagePhotoUrl/);
  assert.match(seller, /prev\.some\(r => r\.id === entry\.id\)/);
  assert.match(seller, /prev\.map\(r => r\.id === entry\.id \? entry : r\)/);
  assert.match(seller, /prev\.map\(r => r\.id === entry\.id \? saved : r\)/);
  assert.match(mapper, /editingDamageId \? 'SAVE CHANGES' : 'SAVE & ADD ANOTHER'/);
});

test('mobile sends legacy 2D coords plus exact 3D surface point and UUID, with backend validation', () => {
  assert.match(seller, /id: r\.id,\s*part: zone\?\.id \?\? r\.zone/);
  assert.match(seller, /r\.surfacePoint \? \{ surfacePoint: r\.surfacePoint \} : \{\}/);
  assert.match(seller, /surfacePoint: r\.coords\?\.surfacePoint/);
  assert.match(service, /\.\.\.\(d\.id \? \{ id: d\.id \} : \{\}\)/);
  assert.match(service, /Duplicate damage record identifier/);
  assert.match(service, /Invalid 3D damage marker location/);
});

test('no schema migration required and buyer read-only interactions are unchanged', () => {
  assert.match(schema, /coords\s+Json/);
  assert.doesNotMatch(read('components/damage/BuyerDamageViewer.tsx'), /onDamagePinPress=/);
  assert.match(read('components/damage/BuyerDamageViewer.tsx'), /readOnly/);
  assert.match(mapper, /record\.surfacePoint \? \[/);
});
