import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/sellerVehicleSpecs.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const helpers = {};
runInNewContext(compiled.outputText, { exports: helpers }, { filename: 'nativeSellerVehicleSpecs.js' });
const { normalizeNativeTransmission, normalizeNativeRegistration,
  normalizeNativeBodyType, preserveNativeLookupSpecs, allowedNativeBodyTypes } = helpers;

test('backend enum-compatible gearbox spellings survive lookup and draft hydration', () => {
  for (const value of ['manual', 'MANUAL']) assert.equal(normalizeNativeTransmission(value), 'MANUAL');
  assert.equal(normalizeNativeTransmission('auto'), 'AUTOMATIC');
  assert.equal(normalizeNativeTransmission('semi-auto'), 'SEMI_AUTOMATIC');
  assert.equal(normalizeNativeTransmission('CVT'), 'CVT');
  assert.equal(normalizeNativeTransmission('unknown'), '');
});
test('categories show real car and HGV options and no hidden motorcycle body type', () => {
  assert.ok(allowedNativeBodyTypes('CAR').includes('SUV'));
  assert.ok(allowedNativeBodyTypes('HGV').includes('HGV_BOX'));
  assert.equal(allowedNativeBodyTypes('MOTORCYCLE').length, 0);
  assert.equal(normalizeNativeBodyType('saloon', 'CAR'), 'SEDAN');
  assert.equal(normalizeNativeBodyType('HGV_BOX', 'CAR'), '');
  assert.equal(normalizeNativeBodyType('SUV', 'HGV'), '');
});
test('seller choices beat a later conflicting lookup for the same registration', () => {
  const specs = preserveNativeLookupSpecs({
    vrm: 'AB12 CDE', transmission: 'MANUAL', bodyType: 'SUV', vehicleType: 'CAR',
  }, { vrm: 'ab12cde', transmission: 'AUTOMATIC', bodyType: 'SEDAN' });
  assert.equal(specs.transmission, 'MANUAL');
  assert.equal(specs.bodyType, 'SUV');
});
test('a new registration cannot inherit the previous vehicle gearbox/body', () => {
  const specs = preserveNativeLookupSpecs({
    vrm: 'AB12 CDE', transmission: 'MANUAL', bodyType: 'SUV', vehicleType: 'CAR',
  }, { vrm: 'CD34 EFG', transmission: 'AUTO', bodyType: 'saloon' });
  assert.equal(normalizeNativeRegistration(' CD34 efg '), 'CD34EFG');
  assert.equal(specs.transmission, 'AUTOMATIC');
  assert.equal(specs.bodyType, 'SEDAN');
});
test('native screen uses request guards, valid edit/draft specs and inline controls', () => {
  const screen = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /requestId !== lookupRequestRef\.current \|\| clean !== currentVrmRef\.current/);
  assert.match(screen, /setTransmission\(prev => normalizeNativeTransmission\(prev\) \|\| incomingTransmission\)/);
  assert.match(screen, /setBodyType\(prev => normalizeNativeBodyType\(prev, currentType\) \|\| incomingBodyType\)/);
  assert.match(screen, /if \(key === 'bodyType' && vehicleType !== 'MOTORCYCLE'/);
  assert.match(screen, /if \(key === 'transmission' && !normalizeNativeTransmission\(transmission\)\)/);
  assert.match(screen, /const draftSpecsValid =/);
  assert.match(screen, /vrm, vehicleType, make, model/);
});
