import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const app = 'carmazium app/carmazium app/src';
const source = (file) => readFileSync(resolve(root, app, file), 'utf8');

test('native sell valuation offers distinct auction and retail prices with explicit route choice', () => {
  const landing = source('screens/sell/SellLandingScreen.tsx');
  const wizard = source('screens/sell/SellCarFlowScreen.tsx');
  assert.match(landing, /valuation\.auction\.marketValue/);
  assert.match(landing, /valuation\.retail\.suggestedAsking/);
  assert.match(landing, /startListing\('AUCTION'\)/);
  assert.match(landing, /startListing\('CLASSIFIED'\)/);
  assert.match(landing, /Number\.isFinite\(answer\.retail\.suggestedAsking\)/);
  assert.match(wizard, /listingType === 'AUCTION'\s*\? valuation\.auction\.marketValue : valuation\.retail\.suggestedAsking/);
});

test('DVLA and MOT records survive landing-to-wizard and wizard-to-listing', () => {
  const landing = source('screens/sell/SellLandingScreen.tsx');
  const wizard = source('screens/sell/SellCarFlowScreen.tsx');
  const navigator = source('navigation/MainStackNavigator.tsx');
  for (const field of ['firstUsedDate', 'dateOfLastV5CIssued', 'motHistory', 'taxDueDate', 'motExpiryDate', 'wheelplan', 'typeApproval']) {
    assert.ok(landing.includes(field), 'landing missing ' + field);
    assert.ok(wizard.includes(field), 'wizard missing ' + field);
    assert.ok(navigator.includes(field), 'navigation prefill missing ' + field);
  }
  assert.match(wizard, /motHistory:\s*motHistory\.length\s*\?\s*motHistory\s*:\s*undefined/);
  assert.match(wizard, /setFirstRegistered\(''\);\s*setFirstUsedDate\(''\);\s*setLastV5C\(''\)/);
  assert.match(wizard, /setMotHistory\(\[\]\)/);
  assert.match(wizard, /mileage:\s*mileage\s*\?\s*parseInt/);
});

test('public 3D only shows seller-marked zones and projects late arriving damage', () => {
  const viewer = source('components/damage/ThreeDVehicleViewer.tsx');
  const buyer = source('components/damage/BuyerDamageViewer.tsx');
  assert.match(viewer, /!readOnly\s*\|\|\s*markedZones\.includes\(z\.label\)/);
  assert.match(viewer, /const projectedZoneKey = hotspotZones\.map/);
  assert.match(viewer, /webViewRef\.current\.injectJavaScript\(/);
  assert.match(viewer, /\[viewerHtml, projectedZoneKey\]/);
  assert.match(viewer, /vehicle\.glb/);
  assert.match(buyer, /markedZones=\{markedZoneLabels\}/);
  assert.match(buyer, /readOnly/);
  assert.match(buyer, /not an independent inspection/);
});

test('both retail and auction buyer pages expose complete saved government MOT facts', () => {
  const retail = source('screens/vehicle/VehicleDetailScreen.tsx');
  const auction = source('screens/vehicle/AuctionDetailScreen.tsx');
  const facts = source('components/BuyerVehicleFacts.tsx');
  const listings = source('lib/listingsApi.ts');
  assert.match(retail, /getRawListingById\(listing\.id\)/);
  assert.match(retail, /setVehicleFactsState\(record \? 'loaded' : 'failed'\)/);
  assert.match(retail, /Retry full vehicle details/);
  assert.match(retail, /setVehicleFactsAttempt\(previous => previous \+ 1\)/);
  assert.match(retail, /<BuyerVehicleFacts record=\{fullVehicleFacts \?\? listing\}/);
  assert.match(auction, /<BuyerVehicleFacts record=\{auction\?\.listing \?\? listing\}/);
  for (const field of ['motHistory', 'firstUsedDate', 'dateOfLastV5CIssued', 'markedForExport', 'numberOfKeys', 'driveType']) {
    assert.ok(listings.includes(field), 'API mapping missing ' + field);
    assert.ok(facts.includes(field), 'buyer facts missing ' + field);
  }
  assert.match(facts, /Show all/);
  assert.match(facts, /odometerUnit/);
  assert.match(facts, /not a live DVLA update or an independent vehicle history report/);
});

test('seller pricing and minimum-photo safeguards remain intact', () => {
  const wizard = source('screens/sell/SellCarFlowScreen.tsx');
  assert.match(wizard, /const MIN_PHOTOS = 10;/);
  assert.match(wizard, /id: 'FREE' as const, label: 'Auction', price: 'Free'/);
  assert.match(wizard, /id: 'BASIC' as const, label: 'Basic', price: '£1'/);
});

test('native retail payment must be verified by the backend before claiming submission', () => {
  const wizard = source('screens/sell/SellCarFlowScreen.tsx');
  const listings = source('screens/seller/SellerListingsScreen.tsx');

  // A successful Stripe UI return does not prove /publish reached PENDING_REVIEW.
  assert.match(wizard, /if \(!second\?\.data\?\.pendingReview && !second\?\.data\?\.activated\)/);
  assert.match(wizard, /if \(first\?\.data\?\.paymentConfirmationPending\)/);
  assert.match(wizard, /Payment confirmation pending/);
  // Returning to a draft must not open another PaymentSheet when prior payment is uncertain.
  assert.match(listings, /if \(first\?\.data\?\.paymentConfirmationPending\)/);
  assert.match(listings, /do not pay again/);
});
