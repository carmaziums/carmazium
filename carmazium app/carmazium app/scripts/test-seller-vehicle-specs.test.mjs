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
  assert.match(screen, /const detailsReady = nativeDraftStepOneComplete\(store,/);
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


const auctionSource = readFileSync(new URL('../src/lib/nativeAuctionDraft.ts', import.meta.url), 'utf8');
const auctionJs = ts.transpileModule(auctionSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(auctionJs.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const auction = {};
runInNewContext(auctionJs.outputText, { exports: auction });
const nativeAuctionValid = {
  auctionStartMode: 'NOW', auctionStartDate: '',
  reservePrice: '5000', startingBid: '3500', minIncrement: '100', buyItNowPrice: '',
};
test('native scheduled starts reject malformed formats, impossible dates and past times', () => {
  assert.equal(auction.parseNativeAuctionLocalStart('not-a-date'), null);
  assert.equal(auction.parseNativeAuctionLocalStart('2027-02-30 14:00'), null);
  assert.equal(auction.parseNativeAuctionLocalStart('2027-13-01 14:00'), null);
  assert.equal(auction.parseNativeAuctionLocalStart('2027-04-01 25:00'), null);
  const local = auction.parseNativeAuctionLocalStart('2027-04-01 14:00');
  assert.equal(local.getFullYear(), 2027);
  assert.equal(local.getMonth(), 3);
  assert.equal(auction.nativeScheduledStartIsValid('2027-04-01 14:00', local.getTime() - 2 * 60_000), true);
  assert.equal(auction.nativeScheduledStartIsValid('2027-04-01 14:00', local.getTime()), false);
});
test('a stored auction only resumes Review if its schedule and pricing survived restart', () => {
  assert.equal(auction.nativeAuctionDraftReady(nativeAuctionValid), true);
  assert.equal(auction.nativeAuctionDraftReady({ ...nativeAuctionValid, reservePrice: '' }), false);
  assert.equal(auction.nativeAuctionDraftReady({ ...nativeAuctionValid, startingBid: '' }), false);
  assert.equal(auction.nativeAuctionDraftReady({ ...nativeAuctionValid, minIncrement: '-1' }), false);
  assert.equal(auction.nativeAuctionDraftReady({ ...nativeAuctionValid, buyItNowPrice: 'xyz' }), false);
  assert.equal(auction.nativeAuctionDraftReady({
    ...nativeAuctionValid, auctionStartMode: 'SCHEDULED', auctionStartDate: 'bad',
  }), false);
});
test('native user-scoped draft saves auction settings and publishes only a validated start', () => {
  const store = readFileSync(new URL('../src/lib/sellWizardStore.ts', import.meta.url), 'utf8');
  const screen = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  for (const field of ['auctionStartMode', 'auctionStartDate', 'reservePrice', 'startingBid', 'minIncrement', 'buyItNowPrice']) {
    assert.match(store, new RegExp(field + ': state\\.' + field));
  }
  assert.match(screen, /nativeAuctionDraftReady\(store\)/);
  assert.match(screen, /if \(!auctionReady && wantedStep > 3\)/);
  assert.match(screen, /nativeScheduledStartIsValid\(auctionStartDate\)/);
  assert.match(screen, /parseNativeAuctionLocalStart\(auctionStartDate\)!\.toISOString\(\)/);
  assert.match(screen, /validateStep\(4\)/);
});


test('native listing wizard preserves the same backend-locked quote as web', () => {
  const screen = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/lib/valuationApi.ts', import.meta.url), 'utf8');
  assert.match(screen, /setValuation\(baseValuation\)/);
  assert.doesNotMatch(screen, /setValuation\(applyVehicleValuationAdjustments\(/);
  assert.match(api, /fetch\(\x60\$\{API_URL\}\/listings\/valuation\?/);
  assert.doesNotMatch(api, /getDeterministicFallbackValuation\(/);
});

test('native Auction-to-Retail conversion offers the same keep-both primary choice and explicit two-step cancellation', () => {
  const screen = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /title="List in Retail without losing your Auction"/);
  assert.match(screen, /OPTION 1 · KEEP BOTH LISTINGS/);
  assert.match(screen, /KEEP AUCTION & ALSO LIST RETAIL/);
  assert.match(screen, /OPTION 2 · REPLACE THE AUCTION/);
  assert.match(screen, /setAuctionRetailConfirmCancel\(true\)/);
  assert.match(screen, /CONFIRM: CANCEL AUCTION & SWITCH/);
  assert.match(screen, /resolveAuctionRetailChoice\('CONVERT'\)/);
  assert.match(screen, /if \(choice === 'KEEP_BOTH'\)/);
  assert.match(screen, /navigation\?\.navigate\('SellerAuctions', \{/);
  assert.match(screen, /alsoRetailListingId: conversion\.candidate\.listingId/);
  assert.match(screen, /alsoRetailPrice: priceAsking/);
  assert.match(screen, /if \(choice === null\) return/);
  // The linked flow must never pass a cancellation flag.
  const keep = screen.split("if (choice === 'KEEP_BOTH') {")[1].split('const converted = await convertAuctionToRetail')[0];
  assert.doesNotMatch(keep, /confirmAuctionCancellation/);
  const conversion = screen.split('const converted = await convertAuctionToRetail')[1];
  assert.match(conversion, /confirmAuctionCancellation: true/);
});

test('native Auction screen reopens the existing vehicle at its entered Retail price and tier', () => {
  const screen = readFileSync(new URL('../src/screens/seller/SellerAuctionsScreen.tsx', import.meta.url), 'utf8');
  const routes = readFileSync(new URL('../src/navigation/MainStackNavigator.tsx', import.meta.url), 'utf8');
  assert.match(routes, /alsoRetailListingId\?: string; alsoRetailPrice\?: string; alsoRetailTier\?:/);
  assert.match(screen, /const source = auctions\.find\(a =>/);
  assert.match(screen, /a\.listingId === alsoRetailListingId/);
  assert.match(screen, /setRetailPrice\(alsoRetailPrefillPrice \?\? ''\)/);
  assert.match(screen, /setRetailTier\(alsoRetailPrefillTier\)/);
  assert.match(screen, /setAlsoRetailAuction\(source\)/);
  assert.match(screen, /alsoRetailHandoffHandledRef\.current = alsoRetailListingId/);
  assert.match(screen, /alsoRetailListingId: undefined/);
  assert.match(screen, /const res = await alsoListRetail\(alsoRetailAuction\.listingId, price, retailTier\)/);
  assert.match(screen, /type: 'LISTING_FEE'/);
  assert.match(screen, /Create & Pay/);
});

test('valuation price rule: low market guide is Auction, Retail is exactly 20% higher', () => {
  const valuationSource = readFileSync(new URL('../src/lib/valuationApi.ts', import.meta.url), 'utf8');
  const helper = valuationSource.split('export function alignVehicleValuationPrices(')[1]
    ?.split('export function applyVehicleValuationAdjustments(')[0];
  assert.ok(helper, 'shared client pricing helper must exist');
  const program = ts.transpileModule('export function alignVehicleValuationPrices(' + helper, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(program.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const out = {};
  runInNewContext(program.outputText, { exports: out, roundMoney: (v) => Math.round(v / 50) * 50 });
  const quote = {
    low: 10000, mid: 11000, high: 12000, source: 'CARMAZIUM_MARKET',
    retail: { suggestedAsking: 10000, suggestedMinimum: 9500 },
    auction: { marketValue: 8000, openingBid: 5600, reserveLow: 7200, reserveHigh: 8000, suggestedReserve: 7600 },
  };
  const priced = out.alignVehicleValuationPrices(quote);
  assert.equal(priced.auction.marketValue, 10000);
  assert.equal(priced.retail.suggestedAsking, 12000);
  assert.equal(priced.auction.openingBid, 7000);
  assert.equal(priced.low, 10000);
  assert.equal(priced.mid, 11000);
  assert.equal(priced.high, 12000);
  assert.equal(quote.auction.marketValue, 8000, 'must not mutate stored quotes');
  assert.equal(quote.retail.suggestedAsking, 10000);
  const adjustmentSection = valuationSource.split('export function applyVehicleValuationAdjustments(')[1]?.split('export async function getVehicleValuation(')[0];
  assert.match(adjustmentSection, /return alignVehicleValuationPrices\(base\)/);
  assert.match(adjustmentSection, /const low = roundMoney\(base\.low \* factor\)/);
});

test('native listing wizard navigates to the first missing field for both retail and auction', () => {
  const source = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /const rememberValidationSection = \(section: string\)/);
  assert.match(source, /const scrollToMissingField = \(field: string\)/);
  assert.match(source, /STEP1_FIELD_KEYS\.find\(k => fieldErrorRaw\(k\) != null\)/);
  assert.match(source, /STEP4_AUCTION_FIELD_KEYS\.find\(k => fieldErrorRaw\(k\) != null\)/);
  assert.match(source, /setValidationIssue\(\{ field, message:/);
  assert.match(source, /Tap to go to this field/);
  assert.match(source, /onLayout=\{rememberValidationSection\("registration"\)\}/);
  assert.match(source, /onLayout=\{rememberValidationSection\("declarations"\)\}/);
  assert.match(source, /onLayout=\{rememberValidationSection\("auction-pricing"\)\}/);
  assert.doesNotMatch(source, /stepScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: true \}\)/);
  assert.match(source, /setValidationIssue\(null\);\s+validationSectionYRef\.current = \{\};\s+const nextStep/);
})

test('native full-screen listing guide explains every step and incomplete fields', () => {
  const source = readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /const stepGuidance = step === 1/);
  assert.match(source, /const nativeFieldReasons: Record<string, string>/);
  assert.match(source, /function renderStepGuidance\(\)/);
  assert.match(source, /What to do: \{stepGuidance\.what\}/);
  assert.match(source, /Why we ask: \{stepGuidance\.why\}/);
  assert.match(source, /nativeFieldReasons\[validationIssue\.field\]/);
  assert.equal((source.match(/\{renderStepGuidance\(\)\}/g) || []).length, 5);
});
