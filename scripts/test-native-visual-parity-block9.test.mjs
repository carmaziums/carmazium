#!/usr/bin/env node
// Issue #477 Block 9: source security/a11y checks, not device visual sign-off.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
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

test('Android QA launch smoke test rejects system dialog or other foreground window',()=>{
  const smoke=read('scripts/ci/android-qa-emulator-smoke.sh');
  assert.ok(smoke.includes('adb shell dumpsys window windows'), 'must inspect real focused Android window');
  assert.ok(smoke.includes('"$focus" != *"$APP_ID"*'), 'live PID behind launcher modal is not a visual pass');
  assert.ok(smoke.includes('focused-window.txt'), 'diagnostic must be retained for owner review');
  assert.ok(smoke.includes('exit 1'), 'failed focus must fail emulator CI');
  const workflow=read('.github/workflows/carmazium-android-offline-qa-apk.yml');
  assert.ok(workflow.includes("'scripts/ci/android-qa-emulator-smoke.sh'"),
    'future QA builds must rerun whenever smoke logic changes');
});

test('every literal native icon across screens and shared components has a real mapped glyph',()=>{
  const srcRoot=resolve(root,'carmazium app/carmazium app/src');
  const map=app('components/BrandIcon.tsx');
  const keys=new Set([...map.matchAll(/^\s*'([^']+)':\s*'[A-Za-z0-9]+'/gm)].map(x=>x[1]));
  const walk=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>
    entry.isDirectory() ? walk(resolve(dir,entry.name)) :
    entry.name.endsWith('.tsx') ? [resolve(dir,entry.name)] : []);
  const missing=[];
  for(const folder of ['screens','components']){
    for(const file of walk(resolve(srcRoot,folder))){
      const source=readFileSync(file,'utf8');
      const regex=/<(?:Ionicons|MaterialCommunityIcons|FontAwesome)\b[^>]{0,180}?\bname=["']([a-z][a-z0-9-]*)["']/g;
      for(const match of source.matchAll(regex)){
        if(!keys.has(match[1])) missing.push(file.slice(srcRoot.length+1)+': '+match[1]);
      }
    }
  }
  assert.deepEqual(missing,[],'missing symbols display HelpCircle question marks');
});

test('every native screen with styled surfaces subscribes to the saved appearance mode',()=>{
  const screensRoot=resolve(root,'carmazium app/carmazium app/src/screens');
  const walk=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(ent=>
    ent.isDirectory() ? walk(resolve(dir,ent.name)) : ent.name.endsWith('.tsx') ? [resolve(dir,ent.name)] : []);
  const files=walk(screensRoot);
  assert.ok(files.length>=80,'audit all native screen routes rather than a few screenshots');
  for (const file of files){
    const src=readFileSync(file,'utf8');
    if(!src.includes('StyleSheet.create(')) continue;
    // Native splash has intentional fixed brand artwork, independent of preference.
    if(file.endsWith('/loading/SplashScreen.tsx')) continue;
    assert.ok(src.includes('useAppearanceStore'),
      'missing appearance subscription: '+file.slice(screensRoot.length));
    assert.ok(src.includes('adaptLegacyLightStyles(') ||
      src.includes('mergeAppearanceStyles(') ||
      src.includes('lightSettingsStyles'),
      'missing native light surface mapping: '+file.slice(screensRoot.length));
  }
});

test('remaining buyer journeys do not show dark gradients or white controls in light mode',()=>{
  for(const file of [
    'auth/PostSignupOnboardingScreen.tsx',
    'buyer/BuyerBidsScreen.tsx',
    'buyer/BuyerDeliveryRequestsScreen.tsx',
  ]) {
    const source=app('screens/'+file);
    assert.ok(source.includes("colors={appearanceMode === 'light' ? ['#EEF5FB', '#F7FBFF', '#EEF5FB']"),
      file+' must not overlay the light palette with a dark native gradient');
    assert.ok(source.includes("barStyle={appearanceMode === 'light' ? 'dark-content' : 'light-content'}"),
      file+' uses readable status bar controls on a light background');
  }
  const delivery=app('screens/buyer/BuyerDeliveryRequestsScreen.tsx');
  assert.ok(delivery.includes("appearanceMode === 'light' ? '#0F172A' : Colors.white"),
    'back arrow must remain visible on the light card');
  const account=app('screens/account/AccountRoleHomeScreen.tsx');
  assert.ok(account.includes("appearanceMode === 'light' ? '#0F172A' : Colors.textPrimary"),
    'Messages icon is not white on a white card');
  const palette=app('theme/appearancePalette.ts');
  assert.ok(palette.includes('Colors.glassBg, Colors.whiteAlpha03, Colors.whiteAlpha04'));
  for(const alpha of ['Colors.whiteAlpha05','Colors.whiteAlpha06','Colors.whiteAlpha07',
    'Colors.whiteAlpha08','Colors.whiteAlpha09','Colors.whiteAlpha10','Colors.whiteAlpha12']){
    assert.ok(palette.includes(alpha),'neutral glass surface not converted in light mode: '+alpha);
  }
  assert.ok(palette.includes('Colors.glassBorderStrong'));
  assert.ok(palette.includes('if (!action &&'), 'semantic status and CTA buttons retain their colours');
});

test('all native screen full-page dark gradients have a light path, except branded image/splash artwork',()=>{
  const rootScreens=resolve(root,'carmazium app/carmazium app/src/screens');
  const walk=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>
    entry.isDirectory() ? walk(resolve(dir,entry.name)) :
    entry.name.endsWith('.tsx') ? [resolve(dir,entry.name)] : []);
  const exceptions=new Set([
    // Marketing artwork uses an image vignette for white lettering.
    'onboarding/OnboardingScreen.tsx',
    // Branded splash intentionally has a dark image background.
    'loading/SplashScreen.tsx',
  ]);
  let total=0;
  for(const file of walk(rootScreens)){
    const relative=file.slice(rootScreens.length+1).replaceAll('\\','/');
    if(exceptions.has(relative)) continue;
    const content=readFileSync(file,'utf8');
    // A literal full-page gradient containing bgPrimary always draws navy,
    // regardless of a separately themed container or card style.
    const regex=/<LinearGradient\b[\s\S]{0,250}?colors=\{\s*\[([^\]]*)\]\s*\}/g;
    for(const match of content.matchAll(regex)){
      if(!match[1].includes('Colors.bgPrimary'))continue;
      total++;
      assert.fail(relative+' renders an unconditional dark full-page gradient in light mode');
    }
  }
  assert.ok(total===0,'no unguarded bgPrimary gradients outside intentionally dark artwork');
});

