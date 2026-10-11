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
  assert.match(drawer, /label: 'Profile Settings'.*stackScreen: 'Settings'/);
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


test('native Sign Out is a contrasting, scrollable row with confirmation at every text size', () => {
  const settings = read('carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx');
  const palette = read('carmazium app/carmazium app/src/constants/colors.ts');
  const geometry = read('carmazium app/carmazium app/src/lib/nativeLayoutParity.ts');

  assert.match(settings, /const settingsBottomClearance = getBottomTabBarHeight\(fontScale, insets\.bottom\) \+ 128/);
  assert.match(settings, /contentContainerStyle=\{\[styles\.scrollContent, \{ paddingBottom: settingsBottomClearance \}\]\}/);
  assert.match(settings, /automaticallyAdjustKeyboardInsets/);
  assert.match(settings, /keyboardDismissMode="on-drag"/);
  assert.ok(geometry.includes('fontScale >= 1.6 ? 76'), '200% text scale receives taller bottom-bar clearance');
  assert.match(settings, /style=\{styles\.signOutRow\}/);
  assert.match(settings, /accessibilityLabel="Sign Out"/);
  assert.match(settings, /accessibilityHint="Opens a confirmation before signing out of CarMazium"/);
  assert.match(settings, /<Text style=\{styles\.signOutTitle\} maxFontSizeMultiplier=\{2\}>Sign Out<\/Text>/);
  assert.match(settings, /<Text style=\{styles\.signOutSubtitle\} maxFontSizeMultiplier=\{2\}>Sign out of this account<\/Text>/);
  assert.match(settings, /signOutRow: \{[\s\S]*?minHeight: 60,[\s\S]*?backgroundColor: Colors\.bgElevated,[\s\S]*?borderColor: Colors\.borderStrong/);
  assert.match(settings, /signOutTitle: \{[\s\S]*?color: Colors\.white, flexShrink: 1/);
  assert.match(settings, /signOutSubtitle: \{[\s\S]*?color: Colors\.textSecondary, flexShrink: 1/);
  assert.doesNotMatch(settings, /style=\{\[styles\.accountAction, \{ marginTop: 12 \}\]\}/);

  // Signing out remains a deliberate confirmed action, not an accidental tap.
  assert.match(settings, /const handleSignOut = \(\) => Alert\.alert\('Sign Out', 'Are you sure you want to sign out\?', \[/);
  assert.match(settings, /\{ text: 'Cancel', style: 'cancel' \}/);
  assert.match(settings, /\{ text: 'Sign Out', style: 'destructive', onPress: \(\) => \{ void logout\(\); \} \}/);
  assert.match(settings, /onPress=\{handleSignOut\}/);

  // WCAG contrast on the explicitly opaque sign-out surface: both the main
  // label and subtitle must exceed 4.5:1 even if system theme changes.
  const bg = palette.match(/const bgElevated = '(#[0-9A-Fa-f]{6})'/)?.[1];
  const fg = palette.match(/white: '(#[0-9A-Fa-f]{6})'/)?.[1];
  const subtitle = palette.match(/textSecondary: '(#[0-9A-Fa-f]{6})'/)?.[1];
  assert.ok(bg && fg && subtitle, 'sign-out palette tokens resolved');
  const luminance = hex => {
    const values = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255);
    return values.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  assert.ok(contrast(fg, bg) >= 4.5, 'Sign Out label must meet WCAG AA');
  assert.ok(contrast(subtitle, bg) >= 4.5, 'Sign Out subtitle must meet WCAG AA');
});


test('native Account Type has one clear dashboard, one optional view switch and owner-only business verification', () => {
  const settings = read('carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx');
  const start = settings.indexOf("{activeCategory === 'account' && (");
  const end = settings.indexOf("{/* Use a fully opaque, high-contrast surface", start);
  assert.ok(start >= 0 && end > start, 'Account Type section must be present');
  const account = settings.slice(start, end);

  // One role-aware dashboard destination, never three red dashboard blocks.
  assert.match(settings, /const partnerViewActive = isDealerAccount && role === 'dealer';/);
  assert.match(settings, /const openCurrentDashboard = \(\) => navigation\.navigate\('Tabs', \{/);
  assert.match(settings, /screen: partnerViewActive \? 'DealerHome' : 'Profile'/);
  assert.equal((account.match(/>Open Dashboard<\/Text>/g) || []).length, 1);
  assert.match(account, /onPress=\{openCurrentDashboard\}/);
  assert.match(account, /Current view: \{currentViewLabel\}/);
  assert.match(account, /accessibilityLabel=\{'Current view: ' \+ currentViewLabel\}/);
  assert.doesNotMatch(account, /Open User Dashboard|View Personal Dashboard|Switch to Dealer Dashboard|Explore Partner Account/);

  // Existing verified-account switching path remains, without allowing staff.
  assert.match(account, /\{!isDealerStaff && \(/);
  assert.match(account, /onPress=\{\(\) => \{ void handleSwitchDealerView\(\); \}\}/);
  assert.match(account, /partnerViewActive \? 'Switch to Personal View' : 'Switch to Partner View'/);
  assert.match(settings, /if \(switchingDealerView \|\| user\?\.isDealerStaff\) return;/);
  assert.match(settings, /await apiClient\('\/users\/elevate'/);
  assert.match(settings, /navigation\.navigate\('DealerOnboarding'\)/);

  // Owners see business KYC status and its existing Verification route,
  // staff only a read-only entry, personal accounts only personal checks.
  assert.match(account, /\{isDealerAccount \? \(\s*canManageBusiness \? \(/);
  assert.match(account, /<Text style=\{styles\.accountNavTitle\} maxFontSizeMultiplier=\{2\}>Business Verification<\/Text>/);
  assert.match(account, /Status: \{businessVerificationStatus\}/);
  assert.match(account, /onPress=\{\(\) => selectCategory\('verification'\)\}/);
  assert.match(account, /Managed by dealership owner/);
  assert.match(account, /<View style=\{styles\.accountNavRow\} accessible accessibilityLabel="Business Verification, managed by dealership owner">/);
  assert.match(account, /Personal Verification/);
  assert.match(settings, /const canManageBusiness = isDealerAccount && !isDealerStaff;/);
  assert.match(settings, /dealerKycStatus\s*\?\s*\(\{[\s\S]*?APPROVED: 'Approved'/);
  assert.match(account, /Business ownership, legal type and verification changes must be made by the dealership owner/);

  // Neutral compact navigational rows remain readable at large system text.
  assert.match(settings, /accountNavRow: \{\s*minHeight: 60/);
  assert.match(settings, /accountNavRowPrimary: \{\s*backgroundColor: Colors\.bgCardSolid/);
  assert.match(settings, /accountNavTitle: \{[\s\S]*?color: Colors\.textPrimary/);
  assert.match(settings, /accountNavSub: \{[\s\S]*?color: Colors\.textSecondary/);
  assert.ok((account.match(/maxFontSizeMultiplier=\{2\}/g) || []).length >= 7);
  assert.doesNotMatch(settings, /accountAction: \{ backgroundColor: Colors\.accent/);
  assert.doesNotMatch(account, /style=\{styles\.accountAction\}/);

  // Sign Out fix from Block 3 must remain a separate visible and confirmed action.
  assert.match(settings, /style=\{styles\.signOutRow\}/);
  assert.match(settings, /onPress=\{handleSignOut\}/);
});
