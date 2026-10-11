import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../carmazium app/carmazium app/src/', import.meta.url);
const source = path => readFileSync(new URL(path, root), 'utf8');

test('surface picking is disabled by default and uses the actual visible GLB mesh', () => {
  const html = source('assets/3d/viewer.html');
  assert.match(html, /window\._surfacePickingEnabled = false/);
  assert.match(html, /new THREE\.Raycaster\(\)/);
  assert.match(html, /damageRaycaster\.intersectObject\(_modelInfo\.model, true\)/);
  assert.match(html, /if \(!hits\.length\) return/);
  assert.match(html, /zoneId: closestDamageZone\(point\)/);
  assert.match(html, /type: 'surfaceDamageTap'/);
  assert.match(html, /world\.clone\(\)\.divideScalar\(m\.scale\)\.add\(m\.center\)/);
});

test('short tap selects but drag, secondary touch and cancelled touch cannot mark damage', () => {
  const html = source('assets/3d/viewer.html');
  assert.match(html, /MAX_TAP_TRAVEL_PX = 10/);
  assert.match(html, /MAX_TAP_DURATION_MS = 550/);
  assert.match(html, /addEventListener\('pointermove'/);
  assert.match(html, /activeTap\.moved = true/);
  assert.match(html, /addEventListener\('pointercancel'/);
  assert.match(html, /event\.isPrimary === false/);
  assert.match(html, /!tap\.moved && distance <= MAX_TAP_TRAVEL_PX/);
  assert.match(html, /type: 'orbitInteraction'/);
  assert.match(html, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
});

test('seller must opt into tap callbacks and webview bridge must validate coordinates and existing part', () => {
  const component = source('components/damage/ThreeDVehicleViewer.tsx');
  assert.match(component, /onSurfaceTap\?: \(tap: DamageSurfaceTap\) => void/);
  assert.match(component, /JSON\.stringify\(!readOnly && !!onSurfaceTap\)/);
  assert.match(component, /msg\.type === 'surfaceDamageTap' && !readOnly && onSurfaceTap/);
  assert.match(component, /hotspotZonesRef\.current\.find\(z => z\.id === msg\.zoneId\)/);
  assert.match(component, /Number\.isFinite\(point\[key\]\)/);
  assert.match(component, /point\[key\] >= 0 && point\[key\] <= 1/);
});

test('seller saves preliminary hit point locally; manual fallback does not retain stale coordinates', () => {
  const seller = source('screens/sell/SellCarFlowScreen.tsx');
  const buyer = source('components/damage/BuyerDamageViewer.tsx');
  assert.match(seller, /surfacePoint\?: DamageSurfacePoint/);
  assert.match(seller, /onSurfaceTap=\{\(\{ zoneId, point \}\) =>/);
  assert.match(seller, /setPendingSurfacePoint\(point\)/);
  assert.match(seller, /surfacePoint: pendingSurfacePoint/);
  assert.match(seller, /const selectManualZone = \(label: string\) => \{[\s\S]*?setPendingSurfacePoint\(null\)/);
  assert.doesNotMatch(buyer, /onSurfaceTap=/);
  assert.match(buyer, /readOnly/);
});
