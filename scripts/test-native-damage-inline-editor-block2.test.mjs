import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
const buyer = readFileSync(new URL('../carmazium app/carmazium app/src/components/damage/BuyerDamageViewer.tsx', import.meta.url), 'utf8');

const mapper = source.slice(source.indexOf('function Damage3DMapper('), source.indexOf('// ─── Main Screen'));
test('quick damage editor appears before any manual area list directly after 3D viewer', () => {
  const viewerIndex = mapper.indexOf('<ThreeDVehicleViewer');
  const editorIndex = mapper.indexOf('{/* One-tap quick editor immediately below the 3D model.');
  const chooserIndex = mapper.indexOf('{/* The full list of panels is optional.');
  const recordIndex = mapper.indexOf('{/* Damage list */}');
  assert.ok(viewerIndex > 0 && editorIndex > viewerIndex, 'editor follows model');
  assert.ok(chooserIndex > editorIndex, 'manual list must not separate model and editor');
  assert.ok(recordIndex > chooserIndex, 'records remain after editor');
  assert.match(mapper, /\{addingZone \? \(\s*<View style=\{\[s\.dmgForm/);
  assert.match(mapper, /\{panelChooserOpen && \(\s*<View style=\{s\.damageManualPanelList\}/);
  const guardedList = mapper.slice(chooserIndex, recordIndex);
  assert.ok(guardedList.indexOf('{panelChooserOpen && (') < guardedList.indexOf('{DAMAGE_ZONE_SECTIONS.map(section =>'), 'manual list must be guarded by closed-by-default disclosure');
});
test('seller can correct nearest panel with one control and preserves original point for standard known panels', () => {
  assert.match(mapper, /onSurfaceTap=\{\(\{ zoneId, point \}\) =>/);
  assert.match(mapper, /setPendingSurfacePoint\(point\);\s*setAddingZone\(zone\.label\);/);
  assert.match(mapper, /accessibilityLabel="Change selected damage panel"/);
  assert.match(mapper, /setCorrectingPanel\(true\); setPanelChooserOpen\(true\)/);
  assert.match(mapper, /const chooseKnownPanel = \(label: string\) => \{\s*if \(!correctingPanel\) setPendingSurfacePoint\(null\);/);
  assert.match(mapper, /onPress=\{\(\) => \{ if \(!uploadingDamagePhoto\) chooseKnownPanel\(zone\.label\); \}\}/);
  assert.match(mapper, /original tap position is kept/);
  assert.match(mapper, /Suggested from a generic 3D car/);
});
test('manual fallback is accessible, initially closed, and clears stale hit coordinates', () => {
  assert.match(mapper, /useState\(false\);\s*const \[correctingPanel, setCorrectingPanel\]/);
  assert.match(mapper, /accessibilityLabel="Choose damage area manually"/);
  assert.match(mapper, /accessibilityState=\{\{ expanded: panelChooserOpen \}\}/);
  assert.match(mapper, /const selectManualZone = \(label: string\) => \{\s*setPendingSurfacePoint\(null\)/);
  assert.match(mapper, /selectManualZone\(customZoneText\.trim\(\)\)/);
  assert.match(mapper, /surfacePoint: pendingSurfacePoint/);
});
test('existing submit, type picker, description, grade and damage records remain intact; buyers unchanged', () => {
  for (const feature of ['onPress={confirmAdd}', 'onAdd({', 'dmgType', 'onChangeText={setDmgDesc}',
    'computeExteriorGradeFromDefectCount(records.length)', 'onRemove(r.id)', 'onZonePhoto={onPhoto}']) {
    assert.ok(mapper.includes(feature), feature);
  }
  assert.ok(buyer.includes('readOnly'));
  assert.ok(!buyer.includes('onSurfaceTap='));
});
