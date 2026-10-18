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
const dealerMore=app('screens/main/DealerMoreScreen.tsx');
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
  assert.ok(dealerMore.includes('getBottomTabBarHeight(fontScale, insets.bottom)'));
  assert.ok(layout.includes('getBottomTabItemHeight(fontScale) + 16 + Math.max(0, bottomInset)'));
  assert.ok(layout.includes('fontScale >= 1.6 ? 76 : fontScale >= 1.3 ? 64 : 48'));
  assert.ok(drawer.includes('dealerMode'));
  assert.ok(tabs.includes('const GatedDealerMoreTab = withDealerGate(DealerMoreScreen)'));
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
    assert.ok(source.includes('mergeAppearanceStyles(styles,') || source.includes('mergeAppearanceStyles(s,'),screen+' preserves dark layout geometry while overriding colours');
  }
  const bottomSheet=app('components/BottomSheet.tsx');
  assert.ok(bottomSheet.includes("appearanceMode === 'light' && { backgroundColor: palette.card"));
  assert.ok(bottomSheet.includes("color={palette.text}"));
  const settings=app('screens/main/SettingsScreen.tsx');
  assert.ok(settings.includes('lightSettingsStyles'));
  assert.ok(settings.includes('The dark appearance remains the fully tested default'));
});

test('appearance override merges per style key and covers watchlist, messages and dealer auction cards',()=>{
  const helper=app('theme/appearancePalette.ts');
  assert.ok(helper.includes('export function mergeAppearanceStyles'), 'shared geometry-safe theme helper');
  assert.ok(helper.includes('...base[key], ...patch'), 'never replace a View style with only colour');
  for(const screen of [
    'screens/main/SavedScreen.tsx',
    'screens/main/MessagesScreen.tsx',
    'screens/main/DealerBuyBidScreen.tsx',
    'screens/main/DealerAuctionBuyingSections.tsx',
    'screens/buyer/BuyerDashboardScreen.tsx',
    'components/filters/AuctionFilterSheet.tsx',
  ]) {
    const src=app(screen);
    assert.ok(src.includes('mergeAppearanceStyles('),screen+' light appearance keeps native geometry');
    assert.ok(src.includes('useAppearanceStore'),screen+' tracks saved choice');
  }
});

test('Customers CRM scrolls header, KPIs, pipeline and cards as one vertical surface',()=>{
  // Samsung QA screenshot 18 Oct: previous fixed header and metrics consumed
  // viewport height, leaving the lead list below the bottom tab bar.
  assert.ok(crm.includes('const customerPageHeader = ('), 'heading must be a scroll header');
  assert.ok(crm.includes('ListHeaderComponent={customerPageHeader}'), 'only one vertical FlatList owns the page');
  assert.equal((crm.match(/<FlatList/g) || []).length, 1, 'avoid separate below-fold card scroller');
  const fromHeader = crm.indexOf('const customerPageHeader = (');
  const headerEnd = crm.indexOf('const currentCustomerRows', fromHeader);
  const header = crm.slice(fromHeader, headerEnd);
  for(const field of ['<WebsiteTopBar />','styles.crmPageHeader','styles.crmAutoBanner',
    'styles.crmMetrics','styles.crmStagesScroll','styles.filterScroll']) {
    assert.ok(header.includes(field),'missing scrollable CRM section: '+field);
  }
  assert.ok(crm.includes('getScrollableStageHeight(fontScale)'),'horizontal pipeline remains usable');
  assert.ok(crm.includes("key={viewMode === 'board' ?"),'board/list navigation remains responsive');
  assert.ok(crm.includes('renderLeadRow({ item })'),'memoized customer row retained');
  assert.ok(crm.includes('ListEmptyComponent='),'empty, loading and error states retained');
  assert.ok(crm.includes('paddingBottom: insets.bottom + 96'),'customer cards must clear the bottom tab');
  assert.ok(crm.includes('onRefresh={() => { void fetchLeads(true); }}'),'pull to refresh retained');
  assert.ok(crm.includes('setCreateModalVisible(true)'),'Add Customer still reachable');
  assert.ok(crm.includes('navigation?.navigate(\'DealerOffers\')'),'offers route retained');
});

