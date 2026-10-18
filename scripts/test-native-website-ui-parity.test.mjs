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
const dealerMore = app('screens/main/DealerMoreScreen.tsx');

test('web dealer and native Dashboard shortcuts retain matching destinations with clearer native label', () => {
  for (const segment of [
    '/dashboard/dealer',
    '/dashboard/dealer/inventory',
    '/dashboard/dealer/crm',
    '/dashboard/dealer/auctions',
  ]) assert.ok(web.includes(segment), segment);
  for (const [route,label] of [
    ['DealerHome','Dashboard'],
    ['DealerStock','Stock'],
    ['DealerCustomers','Customers'],
    ['DealerBuyBid','Buy & Bid'],
    ['DealerMore','More'],
  ]) {
    assert.ok(tabs.includes("name: '"+route+"'"),route);
    assert.ok(tabs.includes("label: '"+label+"'"),label);
    assert.ok(tabs.includes('<Tab.Screen name="'+route+'"'),route);
    assert.ok(tabs.includes(route === 'DealerMore' ? '<Tab.Screen name="DealerMore" component={GatedDealerMoreTab} />' : 'name: \''+route+'\''), route);
  }
  // DealerHome still opens the same Command Centre; only its display label changed.
  assert.ok(tabs.includes("initialRouteName={dealerMode ? 'DealerHome' : 'Home'}"));
  assert.ok(web.includes('Home'), 'website continues to label its dealer home separately');
  assert.ok(drawer.includes('const MAIN_MENU: MenuItem[]'), 'ten approved public menu entries');
  assert.ok(tabs.includes('const GatedDealerMoreTab = withDealerGate(DealerMoreScreen)'));
  assert.ok(dealerMore.includes('allowedTools = EXTRA_DEALER_TOOLS.filter(tool => hasPermission(tool.permission))'));
});

test('owner reference APK navigation contract: ten-item Menu, five buyer tabs and distinct dealer Tools', () => {
  // 18 Oct owner-supplied CarMazium-QA-Android(3).apk, SHA256
  // dfc4c4d832668a2e63d32d3112421134206123aa051c7fc4780ba6cce2f4b5b2
  const menu = drawer.split('const MAIN_MENU: MenuItem[] = [')[1]?.split('\n];')[0];
  assert.ok(menu, 'the reviewed ten-item public Menu must exist');
  for (const id of ['home','valuation','buy','sell','tradexchange',
    'compare','pricing','about','settings','dashboard']) {
    assert.ok(menu.includes("id: '"+id+"'"), 'missing public Menu action: ' + id);
  }
  assert.ok(drawer.includes("label: 'Get Valuation'"));
  assert.ok(drawer.includes("label: 'User Dashboard'"));
  assert.ok(drawer.includes("label: 'Retail Listings'"));
  assert.ok(drawer.includes("label: 'Sell by Auction · FREE'"));
  assert.ok(!drawer.includes('const DEALER_PRIMARY_ITEMS'), 'do not resurrect duplicate dealer Menu');
  assert.ok(!drawer.includes('More pages & information'), 'remove old oversized drawer');
  for(const route of ['Home','Search','Sell','Saved','Profile']) {
    assert.ok(tabs.includes('<Tab.Screen name="'+route+'"'),route);
  }
  assert.ok(tabs.includes('<Tab.Screen name="DealerMore" component={GatedDealerMoreTab} />'));
  assert.ok(dealerMore.includes('Dealer Tools'));
  assert.ok(dealerMore.includes('hasPermission(tool.permission)'));
  assert.ok(!tabs.includes("if (isDrawerOpen) closeDrawer()"), 'dealer More is a separate screen, not a drawer toggle');
  assert.ok(tabs.includes("name: 'DealerHome', icon: 'grid-outline', iconActive: 'grid', label: 'Dashboard'"));
});

