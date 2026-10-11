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
    // Dealer bottom tabs remain, but the hamburger menu intentionally has a
    // consistent ten-item marketplace hierarchy for every account role.
  }
  assert.ok(tabs.includes("initialRouteName={dealerMode ? 'DealerHome' : 'Home'}"));
  assert.ok(tabs.includes("const GatedDealerMoreTab = withDealerGate(DealerMoreScreen);"));
  assert.ok(!tabs.includes("openDrawer();"));
  assert.ok(drawer.includes('EXPLORE CARMAZIUM'));
});

test('role switching and permissions retain secured routes and consumer deep links', () => {
  assert.ok(tabs.includes("role === 'dealer' && accountRole === 'dealer'"));
  assert.ok(tabs.includes("key={dealerMode ? 'dealer-workspace' : 'marketplace-workspace'}"));
  for (const gate of ["hasPermission('VIEW_INVENTORY')","hasPermission('MANAGE_CRM')","hasPermission('VIEW_TRADE')"]) assert.ok(tabs.includes(gate),gate);
  for (const route of ['Home','Search','Live','Saved','Profile']) {
    assert.ok(tabs.includes('<Tab.Screen name="'+route+'"'));
  }
  assert.ok(drawer.includes('MAIN_MENU.map(item =>'));
  assert.ok(drawer.includes("label: 'User Dashboard'"));
  assert.ok(drawer.includes("label: 'Profile Settings'"));
  // Dealer restricted screens remain behind native stack/tab permission gates.
  const stack = app('navigation/MainStackNavigator.tsx');
  assert.ok(stack.includes('withDealerGate(DealerInventoryScreen'));
  assert.ok(stack.includes('withDealerGate(DealerLeadsScreen'));
});

test('native shared header follows actual website logo, notification, account and More hierarchy', () => {
  const head = read('src/components/layout/Header.tsx');
  assert.ok(head.includes('isMobileMenuOpen'));
  assert.ok(bar.includes('<Logo size="sm" width={logoWidth} />'));
  assert.ok(bar.includes("navigation.navigate('Notifications')"));
  assert.ok(bar.includes("navigation.navigate('Settings')"));
  assert.ok(bar.includes('<HamburgerButton websiteStyle />'));
  assert.ok(bar.includes("backgroundColor: '#1E293B'"));
  assert.ok(!bar.includes("setRole("));
  for (const screen of [
    'DealerProfileScreen.tsx',
    'DealerInventoryScreen.tsx',
    'DealerLeadsScreen.tsx',
  ]) assert.ok(app('screens/main/'+screen).includes('<WebsiteTopBar />'),screen);
  assert.ok(app('screens/main/LiveScreen.tsx').includes('{dealerMode && !embeddedDealerHub && <WebsiteTopBar />}'));
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
  assert.ok(home.includes("navigation.navigate('SellLanding')"));
  assert.ok(!home.includes('<Text style={s.greetingLine}>Find your next</Text>'));
});

test('native header exposes one labelled Menu, with distinct avatar Settings and bell Notifications', () => {
  const button = app('components/HamburgerButton.tsx');
  assert.match(button, /accessibilityLabel=\{websiteStyle \? 'Menu' : 'Open navigation menu'\}/);
  assert.match(button, /<Ionicons name="menu" size=\{22\}/);
  assert.match(button, /<Text style=\{styles\.websiteLabel\} maxFontSizeMultiplier=\{2\}>Menu<\/Text>/);
  assert.match(button, /onPress=\{openDrawer\}/);
  assert.match(button, /disabled=\{isOpen\}/);
  assert.doesNotMatch(button, /isOpen \? 'close' : 'menu'/);
  assert.match(bar, /onPress=\{\(\) => navigation\.navigate\('Settings'\)\}/);
  assert.match(bar, /accessibilityLabel="Profile settings"/);
  assert.match(bar, /name="settings-outline"/);
  assert.doesNotMatch(bar, /name="chevron-down"/);
  assert.match(bar, /onPress=\{\(\) => navigation\.navigate\('Notifications'\)\}/);
  assert.match(bar, /<HamburgerButton websiteStyle \/>/);
  // The dealer workspace tab policy from PR #534 is intentionally untouched.
  assert.match(tabs, /if \(!dealerMode\) return !route\.name\.startsWith\('Dealer'\) && route\.name !== 'Live';/);
});