test('18 October Samsung light-mode screenshots: critical surfaces and approved menu glyphs',()=>{
  const iconMap = app('components/BrandIcon.tsx');
  const header = app('components/WebsiteTopBar.tsx');
  const menu = app('components/HamburgerButton.tsx');
  const sellerAuctions = app('screens/seller/SellerAuctionsScreen.tsx');
  const dashboard = app('screens/main/DealerProfileScreen.tsx');
  const valuation = app('screens/sell/SellLandingScreen.tsx');
  const drawer = app('components/GlobalDrawer.tsx');
  assert.ok(iconMap.includes("'menu': 'Menu'"),'top-right Menu must not fall back to a question-mark icon');
  assert.ok(iconMap.includes("'apps-outline': 'LayoutGrid'"),'dealer More must not fall back to question-mark icon');
  assert.ok(header.includes('<HamburgerButton websiteStyle showLabel />'),'approved top-right Menu label');
  assert.ok(header.includes('name="notifications-outline" size={20} color={Colors.white}'),'bell must contrast with navy header in light mode');
  assert.ok(menu.includes('showLabel && <Text'),'menu has a visible action label');
  assert.ok(tabs.includes('adjustsFontSizeToFit'),'Dashboard and Customers bottom labels must not break');
  assert.ok(tabs.includes('numberOfLines={1}'),'bottom labels stay on one line');
  assert.ok(drawer.includes('lightGlobalDrawerStyles'),'Menu option surfaces theme with the page');
  for(const [path,token] of [
    ['screens/main/DealerPurchasesScreen.tsx','lightPurchasesStyles'],
    ['screens/main/DealerMyOffersScreen.tsx','lightMyOffersStyles'],
    ['screens/main/DealerOffersScreen.tsx','lightReceivedOffersStyles'],
    ['screens/main/NotificationsScreen.tsx','lightNotificationsScreenStyles'],
    ['components/offers/CounterLedger.tsx','lightCounterLedgerStyles'],
    ['components/SaleCancellationSheet.tsx','lightSaleCancellationStyles'],
    ['components/delivery/ReceivedDeliveryRequestsPanel.tsx','lightDeliveryRequestStyles'],
  ]) {
    const source = app(path);
    assert.ok(source.includes(token), path+' must have light palette');
    assert.ok(source.includes('mergeAppearanceStyles('),path+' must keep structural card styles');
  }
  assert.ok(valuation.includes('lightValuationStyles'),'valuation fields must theme');
  assert.ok(valuation.includes('const mode = useAppearanceStore'),'shared field editor must theme');
  assert.ok(dashboard.includes('attentionRow: { backgroundColor: \'#FFFFFF\''),'Dashboard attention cards must not remain navy');
  assert.ok(dashboard.includes('extraInsightsBody: { backgroundColor: \'#EEF5FB\''),'Additional insights area must theme');
  assert.ok(sellerAuctions.includes('lightSellerAuctionStyles'),'Create Auction wizard cards must theme');
  assert.ok(sellerAuctions.includes("appearanceMode === 'light' ? '#0F172A' : Colors.white"),'white-sheet close icons must contrast');
  assert.ok(sellerAuctions.includes('flexWrap: \'wrap\''),'auction tabs must not clip horizontally');
  assert.ok(sellerAuctions.includes('contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 85'),'auction wizard scrolls above Samsung system bar');
});

test('AA contrast in light-mode text and statuses across every pale background',()=>{
  const palette = app('theme/appearancePalette.ts');
  const colors = [
    ["muted", "#526177"],
    ["accent", "#CC1820"],
    ["success", "#047857"],
    ["warning", "#92400E"],
    ["info", "#1D4ED8"],
    ["error", "#B91C1C"],
  ];
  const backgrounds = ["#FFFFFF","#EEF5FB","#F7FBFF","#E5EEF7"];
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(x => parseInt(x,16)/255)
      .map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  };
  for(const [name, fg] of colors){
    assert.ok(palette.includes(name+": '"+fg+"'"),'theme must define verified '+name);
    for(const bg of backgrounds){
      const a=luminance(fg), b=luminance(bg);
      const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      assert.ok(ratio >= 4.5, name+' text must pass AA on '+bg+': '+ratio.toFixed(2));
    }
  }
  for(const path of [
    'screens/main/DealerPurchasesScreen.tsx',
    'screens/main/DealerOffersScreen.tsx',
    'screens/main/DealerMyOffersScreen.tsx',
    'screens/seller/SellerAuctionsScreen.tsx',
  ]) {
    const source = app(path);
    assert.ok(source.includes("lightReadableText"),path+' status labels must use dark contrast-aware shades');
  }
  const valuation=app('screens/sell/SellLandingScreen.tsx');
  assert.ok(valuation.includes("mode === 'light' ? '#526177' : Colors.textMuted"),'text-input placeholders must not stay pale on white');
});

test('Trader Verification light sheet retains readable text, error notice and input hints',()=>{
  const settings=app('screens/main/SettingsScreen.tsx');
  const errorBanner=app('components/ui/ErrorBanner.tsx');
  const sheet=app('components/BottomSheet.tsx');
  for(const token of [
    "verifyStepTitle: { color: '#0F172A' }",
    "verifyStepSub: { color: '#334155' }",
    "verifyModalBody: { backgroundColor: '#FFFFFF' }",
    "inputField: { color: '#0F172A', backgroundColor: '#F7FBFF', borderColor: '#D5E1EC' }",
    "placeholderTextColor={appearanceMode === 'light' ? '#64748B' : Colors.iconMuted}",
    "appearanceMode === 'light' && lightSettingsStyles.verifyStepTitle",
    "appearanceMode === 'light' && lightSettingsStyles.verifyStepSub",
    "appearanceMode === 'light' && lightSettingsStyles.resendLinkText",
  ]) assert.ok(settings.includes(token), 'Trader Verification must be readable: '+token);
  assert.ok(errorBanner.includes("light && { color: '#7F1D1D' }"),
    'QA READ ONLY warning must show dark red text on pale red background');
  assert.ok(errorBanner.includes("backgroundColor: '#FDECEC'"),
    'ErrorBanner needs its own accessible pale red surface');
  assert.ok(sheet.includes('numberOfLines={2} ellipsizeMode="tail"'),
    'Trader Verification step heading must not be clipped to one line');
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
