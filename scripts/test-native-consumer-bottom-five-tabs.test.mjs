import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../carmazium app/carmazium app/src/' + p, import.meta.url), 'utf8');
const tabs = read('navigation/TabNavigator.tsx');
const drawer = read('components/GlobalDrawer.tsx');
const main = read('navigation/MainStackNavigator.tsx');
const landing = read('screens/sell/SellLandingScreen.tsx');
const search = read('screens/main/SearchScreen.tsx');

function consumerOrder() {
  const config = tabs.slice(tabs.indexOf('const TAB_CONFIG:'), tabs.indexOf('// ─── Animated tab icon'));
  return [...config.matchAll(/\{ name: '(Home|Search|Sell|Live|Saved|Profile)', icon: [^\n]+?label: '([^']+)'/g)]
    .map(match => ({ name: match[1], label: match[2] }));
}

test('customer bottom tabs appear in approved Home Buy Sell Saved Dashboard order', () => {
  assert.deepEqual(consumerOrder(), [
    { name: 'Home', label: 'HOME' },
    { name: 'Search', label: 'BUY' },
    { name: 'Sell', label: 'SELL' },
    { name: 'Live', label: 'AUCTIONS' },
    { name: 'Saved', label: 'SAVED' },
    { name: 'Profile', label: 'DASHBOARD' },
  ]);
  assert.match(tabs, /if \(!dealerMode\) return !route\.name\.startsWith\('Dealer'\) && route\.name !== 'Live';/);
  assert.match(tabs, /initialRouteName=\{dealerMode \? 'DealerHome' : 'Home'\}/);
  assert.match(tabs, /<Tab\.Screen name="Sell" component=\{SellLandingScreen\} \/>/);
  assert.match(tabs, /import \{ SellLandingScreen \} from '\.\.\/screens\/sell\/SellLandingScreen';/);
});

test('Buy opens retail and former Live route stays functional but is not a sixth visible button', () => {
  assert.match(tabs, /<Tab\.Screen name="Search" component=\{SearchScreen\} \/>/);
  assert.match(tabs, /<Tab\.Screen name="Live" component=\{LiveScreen\} \/>/);
  assert.match(search, /navigation\.navigate\('Tabs', \{ screen: 'Live' \}\)/);
  assert.match(drawer, /id: 'buy-retail'.*tabName: 'Search'/);
  assert.match(drawer, /id: 'buy-auctions'.*tabName: 'Live'/);
  assert.match(tabs, /route\.name === 'Search' && state\.routes\[state\.index\]\?\.name === 'Live'/);
  assert.match(tabs, /if \(!isFocused && !event\.defaultPrevented\)/);
  assert.match(tabs, /navigation\.navigate\(route\.name\)/);
});

test('Sell button opens actual native selling screen with auction and £1 retail listing', () => {
  assert.match(tabs, /Sell: undefined;/);
  assert.match(landing, /const startListing = \(listingType: RouteSellingMode\)/);
  assert.match(landing, /navigation\.navigate\('SellCarFlow', \{/);
  assert.match(landing, /onPress=\{\(\)=>startListing\('AUCTION'\)\}/);
  assert.match(landing, /onPress=\{\(\)=>startListing\('CLASSIFIED'\)\}/);
  assert.match(landing, /Get My Free Valuation/);
  assert.match(landing, /£0 listing fee/);
  assert.match(landing, /£1 Retail Listing/);
  assert.match(landing, /page:\{paddingTop:16,paddingHorizontal:20,paddingBottom:110/);
  assert.match(main, /<Stack\.Screen\s+name="SellCarFlow"/);
});

test('Saved and Dashboard remain personal and business-role aware', () => {
  assert.match(tabs, /<Tab\.Screen name="Saved" component=\{SavedScreen\} \/>/);
  assert.match(tabs, /<Tab\.Screen name="Profile" component=\{ProfileTabScreen\} \/>/);
  assert.match(tabs, /if \(role === 'buyer'\) return <BuyerDashboardScreen/);
  assert.match(tabs, /if \(role === 'dealer'\) return <DealerProfileScreen/);
  assert.match(tabs, /if \(accountRole === 'contractor'\)/);
  assert.match(tabs, /if \(accountRole === 'finance_partner' \|\| accountRole === 'insurance_partner'\)/);
});

test('dealer bottom workspace routes and backend-independent staff gates are unchanged', () => {
  assert.match(tabs, /if \(!route\.name\.startsWith\('Dealer'\)\) return false/);
  for (const [route,component,permission] of [
    ['DealerHome','DealerProfileScreen',null],
    ['DealerStock','GatedDealerStockTab','VIEW_INVENTORY'],
    ['DealerCustomers','GatedDealerCustomersTab','MANAGE_CRM'],
    ['DealerBuyBid','GatedDealerBuyBidTab','VIEW_TRADE'],
    ['DealerMore','GatedDealerMoreTab',null],
  ]) {
    assert.ok(tabs.includes(`<Tab.Screen name="${route}" component={${component}} />`), route);
    if (permission) assert.ok(tabs.includes(`hasPermission('${permission}')`), permission);
  }
  assert.match(tabs, /const GatedDealerMoreTab = withDealerGate\(DealerMoreScreen\);/);
  assert.doesNotMatch(tabs, /else openDrawer\(\)/);
  assert.match(tabs, /route\.name === 'DealerMore' \? 'Opens dealer business tools, not the main Menu'/);
  assert.match(tabs, /name: 'DealerMore'.*icon: 'apps-outline'/);
  assert.match(tabs, /getBottomTabItemHeight\(fontScale\)/);
  assert.match(tabs, /paddingBottom: insets\.bottom/);
});

test('navigation remains accessible and simple menu does not duplicate bottom tab selling destinations', () => {
  assert.match(tabs, /accessibilityRole="tab"/);
  assert.match(tabs, /route\.name === 'DealerMore'[\s\S]*?'Dealer tools'[\s\S]*?config\.label === 'DASHBOARD' \? 'Dashboard' : config\.label/);
  assert.match(tabs, /numberOfLines=\{2\}/);
  assert.match(drawer, /MAIN_MENU\.map\(item =>/);
  assert.match(drawer, /id: 'sell-auction'/);
  assert.match(drawer, /id: 'sell-retail'/);
  assert.match(drawer, /id: 'dashboard'.*tabName: 'Profile'/);
});
