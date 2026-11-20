import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const native = new URL('carmazium app/carmazium app/src/', root);
const code = ts.transpileModule(readFileSync(new URL('lib/dashboardNavigation.ts', native), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const menu = {}; runInNewContext(code, { exports: menu });
const destinations = {
  'sell-car': '/sell', 'browse-cars': '/search', 'add-vehicle': '/dashboard/dealer/add-listing',
  'user-enquiries': '/dashboard/enquiries', 'user-cars': '/dashboard/user?tab=cars',
  'user-incoming-offers': '/dashboard/user?tab=offers', 'user-earnings': '/dashboard/user?tab=earnings',
  'user-performance': '/dashboard/user?tab=stats', 'user-sent-offers': '/dashboard/user?tab=bids',
  'user-watchlist': '/dashboard/user?tab=watchlist', 'user-purchases': '/dashboard/user?tab=purchases',
  'user-service-jobs': '/services/jobs', 'user-warranties': '/dashboard/warranties',
  'user-cancellations': '/dashboard/cancellations', 'user-messages': '/dashboard/user?tab=messages', 'user-settings': '/profile',
  'dealer-enquiries': '/dashboard/enquiries', 'dealer-stock': '/dashboard/dealer/inventory',
  'dealer-customers': '/dashboard/dealer/crm', 'dealer-auctions': '/dashboard/dealer/auctions',
  'dealer-offers': '/dashboard/dealer/offers', 'dealer-live': '/auctions/browse', 'dealer-wishlist': '/dashboard/dealer/wishlist',
  'dealer-bids': '/dashboard/dealer/bids', 'dealer-offers-only': '/dashboard/dealer/my-offers',
  'dealer-purchases': '/dashboard/dealer/purchases', 'dealer-messages': '/dashboard/dealer/messages',
  'dealer-team': '/dashboard/dealer/team', 'dealer-settings': '/profile?section=business',
  'dealer-finance': '/dashboard/dealer/finance', 'dealer-analytics': '/dashboard/dealer/analytics',
  'dealer-earnings': '/dashboard/dealer/earnings', 'dealer-partner': '/dashboard/partner',
  'dealer-warranties': '/dashboard/warranties', 'dealer-service-addons': '/dashboard/service/capabilities',
  'dealer-service-jobs': '/dashboard/service/jobs',
};
const extra = {
  personal: [
    { id: 'sell-car', label: 'Sell a Car', section: 'Selling', icon: 'add-circle-outline', iconLib: 'ion', stackScreen: 'SellLanding' },
    { id: 'browse-cars', label: 'Buy Cars', section: 'Buying', icon: 'search-outline', iconLib: 'ion', tabName: 'Search' },
  ],
  dealer: [{ id: 'add-vehicle', label: 'Add Vehicle', section: 'Sell', icon: 'add-circle-outline', iconLib: 'ion', stackScreen: 'SellCarFlow', requiredPermission: 'MANAGE_INVENTORY' }],
};
const catalog = Object.fromEntries(Object.entries({ personal: menu.USER_ITEMS, dealer: menu.DEALER_ITEMS }).map(([mode, items]) => [mode,
  [...extra[mode], ...items.filter(item => !['user-dashboard', 'dealer-home'].includes(item.id))].map(item => {
    if (!destinations[item.id]) throw Error(`Missing website destination for ${item.id}`);
    return { ...item, href: destinations[item.id] };
  }),
]));
const output = JSON.stringify(catalog, null, 2) + '\n';
const target = new URL('src/data/dashboardCards.json', root);
const nativeTarget = new URL('data/dashboardCards.json', native);
const prefs = readFileSync(new URL('lib/dashboardPreferences.ts', native), 'utf8');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output || readFileSync(nativeTarget, 'utf8') !== output || readFileSync(new URL('src/lib/dashboardPreferences.ts', root), 'utf8') !== prefs) throw Error('Dashboard parity snapshots differ. Run node scripts/sync-dashboard-cards.mjs');
} else {
  writeFileSync(target, output);
  writeFileSync(nativeTarget, output);
  writeFileSync(new URL('src/lib/dashboardPreferences.ts', root), prefs);
}
console.log('Website and native dashboard card catalog match.');
