#!/usr/bin/env node
// Issue #477 Block 9: source security/a11y checks, not device visual sign-off.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=p=>readFileSync(resolve(root,p),'utf8');
const app=p=>read('carmazium app/carmazium app/src/'+p);
const tabs=app('navigation/TabNavigator.tsx');
const stack=app('navigation/MainStackNavigator.tsx');
const gate=app('components/DealerGate.tsx');
const drawer=app('components/GlobalDrawer.tsx');
const profile=app('screens/main/SettingsScreen.tsx');
const message=app('screens/main/MessagesScreen.tsx');
const crm=app('screens/main/DealerLeadsScreen.tsx');
const auction=app('screens/main/DealerBuyBidScreen.tsx');
const top=app('components/WebsiteTopBar.tsx');
const layout=app('lib/nativeLayoutParity.ts');
const evidence=read('docs/native/website-native-visual-parity-block9-20261010.md');

test('all three sensitive dealer bottom tabs have actual KYC + permission screen gates',()=>{
  for(const [name,component,screen,permission] of [
    ['DealerStock','GatedDealerStockTab','DealerInventoryScreen','VIEW_INVENTORY'],
    ['DealerCustomers','GatedDealerCustomersTab','DealerLeadsScreen','MANAGE_CRM'],
    ['DealerBuyBid','GatedDealerBuyBidTab','DealerBuyBidScreen','VIEW_TRADE']
  ]){
    assert.ok(tabs.includes(`const ${component} = withDealerGate(${screen}, '${permission}')`),name+' gate');
    assert.ok(tabs.includes(`<Tab.Screen name="${name}" component={${component}} />`),name+' registered gate');
    assert.ok(!tabs.includes(`<Tab.Screen name="${name}" component={${screen}} />`),name+' raw screen forbidden');
    assert.ok(tabs.includes(`hasPermission('${permission}')`),'keep visual filtering');
  }
  assert.ok(stack.includes("withDealerGate(DealerInventoryScreen, 'VIEW_INVENTORY')"));
  assert.ok(stack.includes("withDealerGate(DealerLeadsScreen, 'MANAGE_CRM')"));
  assert.ok(gate.includes('access?.isVerified === true'));
  assert.ok(gate.includes("!hasPermission(requiredPermission)"));
  assert.ok(gate.includes('permissionError'));
});

test('staff cannot reach owner-only dealership identity and verification controls via settings deep link',()=>{
  assert.ok(profile.includes('const canManageBusiness = isDealerAccount && !isDealerStaff;'));
  assert.ok(profile.includes("section !== 'business' || canManageBusiness"));
  assert.ok(profile.includes("!canManageBusiness && activeCategory === 'business'"));
  assert.ok(profile.includes("...(canManageBusiness ? [{ id: 'business'"));
  assert.ok(profile.includes("{canManageBusiness && ("));
  assert.ok(profile.includes('Business ownership, legal type and verification changes must be made by the dealership owner.'));
  assert.ok(profile.includes("isDealerStaff ? 'Dealer team member'"));
  assert.ok(profile.includes(') : !isDealerStaff ? ('));
  assert.ok(profile.includes("navigation.navigate('DealerKYC'"));
  assert.ok(profile.includes('handleSaveProfile'));
  assert.ok(profile.includes('handleSavePreferences'));
  assert.ok(profile.includes('handleSaveBank'));
  assert.ok(profile.includes('handleDeleteAccount'));
});

test('large-type tabs wrap rather than reducing to illegible 60 percent and dealer More height stays aligned',()=>{
  assert.ok(tabs.includes('getBottomTabItemHeight(fontScale)'));
  assert.ok(tabs.includes('numberOfLines={2}'));
  assert.ok(tabs.includes('maxFontSizeMultiplier={2}'));
  assert.ok(!tabs.includes('minimumFontScale={0.6}'));
  assert.ok(!tabs.includes('adjustsFontSizeToFit'));
  assert.ok(drawer.includes('getBottomTabBarHeight(fontScale, insets.bottom)'));
  assert.ok(layout.includes('getBottomTabItemHeight(fontScale) + 16 + Math.max(0, bottomInset)'));
  assert.ok(layout.includes('fontScale >= 1.6 ? 76 : fontScale >= 1.3 ? 64 : 48'));
  assert.ok(drawer.includes('dealerMode'));
  for(const route of ['Home','Search','Live','Saved','Profile','DealerHome','DealerMore']){
    assert.ok(tabs.includes(`<Tab.Screen name="${route}"`),route);
  }
});

test('mobile CRM, Buy & Bid and settings do not clip controls at large fonts',()=>{
  assert.ok(crm.includes('getScrollableStageHeight(fontScale)'));
  assert.ok(crm.includes("width: 44, height: 44, borderRadius: 10"));
  assert.ok(auction.includes('getScrollableStageHeight(fontScale)'));
  assert.ok(layout.includes('fontScale >= 1.6 ? 82 : fontScale >= 1.3 ? 68 : 54'));
  assert.ok(profile.includes('useSingleColumnSettings(viewportWidth, fontScale)'));
  assert.ok(profile.includes('singleColumnSettings && styles.fullWidthCategory'));
  assert.ok(profile.includes('singleColumnSettings && styles.fullWidthTool'));
  assert.ok(layout.includes('width < 360 || fontScale >= 1.5'));
});

