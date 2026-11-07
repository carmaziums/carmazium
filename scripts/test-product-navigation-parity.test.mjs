import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dealerMenuSectionOrders, dealerMenuSectionsMatch } from './lib/dealer-menu-parity.mjs';

const web = readFileSync(new URL('../src/config/dealerRouteConfig.ts', import.meta.url), 'utf8');
const native = readFileSync(new URL('../carmazium app/carmazium app/src/components/GlobalDrawer.tsx', import.meta.url), 'utf8');

test('all five actual menu groups match without counting nested settings parameters', () => {
  assert.deepEqual(dealerMenuSectionOrders(web, native), {
    web: ['Dashboard', 'Sell', 'Buy', 'Business', 'Services'],
    native: ['Dashboard', 'Sell', 'Buy', 'Business', 'Services'],
  });
  assert.equal(dealerMenuSectionsMatch(web, native), true);
  assert.equal(dealerMenuSectionsMatch(web, native.replace("stackParams: { section: 'business' }", "stackParams: { section: 'anything' }")), true);
});

test('missing, repeated, reordered and renamed top-level menu groups fail', () => {
  for (const changed of [
    native.replace("id: 'dealer-home', section: 'Dashboard'", "id: 'dealer-home', section: 'Buy'"),
    native.replace("id: 'dealer-team', section: 'Business'", "id: 'dealer-team', section: 'Sell'"),
    native.replaceAll("section: 'Services'", "section: 'Service'"),
    native.replace(/const DEALER_ITEMS[\s\S]*?^\];/m, 'const DEALER_ITEMS = [];'),
  ]) assert.equal(dealerMenuSectionsMatch(web, changed), false);
  assert.equal(dealerMenuSectionsMatch(web.replace('"Dashboard", "Sell", "Buy"', '"Dashboard", "Buy", "Sell"'), native), false);
});
