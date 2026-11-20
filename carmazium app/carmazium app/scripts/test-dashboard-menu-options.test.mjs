import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const sidebar = read('../../../src/components/dashboard/DashboardSidebar.tsx');
const config = read('../../../src/config/dealerRouteConfig.ts');
const drawer = read('../src/components/GlobalDrawer.tsx');
const admin = read('../src/screens/admin/AdminDashboardScreen.tsx');
const section = (source, start, end) => source.split(start)[1].split(end)[0];
const labels = source => new Set([...source.matchAll(/\blabel: ['"]([^'"]+)['"]/g)].map(m => m[1].toLowerCase()));
const menu = name => section(drawer, 'const ' + name + ': MenuItem[] = [', '\n];');

test('personal and provider menu labels cover their website sidebars', () => {
  assert.deepEqual(labels(menu('USER_ITEMS')), labels(section(sidebar, 'const unifiedLinks: LinkObj[] = [', '\n    ]')));
  assert.deepEqual(labels(menu('PROVIDER_ITEMS')), labels(section(sidebar, 'provider: [', 'finance: [')));
  assert.match(menu('PROVIDER_ITEMS'), /label: 'My Work'.*webPath: '\/dashboard\/service\/jobs\?tab=mine'/);
});

test('admin menu covers the website sidebar and dealer tools include CRM guest enquiries', () => {
  const website = labels(section(sidebar, 'admin: [', '\n        ],'));
  website.delete('overview'); // The screen itself.
  website.delete('online, app & reports');
  const native = labels(section(admin, 'const MENU:', 'export const AdminDashboardScreen'));
  native.delete('online now, app & problem reports');
  assert.deepEqual(native, website);
  const dealerLinks = labels(menu('DEALER_ITEMS'));
  for (const label of labels(section(config, 'const DEALER_ROUTE_CONFIG:', '\n]'))) {
    // Purchases exposes these destinations in its tabs and cancellation list.
    if (['retail purchases', 'purchase history', 'cancelled sales'].includes(label)) continue;
    assert.ok(dealerLinks.has(label), 'Missing dealer option: ' + label);
  }
  assert.match(menu('DEALER_ITEMS'), /label: 'Guest enquiries'.*requiredPermission: 'MANAGE_CRM'.*webPath: '\/dashboard\/enquiries'/);
});