test('shared header has 44dp targets and messages no longer doubles top safe-area',()=>{
  assert.ok(top.includes('width: 44, height: 44'));
  assert.ok(top.includes('minWidth: 65, height: 44'));
  assert.ok(profile.includes('settingsBackLink'));
  assert.ok(profile.includes('minHeight: 44, alignSelf'));
  assert.ok(message.includes('<WebsiteTopBar />'));
  assert.ok(message.includes("paddingTop: 16, paddingBottom: insets.bottom + 100"));
  assert.ok(!message.includes('paddingTop: insets.top + 16'));
  assert.ok(message.includes('keyboardDismissMode="on-drag"'));
  assert.ok(message.includes('keyboardShouldPersistTaps="handled"'));
  assert.ok(profile.includes('keyboardDismissMode="on-drag"'));
});

test('dealer bottom label is Dashboard; site logo leads to public Home without changing roles',()=>{
  assert.ok(tabs.includes("name: 'DealerHome', icon: 'grid-outline', iconActive: 'grid', label: 'Dashboard'"));
  assert.ok(tabs.includes('initialRouteName={dealerMode ? \'DealerHome\' : \'Home\'}'));
  assert.ok(top.includes("navigation.navigate('Tabs', { screen: 'Home' })"));
  assert.ok(top.includes('accessibilityRole="button"'));
  assert.ok(top.includes('CarMazium logo, open public home page'));
  assert.ok(top.includes('<Logo size="sm" width={logoWidth} />'), 'real logo asset retained');
});

test('Auction Detail bidding starts compact and expands without changing payment safeguards',()=>{
  const screen=app('screens/vehicle/AuctionDetailScreen.tsx');
  assert.ok(screen.includes('const [bidPanelExpanded, setBidPanelExpanded] = useState(false)'));
  assert.ok(screen.includes('accessibilityLabel={bidPanelExpanded ? \'Collapse bidding panel\' : \'Open bidding panel\'}'));
  assert.ok(screen.includes('maxHeight: Math.max(230, Dimensions.get(\'window\').height * 0.55)'));
  assert.ok(screen.includes('keyboardShouldPersistTaps="handled"'));
  assert.ok(screen.includes('bidSubmissionInFlightRef.current'));
  assert.ok(screen.includes('Confirm your auction bid'));
  assert.ok(screen.includes('Pay £125 Fee'));
});

test('Settings heading scrolls with forms and appearance selection persists',()=>{
  const settings=app('screens/main/SettingsScreen.tsx');
  const appRoot=read('carmazium app/carmazium app/App.tsx');
  const store=app('store/appearanceStore.ts');
  assert.ok(settings.indexOf('<ScrollView') < settings.indexOf('<View style={styles.settingsPageHeader}>'));
  assert.ok(settings.includes("(['dark', 'light'] as const).map"));
  assert.ok(settings.includes('setAppearanceMode(choice)'));
  assert.ok(store.includes("AsyncStorage.setItem(STORAGE_KEY, next)"));
  assert.ok(appRoot.includes("dark: appearanceMode === 'dark'"));
  assert.ok(appRoot.includes("appearancePalette(appearanceMode)"));
  assert.ok(appRoot.includes("initializeAppearance()"));
});

test('marketplace and dealer first-fold appearance styles switch without altering dark defaults',()=>{
  const config=read('carmazium app/carmazium app/app.json');
  assert.ok(config.includes('"userInterfaceStyle": "automatic"'));
  for(const [screen,override] of [
    ['screens/main/HomeScreen.tsx','lightHomeStyles'],
    ['screens/main/SearchScreen.tsx','lightRetailStyles'],
    ['screens/main/LiveScreen.tsx','lightLiveStyles'],
    ['screens/main/DealerInventoryScreen.tsx','lightInventoryStyles'],
    ['screens/main/DealerProfileScreen.tsx','lightDealerProfileStyles'],
    ['screens/main/DealerWebParityOverview.tsx','lightDealerOverviewStyles'],
    ['screens/vehicle/AuctionDetailScreen.tsx','lightAuctionDetailStyles'],
  ]) {
    const source=app(screen);
    assert.ok(source.includes(override), screen+' has dedicated semantic light styles');
    assert.ok(source.includes("appearanceMode === 'light'"),screen+' responds to selected appearance');
    assert.ok(source.includes("useAppearanceStore"),screen+' subscribes to appearance changes');
    assert.ok(source.includes('...styles') || source.includes('...s'),screen+' retains original dark styles');
  }
  const bottomSheet=app('components/BottomSheet.tsx');
  assert.ok(bottomSheet.includes("appearanceMode === 'light' && { backgroundColor: palette.card"));
  assert.ok(bottomSheet.includes("color={palette.text}"));
  const settings=app('screens/main/SettingsScreen.tsx');
  assert.ok(settings.includes('lightSettingsStyles'));
  assert.ok(settings.includes('The dark appearance remains the fully tested default'));
});

test('contractor/finance/admin role routing stays explicit and no unsafe acceptance claim',()=>{
  for(const source of [
    "accountRole === 'contractor'",
    "accountRole === 'finance_partner' || accountRole === 'insurance_partner'",
    "accountRole === 'admin'",
    "role === 'dealer'",
  ]) assert.ok(tabs.includes(source),source);
  for(const x of ['P0','buyer','contractor','finance','dealer','staff',
    '360×800','390×844','TalkBack','VoiceOver','VISUAL SIGN-OFF: PENDING',
    'synthetic','STOP at 90%','Revert only Block 9 PR','PR #485']){
    assert.ok(evidence.toLowerCase().includes(x.toLowerCase()),x);
  }
});
