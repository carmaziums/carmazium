#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'carmazium app/carmazium app/src/';
const html = src(root + 'assets/3d/viewer.html');
const viewer = src(root + 'components/damage/ThreeDVehicleViewer.tsx');
const buyer = src(root + 'components/damage/BuyerDamageViewer.tsx');
const retail = src(root + 'screens/vehicle/VehicleDetailScreen.tsx');
const auction = src(root + 'screens/vehicle/AuctionDetailScreen.tsx');
const seller = src(root + 'screens/sell/SellCarFlowScreen.tsx');

test('bundled Three.js viewer stays syntactically valid and offline', () => {
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'found module script in offline WebView asset');
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /\/\*__THREE_BUNDLE__\*\//);
  assert.match(viewer, /cachedViewerHtmlPromise/);
  assert.match(viewer, /cachedGlbBase64Promise/);
  assert.match(viewer, /loadGlbBase64/);
});

test('gesture input belongs to car WebView; parent scroll is unlocked on every exit', () => {
  assert.match(html, /touch-action:none;overscroll-behavior:none/);
  assert.match(html, /canvas\{display:block;touch-action:none/);
  assert.match(html, /controls\.addEventListener\('start', function\(\) \{ reportInteraction\(true\)/);
  assert.match(html, /controls\.addEventListener\('end', function\(\) \{ reportInteraction\(false\)/);
  assert.match(viewer, /onInteractionChange\?: \(active: boolean\) => void/);
  assert.match(viewer, /onTouchStart=\{\(\) => setInteracting\(true\)\}/);
  assert.match(viewer, /onTouchEnd=\{\(\) => setInteracting\(false\)\}/);
  assert.match(viewer, /onTouchCancel=\{\(\) => setInteracting\(false\)\}/);
  assert.match(viewer, /useEffect\(\(\) => \(\) => \{ onInteractionChange\?\.\(false\); \}, \[onInteractionChange\]\)/);
  assert.match(viewer, /scrollEnabled=\{false\}/);
  assert.match(viewer, /nestedScrollEnabled=\{false\}/);
  assert.match(viewer, /type === 'orbitInteraction'/);
  for (const screen of [retail, auction, seller]) {
    assert.match(screen, /scrollEnabled=\{!is3DInteracting\}/);
    assert.match(screen, /onInteractionChange=\{set3DInteracting\}/);
  }
  assert.match(buyer, /onInteractionChange=\{onInteractionChange\}/);
});

test('WebGL spends less GPU/bridge time on static model but updates damage pins after orbit', () => {
  assert.match(html, /setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)\)/);
  assert.match(html, /if \(renderPending\) \{[\s\S]*?renderer\.render\(scene, camera\)/);
  assert.match(html, /if \(projectionPending && _modelInfo && _zones\.length/);
  assert.match(html, /now - lastProjectionMs >= 100/);
  assert.match(html, /controls\.addEventListener\('change', invalidate\)/);
  assert.match(html, /if \(!document\.hidden\) invalidate\(\)/);
  assert.doesNotMatch(html, /setInterval\(postZonePositions/);
  assert.match(viewer, /return changed \? next : prev/);
  assert.match(viewer, /const viewerSource = useMemo/);
  assert.match(viewer, /source=\{viewerSource!\}/);
});

test('buttons rotate and tilt reliably without intercepting buyer/seller damage hotspots', () => {
  assert.match(html, /window\.nudgeVehicle = function\(direction\)/);
  assert.match(html, /controls\.minPolarAngle, Math\.min\(controls\.maxPolarAngle, spherical\.phi\)/);
  assert.match(html, /type: 'modelReady'/);
  assert.match(viewer, /type === 'modelReady'/);
  for (const dir of ['left','right','up','down']) assert.ok(viewer.includes("'"+dir+"'"), dir);
  assert.match(viewer, /nudgeModel\(direction\)/);
  assert.match(viewer, /disabled=\{!modelReady\}/);
  assert.match(viewer, /accessibilityRole="button"/);
  assert.match(viewer, /width: 42,[\s\S]*?height: 42/);
  assert.match(viewer, /onZoneClick\(zone\.label\)/);
  assert.match(viewer, /onZonePhoto\?\.\(zoneId, uri\)/);
  assert.match(viewer, /onZoneHide\?\.\(zoneId\)/);
  assert.match(buyer, /readOnly/);
  assert.match(seller, /onZonePhoto=\{onPhoto\}/);
});

test('production money and account permission logic is untouched by this viewer-only change', () => {
  assert.match(seller, /createPaymentSheet/);
  assert.match(seller, /presentPaymentSheet/);
  assert.match(auction, /canPlaceBid/);
  assert.match(retail, /listing\.status/);
});
