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


const draftSource = readFileSync(new URL('../src/lib/nativeSellerDraftReadiness.ts', import.meta.url), 'utf8');
const draftCompiled = ts.transpileModule(draftSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const draftHelper = {};
runInNewContext(draftCompiled.outputText, { exports: draftHelper });
const completeDraft = {
  vrm: 'AB12CDE', make: 'Ford', model: 'Focus', year: '2019',
  mileage: '49000', title: 'Ford Focus 2019', location: 'Birmingham',
  fuelType: 'PETROL', transmission: 'MANUAL', bodyType: 'HATCHBACK',
  vehicleType: 'CAR', description: 'Vehicle description', condition: 'GOOD',
  owners: '2', writeOffCat: 'NONE', stolenRecovered: false,
  outstandingFinance: false, isLegalKeeper: true, notOwnerRelationship: '',
  isDepartedSale: false, departedRelationship: '', declAcknowledged: true,
};
test('full persisted Step 1 only resumes later step when all mandatory answers survive restart', () => {
  const valid = d => draftHelper.nativeDraftStepOneComplete(d, normalizeNativeTransmission, normalizeNativeBodyType);
  assert.equal(valid(completeDraft), true);
  for (const field of ['location', 'condition', 'owners', 'writeOffCat', 'description', 'transmission', 'bodyType', 'fuelType']) {
    assert.equal(valid({ ...completeDraft, [field]: '' }), false, `blank ${field} must re-open details`);
  }
  for (const field of ['stolenRecovered', 'outstandingFinance', 'isLegalKeeper']) {
    assert.equal(valid({ ...completeDraft, [field]: null }), false, `missing ${field} must re-open details`);
  }
  assert.equal(valid({ ...completeDraft, isLegalKeeper: false, notOwnerRelationship: '' }), false);
  assert.equal(valid({ ...completeDraft, isDepartedSale: true, departedRelationship: '' }), false);
  assert.equal(valid({ ...completeDraft, declAcknowledged: false }), false);
  assert.equal(valid({ ...completeDraft, vehicleType: 'MOTORCYCLE', bodyType: '' }), true);
});
test('native uses account-scoped hydration and never stores editing an existing listing as the next draft', () => {
  const store = readFileSync(new URL('../src/lib/sellWizardStore.ts', import.meta.url), 'utf8');
  const screen = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../src/store/authStore.ts', import.meta.url), 'utf8');
  assert.match(store, /skipHydration: true/);
  assert.match(store, /czm-sell-wizard-v2:/);
  assert.match(store, /persist\.setOptions\(\{ name: storageKey \}\)/);
  assert.match(store, /AsyncStorage\.removeItem\('czm-sell-wizard-draft'\)/);
  assert.match(auth, /detachSellWizardDraft\(\)/);
  assert.match(screen, /loadSellWizardDraftForUser\(currentUserId\)/);
  assert.match(screen, /nativeDraftStepOneComplete\(store,/);
  assert.match(screen, /if \(!editMode\) updateDraft\(/);
  assert.match(screen, /if \(editMode\) \{ navigation\?\.goBack\(\); return; \}/);
  for (const name of ['location', 'description', 'condition', 'owners', 'stolenRecovered', 'outstandingFinance', 'isLegalKeeper']) {
    assert.match(store, new RegExp(name + ': state\\.' + name));
  }
});
test('publish revalidates restored vehicle, price and auction settings before any payment', () => {
  const screen = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  const pub = screen.slice(screen.indexOf('async function handlePublish()'), screen.indexOf('// ─── Navigation'));
  assert.ok(pub.indexOf('validateStep(1)') < pub.indexOf('setIsPublishing(true)'));
  assert.ok(pub.indexOf('validateStep(3)') < pub.indexOf('setIsPublishing(true)'));
  assert.ok(pub.indexOf('validateStep(4)') < pub.indexOf('setIsPublishing(true)'));
});
test('typing a new full registration triggers lookup without stale dvlaLoading/dvlaFetched', () => {
  const screen = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /const registrationChanged = cleaned !== currentVrmRef\.current/);
  assert.match(screen, /registrationChanged \|\| \(!dvlaFetched && !dvlaLoading\)/);
});