test('dealer More cannot act as the shared menu or hide the bottom bar', () => {
  const tools = app('screens/main/DealerMoreScreen.tsx');
  assert.ok(tabs.includes('<Tab.Screen name="DealerMore" component={GatedDealerMoreTab} />'));
  assert.ok(tabs.includes("route.name === 'DealerMore' ? 'Opens dealer business tools, not the main Menu'"));
  assert.ok(!tabs.includes("isDrawerOpen"));
  assert.ok(!tabs.includes("openDrawer"));
  assert.ok(!tabs.includes("iconName={isMore"));
  for (const key of ['MANAGE_OFFERS', 'VIEW_PURCHASES', 'VIEW_ANALYTICS', 'MANAGE_TEAM']) {
    assert.ok(tools.includes(`permission: '${key}'`), key);
  }
  assert.ok(tools.includes('EXTRA_DEALER_TOOLS.filter(tool => hasPermission(tool.permission))'));
  assert.ok(tools.includes('useDealerAccess(dealerMode)'));
  assert.ok(tools.includes('if') || tools.includes('!dealerMode'));
  assert.ok(tools.includes('getBottomTabBarHeight(fontScale, insets.bottom) + 24'));
  assert.ok(!tools.includes("label: 'Buy Cars'"));
  assert.ok(!tools.includes("label: 'Sell Cars'"));
});

test('shared drawer does not leave a dealer sheet mounted on top of closed navigation', () => {
  assert.ok(drawer.includes('<Modal'));
  assert.ok(drawer.includes('visible={isOpen}'));
  assert.ok(drawer.includes('onRequestClose={closeDrawer}'));
  assert.ok(drawer.includes('onPress={closeDrawer}'));
  assert.ok(drawer.includes('drawerWidth = Math.min(windowWidth * 0.82, 320)'));
  assert.ok(!drawer.includes('dealerOverlay'));
  assert.ok(!drawer.includes('dealerBottomSheet'));
  assert.ok(!drawer.includes('translateY'));
  assert.ok(!drawer.includes('sheetHeight'));
  assert.ok(!drawer.includes('BackHandler'));
  assert.ok(!drawer.includes('dealerTabBarHeight'));
  assert.ok(tabs.includes("backgroundColor: '#243047'"));
});


