import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = new URL('../../../', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('src/data/dashboardCards.json', root), 'utf8'));
const nativeFile = readFileSync(new URL('../src/lib/dashboardNavigation.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(nativeFile, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText;
const exports = {};
runInNewContext(code, { exports });
const { DEALER_ITEMS, USER_ITEMS } = exports;
const manualPersonal = [
  { id: 'sell-car', label: 'Sell a Car', section: 'Selling', icon: 'add-circle-outline', iconLib: 'ion', stackScreen: 'SellLanding' },
  { id: 'browse-cars', label: 'Buy Cars', section: 'Buying', icon: 'search-outline', iconLib: 'ion', tabName: 'Search' },
];
const manualDealer = { id: 'add-vehicle', label: 'Add Vehicle', section: 'Sell', icon: 'add-circle-outline', iconLib: 'ion', stackScreen: 'DealerListingMethod', requiredPermission: 'MANAGE_INVENTORY' };
const personal = [...manualPersonal, ...USER_ITEMS.filter(row => row.id !== 'user-dashboard')];
const dealer = [manualDealer, ...DEALER_ITEMS.filter(row => row.id !== 'dealer-home')];
const common = row => [row.id, row.label, row.section, row.icon, row.iconLib, row.requiredPermission || null];

test('native personal dashboard uses website card IDs, labels, groups, icons, permissions and order', () => {
  assert.deepEqual(personal.map(common), catalog.personal.map(common), 'native personal dashboard diverged from src/data/dashboardCards.json');
});
test('native dealer dashboard uses website card IDs, labels, groups, icons, permissions and order', () => {
  assert.deepEqual(dealer.map(common), catalog.dealer.map(common), 'native dealer dashboard diverged from src/data/dashboardCards.json');
});
test('native card actions use native destinations for all website cards', () => {
  for (const [mode, cards] of Object.entries({ personal, dealer })) {
    assert.ok(cards.length > 0, mode);
    for (const card of cards) assert.ok(card.stackScreen || card.tabName, `${mode} ${card.id}: no native page`);
  }
});
