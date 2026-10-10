#!/usr/bin/env node
// Issue #477 Block 8 source-level parity. Green source tests are NOT pixel acceptance.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const app = path => read('carmazium app/carmazium app/src/' + path);
const web = read('src/app/profile/page.tsx');
const settings = app('screens/main/SettingsScreen.tsx');
const nav = app('navigation/MainStackNavigator.tsx');
const saved = app('screens/main/SavedScreen.tsx');
const messages = app('screens/main/MessagesScreen.tsx');
const notifications = app('screens/main/NotificationsScreen.tsx');
const topBar = app('components/WebsiteTopBar.tsx');
const drawer = app('components/GlobalDrawer.tsx');
const docs = read('docs/native/website-native-visual-parity-block8-20261010.md');

test('Account Settings is website-canonical and has actual nine sections including gated business', () => {
  assert.ok(web.includes('Account Settings'));
  assert.ok(settings.includes('Account Settings'));
  assert.ok(settings.includes('One place for your profile, business, notifications, payouts and security.'));
  const names = ['Personal details', 'Business profile', 'Verification',
    'Notifications & privacy', 'Payouts', 'Appearance', 'Security',
    'Ratings & reviews', 'Account type'];
  for (const name of names) {
    assert.ok(web.includes(name), 'website '+name);
    assert.ok(settings.includes(name), 'native '+name);
  }
  assert.ok(settings.includes('canManageBusiness ? ['));
  assert.ok(settings.includes("section !== 'business' || canManageBusiness"));
  assert.ok(settings.includes('accessibilityRole="tab"'));
  assert.ok(settings.includes('accessibilityState={{ selected }}'));
  assert.ok(settings.includes('<WebsiteTopBar />'));
  assert.ok(!settings.includes('<HamburgerButton />'), 'avoid second hamburger on Account Settings');
  assert.ok(nav.includes('name="Settings"'));
});

test('one hub opens existing Saved, Messages, Notifications, and REAL Support thread', () => {
  for (const name of ['YOUR ACCOUNT TOOLS','Saved Cars','Messages','Notifications','Contact Support']) {
    assert.ok(settings.includes(name), name);
  }
  assert.ok(settings.includes("navigation.navigate('Tabs', { screen: 'Saved' })"));
  assert.ok(settings.includes("navigation.navigate('Messages')"));
  assert.ok(settings.includes("navigation.navigate('Notifications')"));
  assert.ok(settings.includes('getOrCreateSupportRoom()'));
  assert.ok(settings.includes("navigation.navigate('ChatScreen', { threadId: room.id })"));
  assert.ok(drawer.includes('getOrCreateSupportRoom()'), 'reuses drawer backend');
  assert.ok(nav.includes('ChatScreen: { threadId: string }'));
});

test('website reputation endpoints used for genuine received/given reviews and uncertainty', () => {
  for (const endpoint of ['/profiles/${user.id}', '/profiles/${user.id}/reviews?limit=20',
    '/profiles/me/reviews/given?limit=20']) {
    assert.ok(settings.includes(endpoint), endpoint);
  }
  assert.ok(web.includes('Reviews received'));
  assert.ok(web.includes('Reviews given'));
  assert.ok(settings.includes('Reviews received'));
  assert.ok(settings.includes('Reviews given'));
  assert.ok(settings.includes('ratingError'));
  assert.ok(settings.includes('ratingLoading'));
  assert.ok(settings.includes('ratingSummary.count.toLocaleString'));
  assert.ok(!settings.includes('5.0 based on 100'), 'do not fabricate reviews');
});

test('account type is non-mutating and appearance reports fixed native theme truthfully', () => {
  assert.ok(settings.includes('Explore Partner Account'));
  assert.ok(settings.includes("navigation.navigate('PartnerDashboard')"));
  assert.ok(settings.includes('Changing your dashboard view does not change your verified account permissions.'));
  assert.ok(settings.includes("selectCategory('verification')"));
  assert.ok(settings.includes('live light/dark switch is not yet supported'));
  assert.ok(!settings.includes('setDarkMode('), 'never give a fake toggle');
  assert.ok(settings.includes("'/users/me'"));
  assert.ok(settings.includes('handleDeleteAccount'));
  assert.ok(settings.includes('handleSavePreferences'));
  assert.ok(settings.includes('handleSaveDealerProfile'));
});

test('Saved/Messages/Notifications share website header but keep existing real cross-client APIs', () => {
  for (const file of [saved, messages, notifications]) {
    assert.ok(file.includes('<WebsiteTopBar />'), 'shared global header');
  }
  assert.ok(topBar.includes("navigation.navigate('Settings')"));
  assert.ok(saved.includes('hydrateFromApi()'));
  assert.ok(saved.includes('getSavedAuctionIdForListing'));
  assert.ok(saved.includes("navigation.navigate('AuctionDeepLink'"));
  assert.ok(messages.includes('refreshRooms()'));
  assert.ok(messages.includes('markAsRead(roomId)'));
  assert.ok(messages.includes("navigation.navigate('ChatScreen'"));
  assert.ok(!messages.includes('autoFocus'), 'do not open keyboard without a user tap');
  assert.ok(notifications.includes('getNotifications('));
  assert.ok(notifications.includes('markNotificationRead('));
  assert.ok(notifications.includes('resolveMobileNotificationTarget'));
  assert.ok(notifications.includes('handleMarkAll'));
});

test('documented acceptance gaps, never falsely claim MaziuM or theme parity', () => {
  for (const x of ['PR #476','PR #478','PR #479','PR #480','PR #481','PR #482',
    'PR #483','PR #484','MaziuM','Appearance','VISUAL SIGN-OFF PENDING',
    '360×800','390×844','STOP at 80%','Revert only','synthetic']) {
    assert.ok(docs.includes(x), x);
  }
});
