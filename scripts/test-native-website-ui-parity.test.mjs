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
  assert.ok(drawer.includes('visible={isOpen && isAuthenticated}'));
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
  assert.match(shared, /visible=\{isOpen && isAuthenticated\}/);
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
  assert.match(nav, /if \(!isOpen \|\| !isAuthenticated\) setExpandedMenu\(null\)/);
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


test('Block 8 mobile Settings title scrolls, while account actions and Sign Out retain large-text clearance', () => {
  const settings = app('screens/main/SettingsScreen.tsx');
  const layout = app('lib/nativeLayoutParity.ts');
  assert.match(settings, /<WebsiteTopBar \/>[\s\S]*?<ScrollView[\s\S]*?automaticallyAdjustKeyboardInsets[\s\S]*?<View style=\{styles\.settingsPageHeader\}>/);
  const scrollStart = settings.indexOf('      <ScrollView', settings.indexOf('<WebsiteTopBar />'));
  const pageHeader = settings.indexOf('        <View style={styles.settingsPageHeader}>', scrollStart);
  const tools = settings.indexOf('        <View style={styles.accountToolsPanel}>', scrollStart);
  assert.ok(scrollStart >= 0 && pageHeader > scrollStart && tools > pageHeader, 'page header must scroll before tools');
  assert.match(settings, /<Text style=\{styles\.settingsPageTitle\} maxFontSizeMultiplier=\{2\} accessibilityRole="header">Account Settings<\/Text>/);
  assert.match(settings, /<Text style=\{styles\.settingsPageSubtitle\} maxFontSizeMultiplier=\{2\}>/);
  assert.match(settings, /<Text style=\{styles\.settingsBackText\} maxFontSizeMultiplier=\{2\}>Back<\/Text>/);
  assert.match(settings, /settingsPageHeader: \{ paddingHorizontal: 0, paddingTop: 12, paddingBottom: 14 \}/);
  assert.match(settings, /<Text style=\{styles\.accountToolLabel\} maxFontSizeMultiplier=\{2\}>\{tool\.label\}<\/Text>/);
  assert.match(settings, /<Text style=\{\[styles\.categoryLabel, selected && styles\.categoryLabelSelected\]\} maxFontSizeMultiplier=\{2\}>/);
  assert.match(settings, /accountToolLabel: \{[\s\S]*?minWidth: 0, flexShrink: 1/);
  assert.match(settings, /categoryLabel: \{ flex: 1, minWidth: 0, flexShrink: 1/);
  assert.match(settings, /singleColumnSettings && styles\.fullWidthTool/);
  assert.match(settings, /singleColumnSettings && styles\.fullWidthCategory/);
  assert.match(layout, /width < 360 \|\| fontScale >= 1\.5/);
  assert.match(settings, /const settingsBottomClearance = getBottomTabBarHeight\(fontScale, insets\.bottom\) \+ 128/);
  assert.match(settings, /style=\{styles\.signOutRow\}/);
  assert.match(settings, /onPress=\{handleSignOut\}/);
});

test('Block 8 selected tabs, Menu and Settings categories meet readable dark-mode contrast without fake light-mode switches', () => {
  const colors = app('constants/colors.ts');
  const tabs = app('navigation/TabNavigator.tsx');
  const drawer = app('components/GlobalDrawer.tsx');
  const settings = app('screens/main/SettingsScreen.tsx');
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
    return channels.map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const theme = {
    text: colors.match(/textPrimary: '(#[0-9A-Fa-f]{6})'/)?.[1],
    accent: colors.match(/const accent = '(#[0-9A-Fa-f]{6})'/)?.[1],
    accentDeep: colors.match(/const accentDeep = '(#[0-9A-Fa-f]{6})'/)?.[1],
    navy: '#243047',
  };
  assert.ok(theme.text && theme.accent && theme.accentDeep);
  assert.match(tabs, /tabLabelActive: \{\s*color: Colors\.textPrimary/);
  assert.match(tabs, /color=\{isFocused \? Colors\.accent : Colors\.tabInactive\}/);
  assert.match(drawer, /rowLabelActive: \{\s*fontFamily: FontFamily\.bold,\s*color: Colors\.textPrimary/);
  assert.match(drawer, /barActive: \{\s*backgroundColor: Colors\.accent/);
  assert.match(settings, /categoryButtonSelected: \{ backgroundColor: Colors\.accentDeep, borderColor: Colors\.accentDeep \}/);
  assert.match(settings, /categoryLabelSelected: \{ color: Colors\.white \}/);
  assert.ok(contrast(theme.text, theme.navy) >= 4.5, 'selected nav label AA');
  assert.ok(contrast(theme.text, theme.accentDeep) >= 4.5, 'selected Settings label AA');
  assert.ok(contrast(theme.text, theme.accent) < 4.5, 'old white-on-red selection explains why adjustment is required');
  assert.match(settings, /A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(settings, /onPress=\{toggleTheme\}|onPress=\{setTheme\}/);
});


test('Block 9 Menu stays scrollable at short heights, never obscures Login after sign-out', () => {
  const drawer = app('components/GlobalDrawer.tsx');
  const auth = app('store/authStore.ts');
  const root = app('navigation/RootNavigator.tsx');
  const shell = app('../App.tsx');

  const menuStart = drawer.indexOf('        <ScrollView', drawer.indexOf('const drawerContent ='));
  const footer = drawer.indexOf('          <View style={styles.footer}>', menuStart);
  const menuEnd = drawer.indexOf('        </ScrollView>', menuStart);
  assert.ok(menuStart >= 0 && footer > menuStart && menuEnd > footer,
    'branding footer must be part of scrollable Menu, never permanently occupy bottom space');
  assert.match(drawer, /<Text style=\{styles\.footerBrand\} maxFontSizeMultiplier=\{2\}>CARMAZIUM<\/Text>/);
  assert.match(drawer, /<Text style=\{styles\.footerTagline\} maxFontSizeMultiplier=\{2\}>Auction FREE · Retail £1<\/Text>/);
  assert.match(drawer, /style=\{styles\.scroll\}/);
  assert.match(drawer, /MAIN_MENU\.map\(item =>/);
  assert.match(drawer, /item\.children!\.map\(child =>/);
  assert.match(drawer, /const isAuthenticated = useAuthStore\(\(s\) => s\.isAuthenticated\)/);
  assert.match(drawer, /if \(!isAuthenticated\) closeDrawer\(\)/);
  assert.match(drawer, /visible=\{isOpen && isAuthenticated\}/);
  assert.match(drawer, /if \(!isOpen \|\| !isAuthenticated\) setExpandedMenu\(null\)/);
  assert.match(root, /: !isAuthenticated \? \(/);
  assert.match(shell, /<DrawerProvider>[\s\S]*?<GlobalDrawer \/>/);
  assert.match(auth, /logout: async \(\) =>/);
  assert.match(auth, /forceLogout: async \(\) =>/);
});

test('Block 9 MaziuM deferred filter links cannot hijack Menu, Settings or another account', () => {
  const ai = app('components/GlobalAIChatBot.tsx');
  const drawer = app('components/GlobalDrawer.tsx');
  const tabs = app('navigation/TabNavigator.tsx');
  const settings = app('screens/main/SettingsScreen.tsx');

  assert.match(ai, /const pendingChatNavigation = useRef<ReturnType<typeof setTimeout> \| null>\(null\)/);
  assert.match(ai, /if \(pendingChatNavigation\.current\) clearTimeout\(pendingChatNavigation\.current\)/);
  assert.match(ai, /\}, \[authUserId, previewRole, accountRole, isDrawerOpen\]\)/);
  assert.match(ai, /const sourceUserId = authUserId/);
  assert.match(ai, /const sourcePreviewRole = previewRole/);
  assert.match(ai, /const sourceAccountRole = accountRole/);
  assert.match(ai, /currentAuth\.user\?\.id !== sourceUserId/);
  assert.match(ai, /currentAuth\.role !== sourcePreviewRole/);
  assert.match(ai, /currentAuth\.accountRole !== sourceAccountRole/);
  assert.match(ai, /const currentRoute = navigationRef\.getCurrentRoute\(\)\?\.name/);
  assert.match(ai, /MAZIUM_PROTECTED_ROUTES\.has\(currentRoute \?\? ''\)/);
  assert.match(ai, /currentRoute !== sourceRoute/);
  assert.match(ai, /if \(nav === 'SellCarFlow'\)/);
  assert.match(ai, /screen: 'Tabs', params: \{ screen: 'Live' \}/);
  assert.match(ai, /params: \{ screen: 'Search', params: \{ \.\.\.navParams, _t: Date\.now\(\) \} \}/);
  assert.match(ai, /const launcherSuppressed = assistantBlocked \|\| isKeyboardVisible/);
  assert.match(ai, /visible=\{isOpen && !assistantBlocked\}/);
  assert.match(ai, /MAZIUM_PROTECTED_ROUTES\.has\(activeRoute\)/);
  assert.match(drawer, /visible=\{isOpen && isAuthenticated\}/);
  assert.match(tabs, /hasPermission\('VIEW_TRADE'\)/);
  assert.match(settings, /style=\{styles\.signOutRow\}/);
});


test('Block 10 Settings Back never strands a direct-link or restored-session user', () => {
  const settings = app('screens/main/SettingsScreen.tsx');
  const header = app('components/WebsiteTopBar.tsx');
  const rootNav = app('navigation/RootNavigator.tsx');
  assert.match(settings, /accessibilityLabel="Back to previous screen"/);
  assert.match(settings, /if \(navigation\.canGoBack\(\)\) navigation\.goBack\(\)/);
  assert.match(settings, /else navigation\.navigate\('Tabs'\)/);
  assert.match(settings, /onPress=\{handleSignOut\}/);
  assert.match(settings, /const handleSignOut = \(\) => Alert\.alert\('Sign Out'/);
  assert.match(header, /accessibilityLabel="Profile settings"/);
  assert.match(header, /onPress=\{\(\) => navigation\.navigate\('Settings'\)\}/);
  assert.match(rootNav, /const canRestore = isAuthenticated && hasCompletedOnboarding && !!postLoginRedirect/);
});

test('Block 10 cumulative small-screen safe-area and 200% font navigation release contract', () => {
  const geometry = app('lib/nativeLayoutParity.ts');
  const tabbar = app('navigation/TabNavigator.tsx');
  const ai = app('components/GlobalAIChatBot.tsx');
  const globalDrawer = app('components/GlobalDrawer.tsx');
  const settings = app('screens/main/SettingsScreen.tsx');

  assert.match(geometry, /fontScale >= 1\.6 \? 76 : fontScale >= 1\.3 \? 64 : 48/);
  assert.match(geometry, /getBottomTabItemHeight\(fontScale\) \+ 16 \+ Math\.max\(0, bottomInset\)/);
  assert.match(tabbar, /paddingBottom: insets\.bottom/);
  assert.match(tabbar, /minHeight: getBottomTabItemHeight\(fontScale\)/);
  assert.match(ai, /const floatingBottom = getBottomTabBarHeight\(fontScale, insets\.bottom\) \+ 12/);
  assert.match(settings, /const settingsBottomClearance = getBottomTabBarHeight\(fontScale, insets\.bottom\) \+ 128/);
  assert.match(settings, /contentContainerStyle=\{\[styles\.scrollContent, \{ paddingBottom: settingsBottomClearance \}\]\}/);

  for (const fontScale of [1, 1.3, 1.6, 2]) {
    for (const inset of [0, 16, 34]) {
      const itemHeight = fontScale >= 1.6 ? 76 : fontScale >= 1.3 ? 64 : 48;
      const tabHeight = itemHeight + 16 + inset;
      const buttonBottom = tabHeight + 12;
      const settingsBottom = tabHeight + 128;
      assert.ok(buttonBottom > tabHeight, 'AI clears tab at '+fontScale+'x and inset '+inset);
      assert.ok(settingsBottom > tabHeight + 64, 'Sign Out clears bottom at '+fontScale+'x and inset '+inset);
    }
  }
  assert.match(globalDrawer, /visible=\{isOpen && isAuthenticated\}/);
  assert.match(globalDrawer, /if \(!isAuthenticated\) closeDrawer\(\)/);
  assert.match(globalDrawer, /<Text style=\{styles\.footerTagline\} maxFontSizeMultiplier=\{2\}>/);
  assert.match(tabbar, /accessibilityLabel=\{route\.name === 'DealerMore'[\s\S]*?'Dealer tools'/);
});

test('Block 10 written release checklist holds APK, owner consent, security and reversible merge gates', () => {
  const checklist = read('docs/qa/issue-537-native-ux-release-checklist.md');
  const settings = app('screens/main/SettingsScreen.tsx');
  const authStore = app('store/authStore.ts');
  const gate = app('components/DealerGate.tsx');
  const ai = app('components/GlobalAIChatBot.tsx');
  const menu = app('components/GlobalDrawer.tsx');

  for (const pr of [530,534,538,539,540,541,542,543,544,545,546]) {
    assert.ok(checklist.includes('PR #'+pr), 'missing stacked source PR #'+pr);
  }
  assert.match(checklist, /Issue #521/);
  assert.match(checklist, /independent security review/);
  assert.match(checklist, /Android device QA:\*\* pending/);
  assert.match(checklist, /iOS device QA:\*\* pending/);
  assert.match(checklist, /Website public APK download remains disabled/);
  assert.match(checklist, /exact final integration commit/);
  assert.match(checklist, /Do not merge or deploy/);
  assert.match(checklist, /revert the integration commit\(s\) in reverse dependency order/);
  assert.match(checklist, /Owner approval:\*\* pending/);

  // No release gate may be "green" only because the source compiles:
  // dealer owner/staff permissions, AI consent and logout are separate checks.
  assert.match(settings, /if \(switchingDealerView \|\| user\?\.isDealerStaff\) return/);
  assert.match(authStore, /clearDealerAccessCache\(\)/);
  assert.match(gate, /access\?\.isVerified === true/);
  assert.match(ai, /MAZIUM_PROTECTED_ROUTES\.has\(activeRoute\)/);
  assert.match(ai, /hasAiConsent !== true/);
  assert.match(menu, /const currentAuth = useAuthStore\.getState\(\)/);
});


test('post-build QA: no fake Help icons in Menu, dealer More, sorting or settings appearance', () => {
  const icon = app('components/BrandIcon.tsx');
  const tabs = app('navigation/TabNavigator.tsx');
  const header = app('components/HamburgerButton.tsx');
  const saved = app('screens/main/SavedScreen.tsx');
  for (const [name, target] of [
    ['menu', 'Menu'],
    ['apps-outline', 'LayoutGrid'],
    ['apps', 'LayoutGrid'],
    ['swap-vertical-outline', 'ArrowDownUp'],
    ['color-palette-outline', 'Palette'],
    ['arrow-forward-outline', 'ArrowRight'],
  ]) {
    assert.ok(icon.includes("'" + name + "': '" + target + "'"), 'unmapped icon: ' + name);
  }
  assert.match(icon, /const lucideName = ICON_MAP\[name\] \|\| 'Circle'/);
  assert.doesNotMatch(icon, /const lucideName = ICON_MAP\[name\] \|\| 'HelpCircle'/);
  assert.match(header, /<Ionicons name="menu" size=\{22\}/);
  assert.match(tabs, /name: 'DealerMore', icon: 'apps-outline', iconActive: 'apps'/);
  assert.match(tabs, /name: 'DealerCustomers'.*label: 'Customers'/);
  assert.match(tabs, /route\.name === 'DealerCustomers' \? 'CLIENTS' : config\.label/);
  assert.match(tabs, /route\.name === 'DealerCustomers' \? 'Customers'/);
  assert.match(saved, /name="swap-vertical-outline"/);
});

test('post-build QA: Saved Cars opened from Account Settings has its own stack Back route', () => {
  const stack = app('navigation/MainStackNavigator.tsx');
  const settings = app('screens/main/SettingsScreen.tsx');
  const saved = app('screens/main/SavedScreen.tsx');
  const tabs = app('navigation/TabNavigator.tsx');
  assert.match(stack, /SavedFromSettings: undefined/);
  assert.match(stack, /<Stack\.Screen name="SavedFromSettings" component=\{SavedScreen\} \/>/);
  assert.match(settings, /action: \(\) => navigation\.navigate\('SavedFromSettings'\)/);
  assert.match(saved, /const fromSettings = route\.name === 'SavedFromSettings'/);
  assert.match(saved, /accessibilityLabel="Back to Account Settings"/);
  assert.match(saved, /if \(navigation\.canGoBack\(\)\) navigation\.goBack\(\)/);
  assert.match(saved, /else navigation\.navigate\('Settings'\)/);
  assert.match(tabs, /<Tab\.Screen name="Saved" component=\{SavedScreen\} \/>/);
});

test('post-build QA: home rails show exactly one photo with visible facts, price or bid and CTA', () => {
  const home = app('screens/main/HomeScreen.tsx');
  const carousel = app('components/ImageCarousel.tsx');
  const watchlist = app('store/watchlistStore.ts');
  assert.doesNotMatch(home, /<ImageCarousel/);
  assert.match(home, /Math\.max\(220, Math\.min\(292, windowWidth - 48\)\)/);
  assert.match(home, /Math\.max\(220, Math\.min\(284, windowWidth - 48\)\)/);
  assert.match(home, /<Image source=\{\{ uri: images\[0\] \}\} style=\{s\.cardImg\}/);
  assert.match(home, /<Image source=\{\{ uri: listing\.images\[0\] \}\} style=\{s\.cardImg\}/);
  assert.match(home, /<ImageLightbox[\s\S]*?images=\{listing\.images \?\? \[\]\}/);
  assert.match(home, /cardBody: \{ padding: 16, backgroundColor: Colors\.bgCardSolid/);
  assert.match(home, /bidOverlay: \{ flexDirection: 'row', backgroundColor: Colors\.bgElevated/);
  assert.doesNotMatch(home, /bidOverlay: \{ position: 'absolute'/);
  assert.match(home, /<Text style=\{s\.cardPrice\}>\{formatPrice\(listing\.price\)\}<\/Text>/);
  assert.match(home, /<Text style=\{s\.retailFact\}>\{mapTransmission\(listing\.transmission\)\}<\/Text>/);
  assert.match(home, /<Text style=\{s\.homeCardCtaLabel\}>View Details<\/Text>/);
  assert.match(home, /<Text style=\{s\.homeCardCtaLabel\}>\{bids\} bid/);
  assert.match(home, /<GradeChip grade=\{listing\.exteriorGrade\} \/>/);
  assert.match(home, /listing\.writeOffCategory \|\| listing\.conditionRaw/);
  assert.match(home, /rawCategory === 'S' \|\| rawCategory === 'N'/);
  assert.match(home, /listing\.isSellerVerified === true/);
  assert.match(home, /listing\.badgeTier === 'STANDARD' \|\| listing\.badgeTier === 'PREMIUM'/);
  assert.match(home, />HPI Included<\/Text>/);
  assert.match(home, />Verified seller<\/Text>/);
  assert.match(home, />\{writeOffBadge\}<\/Text>/);
  assert.doesNotMatch(home, /\|\| 'Category S'|\|\| 'HPI Included'/);
  assert.match(home, /<AuctionCardChips/);
  assert.match(home, /const featuredIds = new Set\(featuredListings\.map\(listing => listing\.id\)\)/);
  assert.match(home, /latestListings\.filter\(listing => !featuredIds\.has\(listing\.id\)\)/);
  assert.match(home, /homeVehicleTitle\(l\?\.make, l\?\.model\)/);
  assert.match(watchlist, /toggle:/);
  assert.match(carousel, /pagingEnabled/); // full galleries elsewhere remain intact
});

test('post-build QA: valuation and TradeXchange clear the tab bar and gesture inset', () => {
  const valuation = app('screens/sell/SellLandingScreen.tsx');
  const services = app('screens/main/ServicesScreen.tsx');
  for (const page of [valuation, services]) {
    assert.match(page, /getBottomTabBarHeight\(fontScale, insets\.bottom\) \+ (?:32|24)/);
    assert.match(page, /useSafeAreaInsets\(\)/);
    assert.match(page, /useWindowDimensions\(\)/);
  }
  assert.doesNotMatch(valuation, /paddingBottom:110/);
  assert.doesNotMatch(services, /<View style=\{\{ height: 60 \}\} \/>/);
});


test('owner QA: retail quick filters remain legible and scroll with results on short phones', () => {
  const search = app('screens/main/SearchScreen.tsx');
  assert.equal((search.match(/<FlatList\b/g) ?? []).length, 1,
    'one virtualised vertical results list must own all search controls');
  const navIndex = search.indexOf('<WebsiteTopBar />');
  const listIndex = search.indexOf('<FlatList', navIndex);
  const headerIndex = search.indexOf('ListHeaderComponent={', listIndex);
  const quickIndex = search.indexOf('QUICK FILTERS', headerIndex);
  const sortIndex = search.indexOf('{/* ── Sort + Filter row ── */}', quickIndex);
  const emptyIndex = search.indexOf('ListEmptyComponent={', sortIndex);
  assert.ok(navIndex >= 0 && listIndex > navIndex && headerIndex > listIndex
    && quickIndex > headerIndex && sortIndex > quickIndex && emptyIndex > sortIndex,
    'quick-filter bar and Sort/Filters stay together inside the scrollable list header');
  assert.match(search, /resultsList: \{ flex: 1 \}/);
  assert.match(search, /searchHeader: \{ marginHorizontal: -24, paddingBottom: 12 \}/);
  assert.match(search, /quickScroll: \{ height: 68, minHeight: 68, flexShrink: 0, flexGrow: 0/);
  assert.match(search, /quickRow: \{ paddingHorizontal: 24, paddingVertical: 8/);
  assert.match(search, /quickChip: \{ minHeight: 44, justifyContent: 'center'/);
  assert.match(search, /maxFontSizeMultiplier=\{2\}/);
  assert.match(search, /Swipe to see more →/);
  assert.match(search, /showsHorizontalScrollIndicator\s+style=\{s\.quickScroll\}/);
  assert.match(search, /accessibilityState=\{\{ selected: quickFilter === f\.id \}\}/);
});

test('owner QA: all retail quick filter options and sort/filter functionality survive layout correction', () => {
  const search = app('screens/main/SearchScreen.tsx');
  const filters = search.slice(search.indexOf('const QUICK_FILTERS:'), search.indexOf('// The ten shown before'));
  for (const label of ['All', 'Under £15k', 'Under £30k', 'Electric', 'Hybrid',
    'SUVs', 'Sedan', '2020+', 'Manual']) {
    assert.ok(filters.includes("label: '" + label + "'"), 'missing quick filter '+label);
  }
  assert.equal((filters.match(/params: \{/g) ?? []).length, 9);
  assert.match(search, /onPress=\{\(\) => applyQuickFilter\(f\.id\)\}/);
  assert.match(search, /<Text style=\{s\.sortBtnText\}>Sort<\/Text>/);
  assert.match(search, /onPress=\{\(\) => setFilterOpen\(true\)\}/);
  assert.match(search, /<BottomSheet visible=\{showSortMenu\}/);
  assert.match(search, /<BottomSheet visible=\{filterOpen\}/);
  assert.match(search, /renderItem=\{renderListingItem\}/);
  assert.match(search, /onEndReached=\{\(\) => \{ if \(!loading && listings\.length > 0 && hasMore && !loadingMore\) fetch\(false\); \}\}/);
  assert.match(search, /ListEmptyComponent=\{\s*loading \? \(/);
  assert.match(search, /onRefresh=\{onRefresh\}/);
});
