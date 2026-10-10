#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = p => readFileSync(resolve(root,p),'utf8');
const app = p => read('carmazium app/carmazium app/src/'+p);
const web = read('src/components/dashboard/DashboardSidebar.tsx');
const tabs = app('navigation/TabNavigator.tsx');
const drawer = app('components/GlobalDrawer.tsx');
const bar = app('components/WebsiteTopBar.tsx');

test('web dealer bottom navigation and native route labels have the same information architecture', () => {
  for (const segment of [
    '/dashboard/dealer',
    '/dashboard/dealer/inventory',
    '/dashboard/dealer/crm',
    '/dashboard/dealer/auctions',
  ]) assert.ok(web.includes(segment), segment);
  for (const [route,label] of [
    ['DealerHome','Home'],
    ['DealerStock','Stock'],
    ['DealerCustomers','Customers'],
    ['DealerBuyBid','Buy & Bid'],
    ['DealerMore','More'],
  ]) {
    assert.ok(tabs.includes("name: '"+route+"'"),route);
    assert.ok(tabs.includes("label: '"+label+"'"),label);
    assert.ok(tabs.includes('<Tab.Screen name="'+route+'"'),route);
    assert.ok(drawer.includes("tabName: '"+route+"'") || route === 'DealerMore', route);
  }
  assert.ok(tabs.includes("initialRouteName={dealerMode ? 'DealerHome' : 'Home'}"));
  assert.ok(tabs.includes("openDrawer();"));
  assert.ok(drawer.includes("dealerMode ? 'DEALER WORKSPACE' : 'BUY, SELL & EXPLORE'"));
});

test('role switching and permissions retain secured routes and consumer deep links', () => {
  assert.ok(tabs.includes("role === 'dealer' && accountRole === 'dealer'"));
  assert.ok(tabs.includes("key={dealerMode ? 'dealer-workspace' : 'marketplace-workspace'}"));
  for (const gate of ["hasPermission('VIEW_INVENTORY')","hasPermission('MANAGE_CRM')","hasPermission('VIEW_TRADE')"]) assert.ok(tabs.includes(gate),gate);
  for (const route of ['Home','Search','Live','Saved','Profile']) {
    assert.ok(tabs.includes('<Tab.Screen name="'+route+'"'));
  }
  assert.ok(drawer.includes('visiblePrimaryDealerItems'));
  assert.ok(drawer.includes('hasDealerPermission(item.requiredPermission)'));
});

test('native shared header follows actual website logo, notification, account and More hierarchy', () => {
  const head = read('src/components/layout/Header.tsx');
  assert.ok(head.includes('isMobileMenuOpen'));
  assert.ok(bar.includes('<Logo size="sm" />'));
  assert.ok(bar.includes("navigation.navigate('Notifications')"));
  assert.ok(bar.includes("navigation.navigate('Settings')"));
  assert.ok(bar.includes('<HamburgerButton />'));
  assert.ok(bar.includes("backgroundColor: '#1E293B'"));
  assert.ok(!bar.includes("setRole("));
  for (const screen of [
    'DealerProfileScreen.tsx',
    'DealerInventoryScreen.tsx',
    'DealerLeadsScreen.tsx',
  ]) assert.ok(app('screens/main/'+screen).includes('<WebsiteTopBar />'),screen);
  assert.ok(app('screens/main/LiveScreen.tsx').includes('{dealerMode && <WebsiteTopBar />}'));
});

test('website and native match dark navy body + red brand, with a full width bottom bar', () => {
  const css = read('src/app/globals.css');
  const colors = app('constants/colors.ts');
  assert.ok(css.includes('--bg-body: #1b2538'));
  assert.ok(css.includes('--bg-dropdown: #243047'));
  assert.ok(colors.includes("const bgBody = '#1B2538';"));
  assert.ok(colors.includes("const accent = '#ED1C24';"));
  assert.ok(tabs.includes("backgroundColor: '#243047'"));
  assert.ok(tabs.includes("left: 0,"));
  assert.ok(tabs.includes("right: 0,"));
  assert.ok(tabs.includes("paddingBottom: insets.bottom"));
  assert.ok(!tabs.includes('...Elevation.float'));
});

test('buyer home uses the current website sale-first proposition and brand header', () => {
  const home = app('screens/main/HomeScreen.tsx');
  const webHero = read('src/app/HomeClient.tsx');
  assert.ok(webHero.includes('Sell Your Car'));
  assert.ok(webHero.includes('Auction <span className="text-primary">FREE</span>'));
  assert.ok(home.includes('<WebsiteTopBar />'));
  assert.ok(home.includes('<Text style={s.greetingLine}>Sell your car</Text>'));
  assert.ok(home.includes('<Text style={s.greetingAccent}>your way.</Text>'));
  assert.ok(home.includes('Auction FREE · Retail £1'));
  assert.ok(home.includes('approved handover earns a £100 reward.'));
  assert.ok(home.includes("navigation.navigate('Tabs', { screen: 'Search' })"));
  assert.ok(home.includes("navigation.navigate('SellCarFlow')"));
  assert.ok(!home.includes('<Text style={s.greetingLine}>Find your next</Text>'));
});