test('Dashboard gauge is visually distinct from More grid and Menu selection is readable',()=>{
  const iconMap=app('components/BrandIcon.tsx');
  assert.ok(tabs.includes("name: 'DealerHome', icon: 'speedometer-outline', iconActive: 'speedometer'"));
  assert.ok(tabs.includes("name: 'DealerMore', icon: 'apps-outline', iconActive: 'apps'"));
  assert.ok(iconMap.includes("'speedometer-outline': 'Gauge'"));
  assert.ok(drawer.includes("rowLabelActive: { color: '#7F1D1D' }"));
  assert.ok(drawer.includes("rowActive: { backgroundColor: '#FCE8EA'"));
  assert.ok(drawer.includes("item.id === 'dashboard' && activeTab === 'DealerHome'"));
  assert.ok(drawer.includes("dealerMode\n                ? item.id === 'dashboard' && activeTab === 'DealerHome'"),
    'dealer Dashboard should only highlight Dashboard in the public Menu');
});

test('shared listing, auction, import, checkout and enquiry components follow appearance',()=>{
  for (const p of [
    'components/VehicleCard.tsx',
    'components/HorizontalVehicleCard.tsx',
    'components/LiveBidCard.tsx',
    'components/GlassCard.tsx',
    'components/BulkImportModal.tsx',
    'components/ImportListingModal.tsx',
    'components/LocationPromptSheet.tsx',
    'components/ProfileCompletionPromptSheet.tsx',
    'components/StripeCheckoutModal.tsx',
    'components/listing/EnquireModal.tsx',
  ]) {
    const source=app(p);
    assert.ok(source.includes('useAppearanceStore'),p+' must subscribe to appearance');
    assert.ok(source.includes('mergeAppearanceStyles'),p+' must merge colours without losing layout');
  }
  for(const p of ['components/ui/Card.tsx','components/IconButton.tsx',
      'components/SpecBadge.tsx','components/AuctionCardBadges.tsx']) {
    assert.ok(app(p).includes('useAppearanceStore'),p+' must theme shared cards/buttons');
  }
  const dealer=app('screens/main/DealerWebParityOverview.tsx');
  assert.ok(dealer.includes("verifiedText: { color: '#92400E' }"),
    'gold dealer label must stay readable on white');
  const theme=app('theme/appearancePalette.ts');
  assert.ok(theme.includes('adaptLegacyLightStyles'),'all legacy screens have neutral theme migration');
  assert.ok(theme.includes('mergeAppearanceStyles(base, patch)'),'legacy light colours preserve geometry');
});

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

