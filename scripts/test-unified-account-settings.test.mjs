#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');

test('website account settings has one navigable hub with role-specific editable sections', () => {
  const s = read('src/app/profile/page.tsx');
  for (const section of ['personal','business','verification','notifications','payouts','appearance','security','reviews','account']) {
    assert.match(s, new RegExp('key: "'+section+'"'), 'Missing '+section+' navigation');
  }
  assert.match(s, /Account Settings/);
  assert.match(s, /aria-label="Account settings sections"/);
  assert.match(s, /Business verification/);
  assert.match(s, /KycOverlayForm/);
  assert.match(s, /saveNotifications/);
  assert.match(s, /notifyOnSale, showPublicProfile/);
  assert.match(s, /notificationsReady/);
  assert.match(s, /await updateBankDetails/);
  assert.match(s, /startStripeConnectOnboarding/);
  assert.match(s, /resetPassword\(oldPassword, newPassword\)/);
  assert.match(s, /DeleteAccountSection/);
});

test('previous role settings URLs point to the same central destination', () => {
  for (const [role,section] of [['dealer','business'],['buyer','personal'],['seller','payouts'],['service','personal']]) {
    const s = read('src/app/dashboard/'+role+'/settings/page.tsx');
    assert.match(s, new RegExp('redirect\\("/profile\\?section='+section+'"\\)'));
    assert.doesNotMatch(s, /defaultChecked/);
  }
});

test('header, dashboard and dealer menus point to canonical Account Settings', () => {
  const header = read('src/components/layout/Header.tsx');
  const sidebar = read('src/components/dashboard/DashboardSidebar.tsx');
  const dealer = read('src/config/dealerRouteConfig.ts');
  const dashboard = read('src/app/dashboard/user/page.tsx');
  const drawer = read('carmazium app/carmazium app/src/components/GlobalDrawer.tsx');
  assert.match(header, /Account Settings/);
  assert.match(sidebar, /href: "\/profile", label: "Account Settings"/);
  assert.match(dealer, /href: "\/profile\?section=business"/);
  assert.match(dashboard, /activeTab === "settings"/);
  assert.match(dashboard, /router.replace\(\`\/profile\?section=/);
  assert.match(drawer, /label: 'Account settings'/);
  assert.doesNotMatch(drawer, /id: 'notification-settings', label: 'Notification settings'/);
});

test('unsupported notification toggles cannot silently pretend to be saved', () => {
  const s = read('src/app/profile/page.tsx');
  assert.match(s, /typeof data.notifyOnSale === "boolean"/);
  assert.match(s, /typeof data.showPublicProfile === "boolean"/);
  assert.match(s, /if \(!notificationsReady\) return/);
  assert.match(s, /method: "PATCH"/);
  assert.doesNotMatch(s, /defaultChecked/);
});