test('MaziuM launcher yields to account settings, protected forms, menu and keyboard without obscuring tabs', () => {
  const ai = app('components/GlobalAIChatBot.tsx');
  const settings = app('screens/main/SettingsScreen.tsx');
  const shell = app('../App.tsx');
  const drawerContext = app('context/DrawerContext.tsx');
  const layout = app('lib/nativeLayoutParity.ts');

  // DrawerProvider is genuinely above the widget, not an inert context fallback.
  assert.match(shell, /<DrawerProvider>[\s\S]*?<GlobalDrawer \/>[\s\S]*?<GlobalAIChatBot \/>[\s\S]*?<\/DrawerProvider>/);
  assert.match(ai, /import \{ useDrawer \} from '\.\.\/context\/DrawerContext'/);
  assert.match(ai, /const \{ isOpen: isDrawerOpen \} = useDrawer\(\);/);
  assert.match(drawerContext, /const \[isOpen, setIsOpen\] = useState\(false\)/);

  // Account Settings (including Sign Out) and personal/financial flows never
  // render the floating launcher or a competing promotional chat overlay.
  for (const route of ['Settings', 'NotificationSettings', 'DealerKYC', 'DealerOnboarding', 'PurchaseFlow', 'AcceptInvite']) {
    assert.ok(ai.includes("  '"+route+"',"), 'protected route: '+route);
  }
  assert.match(ai, /const assistantBlocked = isDrawerOpen\s*\|\| MAZIUM_PROTECTED_ROUTES\.has\(activeRoute\) \|\| !isForeground/);
  assert.match(ai, /const launcherSuppressed = assistantBlocked \|\| isKeyboardVisible/);
  assert.match(ai, /if \(assistantBlocked\) \{\s*setIsOpen\(false\);\s*setShowGreeting\(false\)/);
  assert.match(ai, /visible=\{isOpen && !assistantBlocked\}/);
  assert.match(ai, /\{!isOpen && !launcherSuppressed && \(/);

  // The keyboard hides ONLY the launcher, not a user-opened conversation:
  // the chat input can still be used while its own keyboard is visible.
  assert.doesNotMatch(ai, /visible=\{isOpen && !launcherSuppressed\}/);
  assert.doesNotMatch(ai, /if \(launcherSuppressed\) \{\s*setIsOpen\(false\)/);
  assert.match(ai, /const dynamicBottom = isKeyboardVisible \? keyboardHeight \+ 8 : chatBottom/);

  // The tab's bottom inset is already inside getBottomTabBarHeight, so it
  // cannot be double-counted on Android/iOS gesture-nav devices.
  assert.match(ai, /const floatingBottom = getBottomTabBarHeight\(fontScale, insets\.bottom\) \+ 12/);
  assert.match(layout, /getBottomTabItemHeight\(fontScale\) \+ 16 \+ Math\.max\(0, bottomInset\)/);
  assert.doesNotMatch(ai, /MAZIUM_TAB_CLEARANCE|Math\.max\(insets\.bottom, 16\) \+ tabClearance/);
  assert.match(ai, /<View style=\{\[styles\.container, \{ bottom: floatingBottom \}\]\} pointerEvents="box-none">/);
  assert.match(ai, /<Animated\.View\s+pointerEvents="box-none"\s+style=\{\[styles\.greetingBubble/);
  assert.match(ai, /accessibilityLabel="Permanently dismiss Mazium greeting"/);

  // Sign Out retains the independent confirmation and bottom scroll space.
  assert.match(settings, /style=\{styles\.signOutRow\}/);
  assert.match(settings, /onPress=\{handleSignOut\}/);
  assert.match(settings, /getBottomTabBarHeight\(fontScale, insets\.bottom\) \+ 128/);
  assert.match(settings, /const handleSignOut = \(\) => Alert\.alert\('Sign Out'/);
});


test('Block 6 compact 280dp–320dp headers preserve all three independently accessible controls', () => {
  const menu = app('components/HamburgerButton.tsx');
  const header = app('components/WebsiteTopBar.tsx');
  const logo = app('components/Logo.tsx');
  assert.match(header, /const logoWidth = Math\.min\(160, Math\.max\(48, windowWidth - 210\)\)/);
  assert.match(header, /paddingHorizontal: 10/);
  assert.match(header, /actions: \{ flexDirection: 'row', alignItems: 'center', gap: 4 \}/);
  assert.match(header, /width: 44, height: 44/);
  assert.match(header, /minWidth: 48, height: 48/);
  assert.match(menu, /minWidth: 90,\s*minHeight: 48/);
  assert.match(header, /accessibilityLabel="Notifications"/);
  assert.match(header, /accessibilityLabel="Profile settings"/);
  assert.match(menu, /accessibilityLabel=\{websiteStyle \? 'Menu' : 'Open navigation menu'\}/);
  assert.match(header, /<HamburgerButton websiteStyle \/>/);
  assert.match(logo, /const LOGO_SOURCE = require\('\.\.\/\.\.\/assets\/images\/logo\.png'\)/);
  for (const width of [280, 300, 320, 360, 390]) {
    const reserved = 44 + 48 + 90 + 4 * 2 + 10 * 2;
    const logoWidth = Math.min(160, Math.max(48, width - 210));
    assert.ok(logoWidth + reserved <= width, 'Header cannot overflow '+width+'dp viewport');
    assert.ok(logoWidth >= 48, 'Brand mark remains visible');
  }
});

test('Block 6 buyer, dealer and staff tab destinations keep menu distinct from More and preserve permissions', () => {
  const nav = app('navigation/TabNavigator.tsx');
  const tools = app('screens/main/DealerMoreScreen.tsx');
  const gate = app('components/DealerGate.tsx');
  assert.match(nav, /const dealerMode = role === 'dealer' && accountRole === 'dealer'/);
  assert.match(nav, /if \(!dealerMode\) return !route\.name\.startsWith\('Dealer'\) && route\.name !== 'Live'/);
  assert.match(nav, /if \(!route\.name\.startsWith\('Dealer'\)\) return false/);
  assert.match(nav, /route\.name === 'DealerStock'.*hasPermission\('VIEW_INVENTORY'\)/);
  assert.match(nav, /route\.name === 'DealerCustomers'.*hasPermission\('MANAGE_CRM'\)/);
  assert.match(nav, /route\.name === 'DealerBuyBid'.*hasPermission\('VIEW_TRADE'\)/);
  assert.match(nav, /const GatedDealerMoreTab = withDealerGate\(DealerMoreScreen\)/);
  assert.match(nav, /accessibilityRole="tab"/);
  assert.match(nav, /accessibilityState=\{\{ selected: isFocused \}\}/);
  assert.match(nav, /accessibilityLabel=\{route\.name === 'DealerMore'\s*\? 'Dealer tools'/);
  assert.match(nav, /route\.name === 'DealerMore' \? 'Opens dealer business tools, not the main Menu'/);
  assert.match(nav, /accessibilityElementsHidden importantForAccessibility="no" \/>/);
  assert.doesNotMatch(nav, /openDrawer\(\)/);
  assert.match(tools, /EXTRA_DEALER_TOOLS\.filter\(tool => hasPermission\(tool\.permission\)\)/);
  assert.match(gate, /access\?\.isVerified === true/);
  assert.match(gate, /permissionDenied/);
  assert.match(gate, /withDealerGate/);
});

test('Block 6 drawer reads naturally at 200% font, scrolls and distinguishes dealer dashboard', () => {
  const shared = app('components/GlobalDrawer.tsx');
  const menu = app('components/HamburgerButton.tsx');
  const settings = app('screens/main/SettingsScreen.tsx');
  assert.match(shared, /visible=\{isOpen\}/);
  assert.match(shared, /onRequestClose=\{closeDrawer\}/);
  assert.match(shared, /accessibilityLabel="Close navigation menu"/);
  assert.match(shared, /accessibilityLabel=\{item\.id === 'dashboard' && dealerMode \? 'Dealer Dashboard' : item\.label\}/);
  assert.match(shared, /expanded \? 'Collapse ' \+ item\.label \+ ' choices' : 'Expand ' \+ item\.label \+ ' choices'/);
  assert.match(shared, /accessibilityState=\{item\.children \? \{ expanded: !!expanded \} : \{ selected: active \}\}/);
  assert.match(shared, /<Text style=\{\[styles\.rowLabel, active && styles\.rowLabelActive\]\} maxFontSizeMultiplier=\{2\}>/);
  assert.match(shared, /<Text style=\{styles\.subMenuText\} maxFontSizeMultiplier=\{2\}>/);
  assert.match(shared, /<Text style=\{styles\.userName\} maxFontSizeMultiplier=\{2\} numberOfLines=\{2\}>/);
  assert.match(shared, /userMeta: \{\s*flex: 1,\s*minWidth: 0/);
  assert.match(shared, /rowLabel: \{\s*flex: 1,\s*minWidth: 0,\s*flexShrink: 1/);
  assert.match(shared, /subMenuText: \{ flex: 1, minWidth: 0, flexShrink: 1/);
  assert.match(shared, /style=\{styles\.scroll\}/);
  assert.match(shared, /bounces=\{false\}/);
  assert.match(menu, /maxFontSizeMultiplier=\{2\}>Menu<\/Text>/);
  assert.match(settings, /isDealerStaff && \(/);
  assert.match(settings, /Managed by dealership owner/);
  assert.match(settings, /const canManageBusiness = isDealerAccount && !isDealerStaff/);
  assert.match(settings, /style=\{styles\.signOutRow\}/);
  assert.match(settings, /onPress=\{handleSignOut\}/);
});


test('Block 7 drawer dismissals cancel stale taps and reset expanded choices across account changes', () => {
  const nav = app('components/GlobalDrawer.tsx');
  const auth = app('store/authStore.ts');
  const ctx = app('context/DrawerContext.tsx');
  assert.match(nav, /const pendingNavigation = useRef<ReturnType<typeof setTimeout> \| null>\(null\)/);
  assert.match(nav, /const pendingQaShare = useRef<ReturnType<typeof setTimeout> \| null>\(null\)/);
  assert.match(nav, /const accountId = user\?\.id/);
  assert.match(nav, /return \(\) => \{\s*if \(pendingNavigation\.current\) clearTimeout\(pendingNavigation\.current\)/);
  assert.match(nav, /\}, \[accountId, role, accountRole\]\)/);
  assert.match(nav, /if \(!isOpen\) setExpandedMenu\(null\)/);
  assert.match(nav, /if \(pendingNavigation\.current\) clearTimeout\(pendingNavigation\.current\)/);
  assert.match(nav, /const currentAuth = useAuthStore\.getState\(\)/);
  assert.match(nav, /if \(!currentAuth\.isAuthenticated\s*\|\| currentAuth\.user\?\.id !== sourceAccountId\s*\|\| currentAuth\.role !== sourceRole\s*\|\| currentAuth\.accountRole !== sourceAccountRole\) return/);
  assert.match(nav, /navigation\.navigate\('Main', \{ screen: item\.stackScreen, params: item\.params \} as never\)/);
  assert.match(nav, /const destination = item\.id === 'dashboard' && dealerMode\s*\? 'DealerHome'\s*: item\.tabName/);
  assert.match(nav, /navigation\.navigate\('Main', \{ screen: 'Tabs', params: \{ screen: destination \} \}\)/);
  assert.match(nav, /if \(!currentAuth\.isAuthenticated \|\| currentAuth\.user\?\.id !== sourceAccountId\) return/);
  assert.match(ctx, /const closeDrawer = useCallback\(\(\) => setIsOpen\(false\), \[\]\)/);
  assert.match(auth, /forceLogout: async \(\) =>/);
  assert.match(auth, /logout: async \(\) =>/);
});

test('Block 7 dealer permissions remain isolated by authenticated identity and reject stale role requests', () => {
  const accessApi = app('lib/dealerAccessApi.ts');
  const hook = app('hooks/useDealerAccess.ts');
  const auth = app('store/authStore.ts');
  const tabs = app('navigation/TabNavigator.tsx');
  const more = app('screens/main/DealerMoreScreen.tsx');
  const gate = app('components/DealerGate.tsx');

  assert.match(accessApi, /let cachedUserId: string \| null = null/);
  assert.match(accessApi, /let cacheEpoch = 0/);
  assert.match(accessApi, /if \(userId && cachedUserId !== userId\)/);
  assert.match(accessApi, /if \(userId && !force && cachedAccess && Date\.now\(\) - cachedAt < CACHE_MS\)/);
  assert.match(accessApi, /if \(userId && cachedUserId === userId && cacheEpoch === requestEpoch\)/);
  assert.match(accessApi, /export function clearDealerAccessCache\(\) \{[\s\S]*?cacheEpoch \+= 1/);
  assert.match(hook, /const userId = useAuthStore\(s => s\.user\?\.id \?\? null\)/);
  assert.match(hook, /const activeUserId = enabled && isAuthenticated \? userId : null/);
  assert.match(hook, /const requestEpoch = useRef\(0\)/);
  assert.match(hook, /setSnapshot\(\{ userId: activeUserId, access: null, loading: true, error: null \}\)/);
  assert.match(hook, /await getDealerAccess\(force, activeUserId\)/);
  assert.match(hook, /requestEpoch\.current !== requestId[\s\S]*?user\?\.id !== activeUserId/);
  assert.match(hook, /return \(\) => \{ requestEpoch\.current \+= 1; \}/);
  assert.match(hook, /const matchingIdentity = !!activeUserId && snapshot\.userId === activeUserId/);
  assert.match(hook, /permission: DealerPermission\) => !loading && !!access\?\.permissions\?\.includes\(permission\)/);
  assert.match(auth, /import \{ clearDealerAccessCache \} from '\.\.\/lib\/dealerAccessApi'/);
  assert.ok((auth.match(/clearDealerAccessCache\(\)/g) || []).length >= 2, 'both forced and manual logout clear grants');
  assert.match(tabs, /route\.name === 'DealerStock'.*?!dealerAccessLoading && hasPermission\('VIEW_INVENTORY'\)/);
  assert.match(tabs, /route\.name === 'DealerCustomers'.*?!dealerAccessLoading && hasPermission\('MANAGE_CRM'\)/);
  assert.match(tabs, /route\.name === 'DealerBuyBid'.*?!dealerAccessLoading && hasPermission\('VIEW_TRADE'\)/);
  assert.match(more, /EXTRA_DEALER_TOOLS\.filter\(tool => hasPermission\(tool\.permission\)\)/);
  assert.match(gate, /staffVerified =[\s\S]*?access\?\.isVerified === true/);
});