test('role switching and permissions retain secured routes and consumer deep links', () => {
  assert.ok(tabs.includes("role === 'dealer' && accountRole === 'dealer'"));
  assert.ok(tabs.includes("key={dealerMode ? 'dealer-workspace' : 'marketplace-workspace'}"));
  for (const gate of ["hasPermission('VIEW_INVENTORY')","hasPermission('MANAGE_CRM')","hasPermission('VIEW_TRADE')"]) assert.ok(tabs.includes(gate),gate);
  for (const route of ['Home','Search','Live','Saved','Profile']) {
    assert.ok(tabs.includes('<Tab.Screen name="'+route+'"'));
  }
  assert.ok(tabs.includes('<Tab.Screen name="Sell" component={SellLandingScreen} />'));
  assert.ok(tabs.includes("route.name !== 'Live'"), 'consumer auction route stays reachable but outside bottom tabs');
  assert.ok(dealerMore.includes("permission: 'MANAGE_OFFERS'"));
  assert.ok(dealerMore.includes('hasPermission(tool.permission)'));
});

test('native shared header follows actual website logo, notification, account and More hierarchy', () => {
  const head = read('src/components/layout/Header.tsx');
  assert.ok(head.includes('isMobileMenuOpen'));
  assert.ok(bar.includes('<Logo size="sm" width={logoWidth} />'));
  assert.ok(bar.includes("navigation.navigate('Notifications')"));
  assert.ok(bar.includes("navigation.navigate('Settings')"));
  assert.ok(bar.includes('<HamburgerButton websiteStyle showLabel />'), 'approved visible Menu button rather than a question mark');
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
  assert.ok(home.includes('<Text style={ts.greetingLine}>Sell your car</Text>'));
  assert.ok(home.includes('<Text style={ts.greetingAccent}>your way.</Text>'));
  assert.ok(home.includes('Auction FREE · Retail £1'));
  assert.ok(home.includes('approved handover earns a £100 reward.'));
  assert.ok(home.includes("navigation.navigate('Tabs', { screen: 'Search' })"));
  assert.ok(home.includes("navigation.navigate('SellLanding')"));
  assert.ok(!home.includes('<Text style={s.greetingLine}>Find your next</Text>'));
});


test('native home listing cards preserve owner-approved photo-and-facts layout across newer UI work', () => {
  const home = app('screens/main/HomeScreen.tsx');
  assert.ok(!home.includes('<ImageCarousel'), 'home rails must not nest carousels over car information');
  assert.ok(home.includes('useWindowDimensions()'), 'home cards adapt to narrow Android widths');
  assert.ok(home.includes('style={[cs.listingCard, { width: Math.max(220, Math.min(284, windowWidth - 48)) }] }'.replace('] }', ']}')), 'retail cards must fit screen width');
  assert.ok(home.includes('uri: listing.images[0]'), 'retail card needs a single leading photo');
  assert.ok(home.includes('uri: images[0]'), 'auction card needs a single leading photo');
  for (const essential of ['homeVehicleTitle(listing.make, listing.model)', 'listing.year',
    'listing.fuelType', 'listing.mileage', 'formatPrice(listing.price)',
    'GradeChip grade={listing.exteriorGrade}', 'mapTransmission(listing.transmission)',
    'listing.location', 'View Details', 'View auction']) {
    assert.ok(home.includes(essential), 'missing buyer-facing information: ' + essential);
  }
  assert.ok(home.includes('listing.isSellerVerified === true'));
  assert.ok(home.includes("listing.badgeTier === 'STANDARD' || listing.badgeTier === 'PREMIUM'"));
  assert.ok(home.includes("rawCategory === 'S' || rawCategory === 'N'"));
  assert.ok(home.includes('bidOverlay: { flexDirection:'), 'bid details must stay beneath photos');
  assert.ok(home.includes('featuredIds = new Set(featuredListings.map'), 'avoid Featured/Latest duplicates');
  assert.equal(home.split('const cs = useHomeCardStyles();').length - 1, 3,
    'all three home-card types must observe light/dark changes');
  assert.ok(home.includes('mergeAppearanceStyles(s, lightHomeStyles)'), 'merge colours without removing layout');
  for (const style of ['auctionCard', 'listingCard', 'cardBody', 'cardSpecs', 'cardTitle',
    'cardPrice', 'bidOverlay', 'overlayLabel', 'overlayVal', 'homeBadgeText', 'retailFact']) {
    assert.ok(home.includes(style + ': {'), 'missing named home-card style: ' + style);
  }
  assert.ok(home.includes('style={ts.container}'), 'keep native appearance selection connected');
});
