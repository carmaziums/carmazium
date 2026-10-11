import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app = path => readFileSync(new URL('../carmazium app/carmazium app/src/' + path, import.meta.url), 'utf8');
const drawer = app('components/GlobalDrawer.tsx');
const settings = app('screens/main/SettingsScreen.tsx');
const stack = app('navigation/MainStackNavigator.tsx');
const tabs = app('navigation/TabNavigator.tsx');
const services = app('screens/main/ServicesScreen.tsx');
const valuation = app('screens/sell/SellLandingScreen.tsx');
const dealer = app('screens/main/DealerProfileScreen.tsx');

const mainMenu = drawer.slice(drawer.indexOf('const MAIN_MENU: MenuItem[] = ['), drawer.indexOf('export const GlobalDrawer'));
const topLevel = mainMenu.split('\n').flatMap(line => {
  const match = line.match(/^ {2}[{] id: '([^']+)'/) || line.match(/^ {4}id: '([^']+)'/);
  return match ? [match[1]] : [];
});
test('ten consistent public menu choices, ordered exactly as requested', () => {
  const ids = topLevel;
  assert.deepEqual(ids, [
    'home', 'valuation', 'buy', 'sell', 'tradexchange', 'compare',
    'pricing', 'about', 'settings', 'dashboard',
  ]);
  assert.equal(ids.length,10);
  const labels = ['Home','Get Valuation','Buy Cars','Sell Cars','TradeXchange','Compare','Pricing','About','Profile Settings','User Dashboard'];
  for (const label of labels) assert.ok(mainMenu.includes(`label: '${label}'`), label);
  assert.doesNotMatch(mainMenu, /'Contact Support'|'Sign Out'|'My bids'|'My auctions'|'My listings'|'Reviews'|'Finance'|'How It Works'/);
});

test('only Buy and Sell expand and offer two real routes each', () => {
  assert.match(mainMenu, /id: 'buy'[\s\S]*?children: \[/);
  assert.match(mainMenu, /id: 'buy-retail'[\s\S]*?tabName: 'Search'/);
  assert.match(mainMenu, /id: 'buy-auctions'[\s\S]*?tabName: 'Live'/);
  assert.match(mainMenu, /id: 'sell-auction'[\s\S]*?stackScreen: 'SellCarFlow', params: \{ listingType: 'AUCTION' \}/);
  assert.match(mainMenu, /id: 'sell-retail'[\s\S]*?stackScreen: 'SellCarFlow', params: \{ listingType: 'CLASSIFIED' \}/);
  assert.equal((mainMenu.match(/children: \[/g) || []).length, 2);
  assert.match(drawer, /expandedMenu === item\.id/);
  assert.match(drawer, /accessibilityState=\{item\.children \? \{ expanded: !!expanded \}/);
  assert.match(drawer, /minHeight: 48/);
});

test('valuation, TradeXchange, Compare, Pricing and About point to existing destinations', () => {
  assert.match(mainMenu, /id: 'valuation'.*stackScreen: 'SellLanding'/);
  assert.match(mainMenu, /id: 'tradexchange'.*stackScreen: 'Services'/);
  assert.match(mainMenu, /id: 'compare'.*stackScreen: 'Compare'/);
  assert.match(mainMenu, /id: 'pricing'.*stackScreen: 'Pricing'/);
  assert.match(mainMenu, /id: 'about'.*stackScreen: 'About'/);
  for (const route of ['SellLanding','Services','Compare','Pricing','About','SellCarFlow']) {
    assert.ok(stack.includes('name="'+route+'"'), route + ' is a registered stack destination');
  }
  assert.match(valuation, /Get My Free Valuation/);
  for(const text of ['Delivery & Recovery','Vehicle Inspection','Vehicle Finance','Vehicle Warranty']){
    assert.ok(services.includes(text),text);
  }
});

test('dashboard stays role-aware and settings preserve every account and dealer control', () => {
  assert.match(mainMenu, /id: 'dashboard'.*tabName: 'Profile'/);
  assert.match(drawer, /const destination = item\.id === 'dashboard' && dealerMode\s*\? 'DealerHome'\s*: item\.tabName/);
  assert.match(mainMenu, /id: 'settings'.*stackScreen: 'Settings'/);
  assert.match(tabs, /role === 'dealer'\) return <DealerProfileScreen/);
  for (const id of ['personal','business','verification','notifications','payouts','appearance','security','reviews','account']) {
    assert.ok(settings.includes(`id: '${id}'`) || settings.includes(`id: '${id}' as const`), id);
  }
  assert.match(settings, /handleSwitchDealerView/);
  assert.match(settings, /handleSignOut/);
  assert.match(settings, /navigation\.navigate\('DealerOnboarding'\)/);
  assert.match(settings, /Business ownership, legal type and verification changes must be made by the dealership owner/);
  for (const screen of ['DealerInventory','DealerLeads','DealerOffers','DealerMyOffers','DealerPurchases','DealerTeam']) {
    assert.ok(dealer.includes(`navigation.navigate('${screen}')`), screen);
  }
  assert.match(stack,/withDealerGate\(DealerInventoryScreen/);
  assert.match(stack,/withDealerGate\(DealerLeadsScreen/);
});

test('drawer contains no nested account/dealer inventory flood and keeps test-only feedback unobtrusive', () => {
  assert.doesNotMatch(drawer, /USER_ITEMS|DEALER_ITEMS|visibleDealerItems|visiblePrimaryDealerItems|showAllAccountTools|showAllDealerTools|setShowMorePages/);
  assert.match(drawer, /MAIN_MENU\.map\(item =>/);
  assert.match(drawer, /item\.children!\.map\(child =>/);
  assert.match(drawer, /IS_QA_REVIEW_BUILD && \(/);
  assert.match(drawer, /Share private QA feedback/);
  assert.match(drawer, /key=\{`simple-app-menu-\$\{role\}`\}/);
  assert.match(drawer, /closeDrawer\(\);[\s\S]*?setExpandedMenu\(null\)/);
});
