#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const brand = read('carmazium app/carmazium app/src/components/BrandIcon.tsx');
const topbar = read('carmazium app/carmazium app/src/components/WebsiteTopBar.tsx');
const hamburger = read('carmazium app/carmazium app/src/components/HamburgerButton.tsx');
const drawer = read('carmazium app/carmazium app/src/components/GlobalDrawer.tsx');
const settings = read('carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx');

test('top right menu and More tab must show a real menu icon, not an unrelated question mark', () => {
  assert.match(brand, /'menu': 'Menu'/);
  assert.match(brand, /'menu-outline': 'Menu'/);
  assert.match(hamburger, /name=\{isOpen \? 'close' : 'menu'\}/);
  assert.match(topbar, /<HamburgerButton websiteStyle \/>/);
  assert.match(hamburger, /accessibilityLabel=\{websiteStyle && isOpen \? "Close navigation menu" : "Open navigation menu"\}/);
});

test('dealer More menu is a genuine full-window modal and does not leave its content below viewport', () => {
  assert.match(drawer, /return dealerMode \? \(\s*\/\/[\s\S]*?<Modal\s+visible=\{isOpen\}/);
  assert.match(drawer, /animationType="slide"/);
  assert.match(drawer, /onRequestClose=\{closeDrawer\}/);
  assert.match(drawer, /<View style=\{styles\.dealerOverlay\}>\{drawerContent\}<\/View>/);
  assert.match(drawer, /dealerOverlay: \{\s*flex: 1,/);
  assert.match(drawer, /!dealerMode && panelStyle/);
  assert.match(drawer, /height: sheetHeight, bottom: Math\.max\(insets\.bottom, 8\)/);
  assert.doesNotMatch(drawer, /translateY: translateY\.value/);
});

test('noninteractive drag handle is removed; drawer has a labelled close action and navigation content', () => {
  assert.doesNotMatch(drawer, /sheetHandle|<View style=\{styles\.handle\}/);
  assert.match(drawer, /<Text style=\{styles\.dealerMenuHeading\} accessibilityRole="header">Navigation menu<\/Text>/);
  assert.match(drawer, /onPress=\{closeDrawer\} accessibilityLabel="Close"/);
  assert.match(drawer, /<ScrollView/);
  assert.match(drawer, /visiblePrimaryDealerItems/);
  assert.match(drawer, /navigation\.navigate\('Main'/);
});

test('consumer menu behaviour, account shortcut and actual native appearance limitations are not faked', () => {
  assert.match(drawer, /<Modal\s+visible=\{isOpen\}\s+transparent\s+animationType="none"/);
  assert.match(topbar, /navigation\.navigate\('Settings'\)/);
  assert.match(settings, /Dark appearance/);
  assert.match(settings, /live light\/dark switch is not yet supported/);
});
