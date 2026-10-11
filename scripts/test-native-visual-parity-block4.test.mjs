#!/usr/bin/env node
// Issue #477 Block 4 source regression. Native/web authenticated screenshot sign-off is separate.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = file => readFileSync(resolve(root, file), 'utf8');
const web = read('src/app/dashboard/dealer/inventory/page.tsx');
const native = read('carmazium app/carmazium app/src/screens/main/DealerInventoryScreen.tsx');
const gearbox = read('carmazium app/carmazium app/src/lib/transmission.ts');
const routes = read('carmazium app/carmazium app/src/navigation/TabNavigator.tsx');
const stack = read('carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx');
const doc = read('docs/native/website-native-visual-parity-block4-20261010.md');

test('website Stock identity, main actions and search match without a fixed footer overlay', () => {
  assert.ok(web.includes('DEALER_ROUTE_CONFIG[1].title'));
  assert.ok(web.includes('Search by make, model, VRM...'));
  assert.ok(native.includes('>Inventory</Text>'));
  assert.ok(native.includes('Manage live, draft and sold stock'));
  assert.ok(native.includes('Search by make, model, VRM...'));
  for (const action of ['Add Vehicle', 'Import Listing', 'Bulk Import']) {
    assert.ok(native.includes(action), action);
    assert.ok(web.includes(action), action);
  }
  assert.ok(native.includes('{canManageInventory && ('));
  assert.ok(native.includes('style={themed.stockHeaderActions}'), 'website inventory header layout remains, now theme-aware');
  assert.ok(!native.includes('style={[styles.addListingWrap') && !native.includes('style={[themed.addListingWrap'), 'no fixed Add Listing footer');
  assert.ok(native.includes('onPress={toggleViewMode}'), 'preserve list/grid preference');
});

test('six canonical website statuses are first and optional lifecycle statuses are retained', () => {
  for (const backend of ['"ALL"', '"ACTIVE"', '"PENDING_REVIEW"', '"REJECTED"', '"DRAFT"', '"SOLD"']) {
    assert.ok(web.includes(backend), 'web status ' + backend);
  }
  for (const entry of [
    "label: 'All', value: null",
    "label: 'Live', value: 'LIVE'",
    "label: 'Under Review', value: 'REVIEW'",
    "label: 'Rejected', value: 'REJECTED'",
    "label: 'Draft', value: 'DRAFT'",
    "label: 'Sold', value: 'SOLD'",
    "label: 'Sale pending', value: 'SALE_PENDING'",
    "label: 'Other', value: 'OTHER'",
  ]) assert.ok(native.includes(entry), entry);
  assert.ok(native.includes("l.status === 'OFFER_ACCEPTED' ? 'SALE_PENDING'"), 'provisional sale cannot be SOLD');
  assert.ok(native.includes('showExtraStatuses'), 'optional statuses accessible');
  assert.ok(native.includes('accessibilityState={{ expanded: showExtraStatuses }}'));
  assert.ok(native.includes('listing.status === \'REJECTED\''));
});

test('both stock card modes use truthful API gearbox, mileage, VRM and photo fallbacks', () => {
  assert.ok(native.includes("import { formatTransmission } from '../../lib/transmission'"));
  assert.ok(native.includes('transmission: formatTransmission(l.transmission)'));
  assert.ok(native.includes('mileage: l.mileage != null'));
  assert.ok(gearbox.includes("default: return 'Not specified'"));
  assert.ok(gearbox.includes("case 'CVT'"));
  assert.ok(gearbox.includes("case 'SEMI_AUTO'"));
  assert.ok(native.includes('Transmission: {listing.transmission}'), 'list facts');
  assert.ok(native.includes('>{listing.transmission}</Text>'), 'grid facts');
  assert.ok(native.includes("listing.registration || 'PRIVATE'"));
  assert.ok(native.includes('listing.images[0] ? ('), 'both modes have photo fallback');
  assert.ok(native.includes('<Ionicons name="car-outline"'), 'missing photo is not stock filler');
  assert.ok(native.includes("title=\"No vehicles found\""));
});

test('web-style mobile KPI tiles show real price, status, views and HOT LEADS', () => {
  for (const tile of ['MARKET PRICE', 'STATUS', 'ENGAGEMENT', 'HOT LEADS']) {
    assert.ok(native.includes(tile), tile);
    assert.ok(web.includes(tile.replace('MARKET PRICE','Market Price').replace('HOT LEADS','Hot Leads').replace('ENGAGEMENT','Engagement').replace('STATUS','Status')), tile);
  }
  assert.ok(native.includes('listing.leads.toLocaleString'), 'real server count, not hardcoded web 0');
  assert.ok(native.includes('listing.views.toLocaleString'));
  assert.ok(native.includes('themed.websiteStockCard'), 'actual memoised inventory card is theme-aware');
  assert.ok(native.includes('themed.stockMetrics'), 'actual inventory KPI row retained in theme-aware card');
  assert.ok(native.includes('listing.rejectionReason'));
  assert.ok(!native.includes("label: 'Market Value Plus'"), 'do not pretend unverified valuations are a fact');
});

test('preserve dealer privileges, read-only paginated fetch and previous detail actions', () => {
  assert.ok(native.includes('fetchAllMyListings<any>()'));
  assert.ok(native.includes("hasPermission('MANAGE_INVENTORY')"));
  assert.ok(stack.includes("withDealerGate(DealerInventoryScreen, 'VIEW_INVENTORY')"));
  assert.ok(routes.includes('<Tab.Screen name="DealerStock" component={GatedDealerStockTab} />'));
  assert.ok(native.includes("navigation?.navigate('SellCarFlow')"));
  assert.ok(native.includes("navigation?.navigate('SellerAuctions'"));
  assert.ok(native.includes('handleConfirmMarkSold'));
  assert.ok(native.includes('BulkImportModal'));
  assert.ok(native.includes('ImportListingModal'));
  assert.ok(native.includes('onRefresh={() => fetchListings(true)}'));
  assert.ok(native.includes('ErrorBanner'));
});

test('no screenshot or device acceptance invented; isolated revert boundary documented', () => {
  for (const x of ['PR #476','PR #478','PR #479','PR #480','360×800','390×844',
    'VISUAL SIGN-OFF: PENDING','synthetic','Revert','STOP at 40%']) {
    assert.ok(doc.includes(x), x);
  }
});
