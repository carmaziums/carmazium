import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, root), 'utf8');

test('web TradeXchange replaces the legacy add-on grid with one inline services section', () => {
  const code = read('src/app/dashboard/partner/page.tsx');
  assert.equal((code.match(/id="provider-services"/g) ?? []).length, 1);
  assert.match(code, /aria-expanded=\{servicesExpanded\}/);
  assert.match(code, /label.*Offer collection, delivery and recovery/);
  assert.match(code, /Offer vehicle inspection/);
  assert.match(code, /\/users\/dealer-profile/);
  assert.match(code, /verificationStatus.*VERIFIED/);
  assert.match(code, /View existing work/);
  assert.doesNotMatch(code, /<AddonCard|function AddonCard|Your add-ons|DealerServicesNotice/);
});

test('native TradeXchange uses the same two service switches and preserves applications', () => {
  const code=read('carmazium app/carmazium app/src/screens/main/PartnerDashboardScreen.tsx');
  assert.match(code, /accessibilityLabel="My Services"/);
  assert.match(code, /updatePartnerServicePreference\(key, enabled\)/);
  assert.match(code, /Turning a service on does not approve it/);
  assert.match(code, /verificationStatus === 'VERIFIED'/);
  assert.match(code, /View existing work/);
  assert.doesNotMatch(code, /Your add-ons|My dealership services/);
});

test('dealer business settings can no longer overwrite TradeXchange delivery and inspection flags', () => {
  const web=read('src/components/dealer/DealerServicePreferences.tsx');
  const native=read('carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx');
  assert.match(web, /Listing badges/);
  assert.doesNotMatch(web, /deliveryServicesEnabled|inspectionServicesEnabled|Set up vehicle inspection|Complete service setup/);
  assert.doesNotMatch(native, /deliveryServicesEnabled:\s*deliveryEnabled|inspectionServicesEnabled:\s*inspectionEnabled/);
  assert.doesNotMatch(native, /setDeliveryEnabled|setInspectionEnabled/);
  assert.match(native, /Finance badge/);
  assert.match(native, /Warranty badge/);
});

test('service toggles keep backend approval gating and existing work available', () => {
  const backend=read('backend/src/services/dealer-service-eligibility.ts');
  assert.match(backend, /deliveryServicesEnabled/);
  assert.match(backend, /inspectionServicesEnabled/);
  assert.match(backend, /kyc\?\.status/);
  const web=read('src/app/dashboard/partner/page.tsx');
  assert.match(web, /Paused/);
  assert.match(web, /No new jobs while paused/);
  assert.match(web, /View existing work/);
});
