import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../carmazium app/carmazium app/src/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const viewer = read('components/damage/ThreeDVehicleViewer.tsx');
const layout = read('components/damage/damagePinLayout.ts');
const seller = read('screens/sell/SellCarFlowScreen.tsx');
const mapper = seller.slice(seller.indexOf('function Damage3DMapper('), seller.indexOf('// ─── Main Screen'));
const html = read('assets/3d/viewer.html');

test('every saved damage keeps its own number, type, photo indicator and exact pin ID', () => {
  assert.match(mapper, /id: record\.id, number: index \+ 1, point: record\.surfacePoint/);
  assert.match(mapper, /type: record\.type, zone: record\.zone, hasPhoto: Boolean\(record\.damagePhotoUrl\)/);
  assert.match(viewer, /const pin = damagePins\.find\(item => item\.id === placed\.id\)/);
  assert.match(viewer, /key=\{pin\.id\}/);
  assert.match(viewer, /onDamagePinPress\?\.\(pin\.id\)/);
  assert.match(viewer, /accessibilityState=\{\{ selected \}\}/);
  assert.match(viewer, /pin\.hasPhoto && <View style=\{styles\.damagePinPhoto\}>/);
});

test('seller-specific pins are 44dp tappable and do not block generic mesh surface selection', () => {
  assert.match(viewer, /width: 44,\s*height: 44/);
  assert.match(viewer, /!inlineDamageEditor && hotspotZones\.map/);
  assert.match(viewer, /\{!readOnly && placedDamagePins\.map/);
  assert.match(viewer, /pointerEvents="box-none"/);
  assert.match(viewer, /onSurfaceTap/);
  assert.match(viewer, /styles\.damagePinSelected/);
  assert.match(viewer, /backgroundColor: typeColor/);
  assert.match(viewer, /Colors\.warning/);
  assert.match(viewer, /Colors\.error/);
  assert.match(viewer, /Colors\.accent/);
  assert.match(read('components/damage/BuyerDamageViewer.tsx'), /readOnly/);
});

test('overlap layout uses bounded stable offsets and keeps 3D coordinates unchanged', () => {
  assert.match(layout, /export function layoutProjectedDamagePins\(/);
  assert.match(layout, /const MIN_DISTANCE = 49/);
  assert.match(layout, /const BORDER_TOP = 48/);
  assert.match(layout, /const OFFSETS:/);
  assert.match(layout, /placed\.map\(other => Math\.hypot/);
  assert.match(layout, /clamp\(x \+ dx, BORDER_X, width - BORDER_X\)/);
  assert.match(layout, /displaced: best\.distance > 5/);
  assert.match(viewer, /left: midX - tetherLength \/ 2/);
  assert.match(viewer, /transform: \[\{ rotate: `\$\{tetherAngle\}deg` \}\]/);
  assert.match(viewer, /styles\.damagePinTether/);
  assert.doesNotMatch(layout, /updateDraft|surfacePoint\s*=|damagePhotoUrl\s*=/);
});

test('rotation still throttles Three.js projections; unchanged bridge positions do not re-render', () => {
  assert.match(html, /lastProjectionMs >= 100/);
  assert.match(html, /if \(projectionPending && _modelInfo && _zones\.length/);
  assert.match(viewer, /setDamagePinScreenPos\(prev => \{/);
  assert.match(viewer, /prev\[id\]\.visible === next\[id\]\.visible/);
  assert.match(viewer, /Math\.abs\(prev\[id\]\.x - next\[id\]\.x\) <= 0\.16/);
  assert.match(viewer, /Math\.abs\(prev\[id\]\.y - next\[id\]\.y\) <= 0\.16/);
  assert.match(viewer, /if \(!damagePins\.length\)/);
  assert.match(viewer, /const placedDamagePins = useMemo/);
});

test('summary shows defect total, 3D pins, uploaded photos, category count and manual-only records', () => {
  assert.match(mapper, /const photoProofCount = records\.filter/);
  assert.match(mapper, /const manuallyLocatedCount = records\.length - damagePins\.length/);
  assert.match(mapper, /const damageTypeCounts = DAMAGE_TYPES\.map/);
  assert.match(mapper, /s\.damageSummaryRow/);
  assert.match(mapper, />Damages</);
  assert.match(mapper, />3D pins</);
  assert.match(mapper, />Photos</);
  assert.match(mapper, /damageTypeCounts\.map/);
  assert.match(mapper, /manually placed \(see list\)/);
  assert.match(mapper, /s\.damagePinLegend/);
  assert.match(mapper, /editingDamageId === r\.id && s\.dmgRecordSelected/);
});

test('existing damage grade, backend, photo association, and role gates remain intact', () => {
  assert.match(mapper, /computeExteriorGradeFromDefectCount\(records\.length\)/);
  assert.match(mapper, /onDamagePinPress=\{editDamage\}/);
  assert.match(seller, /damagePhotoUrl: source/);
  assert.match(seller, /surfacePoint: r\.coords\?\.surfacePoint/);
  assert.match(viewer, /!readOnly && !!onSurfaceTap/);
});
