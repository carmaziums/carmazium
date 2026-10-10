#!/usr/bin/env node
// Issue #477 Block 2 — static regression tests for shared shell fixes.
// These check route/permission preservation; a green test is NOT screenshot parity.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const app = path => readFileSync(resolve(root, 'carmazium app/carmazium app/src/' + path), 'utf8');
const web = path => readFileSync(resolve(root, path), 'utf8');
const tabs = app('navigation/TabNavigator.tsx');
const drawer = app('components/GlobalDrawer.tsx');
const top = app('components/WebsiteTopBar.tsx');
const hamburger = app('components/HamburgerButton.tsx');
const logo = app('components/Logo.tsx');

test('actual website dealer bottom More panel is matched by native dealer mode only', () => {
  const sidebar = web('src/components/dashboard/DashboardSidebar.tsx');
  assert.ok(sidebar.includes("fixed bottom-[72px] left-0 right-0"));
  assert.ok(sidebar.includes("rounded-t-2xl"));
  assert.ok(drawer.includes('dealerMode ? styles.dealerBottomSheet : styles.sidePanel'));
  assert.ok(drawer.includes("width: '100%'"));
  assert.ok(drawer.includes('borderTopLeftRadius: 20'));
  assert.ok(drawer.includes('translateY: translateY.value'));
  assert.ok(drawer.includes('translateX: translateX.value'));
  assert.ok(drawer.includes('onRequestClose={closeDrawer}'));
  assert.ok(drawer.includes('<TouchableWithoutFeedback onPress={closeDrawer}>'));
  assert.ok(drawer.includes('height: sheetHeight'));
  assert.ok(drawer.includes('dealerTabBarHeight = getBottomTabBarHeight(fontScale, insets.bottom)'));
  assert.ok(drawer.includes('bottom: dealerTabBarHeight'));
  assert.ok(drawer.includes("pointerEvents={isOpen ? 'box-none' : 'none'}"));
  assert.ok(drawer.includes("BackHandler.addEventListener('hardwareBackPress'"));
});

test('More is a real toggle with active/expanded state, but not an extra route', () => {
  assert.ok(tabs.includes("if (isDrawerOpen) closeDrawer();"));
  assert.ok(tabs.includes('else openDrawer();'));
  assert.ok(tabs.includes("const isFocused = isMore ? isDrawerOpen : state.routes[state.index]?.name === route.name;"));
  assert.ok(tabs.includes('expanded: isDrawerOpen'));
  assert.ok(tabs.includes("isMore && isDrawerOpen ? 'close'"));
  assert.ok(tabs.includes('<Tab.Screen name="DealerMore" component={ProfileTabScreen} />'));
  assert.ok(drawer.includes('visiblePrimaryDealerItems'));
  assert.ok(drawer.includes("!['dealer-inventory', 'dealer-leads'].includes(item.id)"));
});

test('website-styled header uses the real asset, adapts logo to viewport and toggles menu', () => {
  const header = web('src/components/layout/Header.tsx');
  assert.ok(header.includes('width={160}'));
  assert.ok(top.includes('useWindowDimensions()'));
  assert.ok(top.includes('Math.min(160, Math.max(110, windowWidth - 202))'));
  assert.ok(top.includes('<Logo size="sm" width={logoWidth} />'));
  assert.ok(logo.includes("const LOGO_SOURCE = require('../../assets/images/logo.png')"));
  assert.ok(logo.includes("const width = overrideWidth ??"));
  assert.ok(hamburger.includes("name={isOpen ? 'close' : 'menu'}"));
  assert.ok(hamburger.includes("style={[styles.btn, websiteStyle && styles.websiteButton]}"));
  assert.ok(hamburger.includes('websiteStyle && isOpen ? closeDrawer : openDrawer'));
  assert.ok(hamburger.includes('accessibilityState={websiteStyle ? { expanded: isOpen } : undefined}'));
  assert.ok(top.includes('<HamburgerButton websiteStyle />'));
  assert.ok(top.includes("navigation.navigate('Settings')"));
  assert.ok(top.includes("navigation.navigate('Notifications')"));
});

test('dealer route remains named and gated, including Block 6 website-canonical hub', () => {
  for (const [route,screen] of [
    ['DealerHome','DealerProfileScreen'],
    ['DealerStock','GatedDealerStockTab'],
    ['DealerCustomers','GatedDealerCustomersTab'],
    ['DealerBuyBid','GatedDealerBuyBidTab'],
  ]) assert.ok(tabs.includes('name="' + route + '" component={' + screen + '}'));
  for (const gate of ["hasPermission('VIEW_INVENTORY')", "hasPermission('MANAGE_CRM')", "hasPermission('VIEW_TRADE')"]) {
    assert.ok(tabs.includes(gate));
  }
  for (const route of ['Home','Search','Live','Saved','Profile']) {
    assert.ok(tabs.includes('<Tab.Screen name="' + route + '"'));
  }
  assert.ok(drawer.includes("setRole('buyer')") && drawer.includes("setRole('dealer')"));
  assert.ok(drawer.includes("navigation.navigate('Main'"));
  assert.ok(!drawer.includes("const isActualDealer = role === 'dealer'"));
});

test('explicitly record no authenticated or iOS screenshot acceptance', () => {
  const doc = web('docs/native/website-native-visual-parity-block2-20261010.md');
  for (const phrase of ['VISUAL SIGN-OFF: PENDING','PR #476','PR #478','360×800','390×844','synthetic','revert']) {
    assert.ok(doc.includes(phrase), phrase);
  }
});