test('approved one-line bottom labels avoid Samsung word splitting while retaining scaled hit areas',()=>{
  assert.ok(tabs.includes('getBottomTabItemHeight(fontScale)'));
  assert.ok(tabs.includes('numberOfLines={1}'));
  assert.ok(tabs.includes('adjustsFontSizeToFit'));
  assert.ok(tabs.includes('minimumFontScale={0.72}'));
  assert.ok(tabs.includes('maxFontSizeMultiplier={1.3}'));
  assert.ok(!tabs.includes('minimumFontScale={0.6}'));
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
  assert.ok(tabs.includes("name: 'DealerHome', icon: 'speedometer-outline', iconActive: 'speedometer', label: 'Dashboard'"));
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
  for(const field of ['<WebsiteTopBar />','ts.crmPageHeader','ts.crmAutoBanner',
    'ts.crmMetrics','ts.crmStagesScroll','ts.filterScroll']) {
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

test('legacy light palette preserves white CTA contrast and backs with white inline icons',()=>{
  const palette=app('theme/appearancePalette.ts');
  assert.ok(palette.includes('btn|button|cta|fab'),
    'light mode cannot turn a red-button white label navy');
  assert.ok(palette.includes("changes.backgroundColor = light.header"),
    'dark-on-light inline icon controls need a contrasting button background');
  assert.ok(palette.includes("lightCards.has(bg) || bg === Colors.whiteAlpha05"),
    'only former neutral glass surfaces should acquire a dark icon backdrop');
});

test('light appearance reaches nested KYC, CRM, dashboard and upload field components',()=>{
  const kyc=app('screens/main/DealerKYCScreen.tsx');
  const crm=app('screens/main/DealerLeadsScreen.tsx');
  const account=app('screens/account/UnifiedDashboardScreen.tsx');
  const upload=app('screens/sell/SellCarFlowScreen.tsx');
  assert.ok(kyc.includes("light && { backgroundColor: '#F7FBFF', borderColor: '#D5E1EC', color: '#0F172A' }"),'KYC inline fields must be readable');
  assert.ok(kyc.includes("placeholderTextColor={light ? '#64748B' : Colors.textMuted}"));
  assert.ok(kyc.includes('style={ts.pendingContainer}'),'pending KYC state should theme');
  assert.ok(kyc.includes('style={ts.sectionEyebrow}'),'nested KYC section heading should theme');
  assert.ok(kyc.includes("skeletonBg = mode === 'light'"),'KYC skeleton must not remain navy');
  for(const name of ['const LeadRow: React.FC','const BoardCard: React.FC']) {
    const start=crm.indexOf(name);
    const end=crm.indexOf('});',start);
    assert.ok(start>=0 && end>start, 'missing CRM component '+name);
    const body=crm.slice(start,end);
    assert.ok(body.includes('useAppearanceStore(state => state.mode)'),name+' must subscribe to theme');
    assert.ok(body.includes('mergeAppearanceStyles('),name+' must apply its theme');
    assert.ok(body.includes('style={ts.'),name+' must render themed styles');
  }
  assert.ok(account.includes('const Tile: React.FC')&&account.includes('style={[ts.tile'),'Unified Dashboard tiles need theme');
  assert.ok(account.includes("backgroundColor: mode === 'light' ? '#E5EEF7'"),'Dashboard skeleton colours must theme');
  assert.ok(upload.includes("const placeholderColor = appearanceMode === 'light' ? '#64748B' : Colors.borderMuted"),
    'main guided upload fields need legible placeholders');
  assert.ok(upload.includes("const placeholderColor = useAppearanceStore(state => state.mode) === 'light' ? '#64748B' : Colors.borderMuted"),
    'helper input sheets need legible placeholders');
  assert.ok(!upload.includes('placeholderTextColor={Colors.borderMuted}'),'no unreadable fixed dim upload placeholder');
});

test('team cards and seller offer forms respond to light appearance',()=>{
  const team=app('screens/main/DealerTeamScreen.tsx');
  const seller=app('screens/seller/SellerOffersScreen.tsx');
  const role=team.slice(team.indexOf('const RolePill: React.FC'), team.indexOf('// ─── Staff card'));
  const staff=team.slice(team.indexOf('const StaffCard: React.FC'),team.indexOf('// ─── Main screen'));
  for (const source of [role,staff]) {
    assert.ok(source.includes('useAppearanceStore(state => state.mode)'),'nested dealer team component must subscribe to theme');
    assert.ok(source.includes('mergeAppearanceStyles(styles, lightDealerTeamScreenStyles)'),'nested staff theme must preserve layout');
    assert.ok(/\bts\.(?:rolePill|rolePillText|staffCard|staffName)\b/.test(source),'nested staff components must use themed style even with multiline arrays');
  }
  assert.ok(role.includes("backgroundColor: mode === 'light' ? '#FFFFFF'"),'unselected role chips must not blend into light mode');
  assert.ok(!seller.includes('placeholderTextColor={Colors.textMuted}'),'offer input placeholders cannot keep pale dark token');
  assert.ok(seller.includes("placeholderTextColor={appearanceMode === 'light' ? '#526177' : Colors.textMuted}"));
});

test('chat messages theme at row level and keep white text on outgoing red bubbles',()=>{
  const chat = app('screens/main/ChatScreen.tsx');
  const start = chat.indexOf('const MessageBubble: React.FC<MessageBubbleProps>');
  const end = chat.indexOf('export const ChatScreen: React.FC',start);
  assert.ok(start>=0 && end>start,'locate independently memoized message bubble');
  const bubble=chat.slice(start,end);
  assert.ok(bubble.includes('useAppearanceStore(state => state.mode)'),
    'MessageBubble must subscribe to mode; parent-only styles do not theme FlatList rows');
  assert.ok(bubble.includes("adaptLegacyLightStyles(styles)"),
    'incoming bubbles must become light readable surfaces');
  assert.ok(!bubble.includes('style={styles.'),
    'nested message rows must not bypass chosen appearance');
  assert.ok(bubble.includes("isOwn || appearanceMode !== 'light' ? Colors.white : '#0F172A'"),
    'outgoing red chat bubbles retain white text while received white bubbles use navy');
});

test('every non-splash native screen declares a light/dark appearance path',()=>{
  const screenRoot=resolve(root,'carmazium app/carmazium app/src/screens');
  const walk=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>
    e.isDirectory() ? walk(resolve(dir,e.name)) :
    e.name.endsWith('.tsx') ? [resolve(dir,e.name)] : []);
  const files=walk(screenRoot);
  // The launch splash deliberately retains the navy brand identity.
  assert.ok(files.length >= 81, 'detect silently omitted native screens');
  for(const file of files) {
    if(file.endsWith('/loading/SplashScreen.tsx')) continue;
    const code=readFileSync(file,'utf8');
    assert.ok(code.includes('useAppearanceStore'),file+' must subscribe to user light/dark selection');
    assert.ok(code.includes('adaptLegacyLightStyles(') ||
      code.includes('mergeAppearanceStyles(') ||
      code.includes("appearanceMode === 'light'") ||
      code.includes("mode === 'light'"),
      file+' must apply that theme to its surfaces, not merely read the preference');
  }
});

test('shared light palette remaps legacy pale text without recolouring branded CTA labels',()=>{
  const src=app('theme/appearancePalette.ts');
  assert.ok(src.includes('Colors.lightGrey'), 'pale grey labels were invisible on white');
  assert.ok(src.includes('Colors.paleBlue_e2e2ea'), 'legacy pale blue labels are not readable on white');
  assert.ok(src.includes('Colors.inputPlaceholder'), 'legacy muted placeholders need a darker foreground');
  assert.ok(src.includes('legacyPaleText.has(value.color)'), 'use semantic muted text');
  assert.ok(src.includes('changes.color = lightReadableText.warning'), 'warning copy needs an AA-level amber');
  assert.ok(src.includes('changes.color = lightReadableText.info'), 'info copy needs an AA-level blue');
  assert.ok(src.includes('textLike && !action'), 'never change filled CTA white foreground');
  assert.ok(src.includes("name.toLowerCase()"), 'adapt by named styles, not blindly by colour');
  const menu=app('components/GlobalDrawer.tsx');
  assert.ok(menu.includes("rowLabelActive: { color: '#7F1D1D' }"),
    'light-mode selected Menu row must have dark red foreground');
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
