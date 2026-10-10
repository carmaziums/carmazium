#!/usr/bin/env node
// Issue #477 Block 7 source regression, NOT screenshot/device certification.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..', import.meta.url)));
const read=p=>readFileSync(resolve(root,p),'utf8');
const base='carmazium app/carmazium app/src/';
const app=p=>read(base+p);
const webSell=read('src/app/sell/page.tsx');
const webSearch=read('src/app/search/page.tsx');
const landing=app('screens/sell/SellLandingScreen.tsx');
const wizard=app('screens/sell/SellCarFlowScreen.tsx');
const search=app('screens/main/SearchScreen.tsx');
const home=app('screens/main/HomeScreen.tsx');
const drawer=app('components/GlobalDrawer.tsx');
const stack=app('navigation/MainStackNavigator.tsx');
const card=app('components/HorizontalVehicleCard.tsx');
const doc=read('docs/native/website-native-visual-parity-block7-20261010.md');

test('native retail Browse uses website heading and canonical shared top bar without changing search API',()=>{
  assert.ok(webSearch.includes('Find Your Perfect Car'));
  assert.ok(search.includes('Find Your Perfect Car'));
  assert.ok(search.includes('<WebsiteTopBar />'));
  assert.ok(search.includes('vehicles available'));
  assert.ok(search.includes('Browse Live Auctions'));
  assert.ok(search.includes("navigation.navigate('Tabs', { screen: 'Live' })"));
  assert.ok(search.includes('searchListings('));
  assert.ok(search.includes('<HorizontalVehicleCard'));
  assert.ok(search.includes('setSelectedMakes'));
  assert.ok(search.includes('setTransmissions'));
  assert.ok(!search.includes("total > 0 ? `${total.toLocaleString('en-GB')} listings`"));
});

test('actual market vehicle cards expose photo, truthfully unknown gearbox, mileage and price',()=>{
  for(const item of ['ImageCarousel','listing.images','Gearbox:','Not specified',
    'formatMileage(listing.mileage)','listing.fuelType','formatPrice(listing.price)','ImageLightbox']){
    assert.ok(card.includes(item),item);
  }
  assert.ok(webSearch.includes('Transmission'));
  assert.ok(webSearch.includes('Mileage (miles)'));
});

test('Sell starts with web-equivalent valuation then free dealer auction or £1 retail',()=>{
  for(const text of ['Sell Your Car Online','FREE Valuation','FREE Auction','£1 Retail',
    'FREE Dealer Auction','£1 Retail Listing','Current Market Value']){
    assert.ok(landing.includes(text),'native '+text);
  }
  assert.ok(webSell.includes('QuickValuationForm'));
  assert.ok(webSell.includes('Get My Free Valuation'));
  assert.ok(webSell.includes('FREE Dealer Auction'));
  assert.ok(webSell.includes('£1 Retail Listing'));
  assert.ok(landing.includes('getVehicleValuation('));
  assert.ok(landing.includes('Number.isFinite(answer.auction.marketValue)'));
  assert.ok(landing.includes('answer.auction.marketValue <= 0'));
  assert.ok(landing.includes('guide-only') || landing.includes('Guide only'));
  assert.ok(landing.includes("registration: vrm || undefined"));
});

test('registration and manual model validation preserve privacy and stale-response protection',()=>{
  assert.ok(landing.includes("'/dvla/lookup'"));
  assert.ok(landing.includes('allowAiEnrichment: false'));
  assert.ok(landing.includes('requestId.current += 1;'));
  assert.ok(landing.includes('if (id !== requestId.current) return'));
  assert.ok(landing.includes("setMake(''); setModel(''); setYear(''); setTransmission('');"));
  assert.ok(landing.includes('Enter its actual model'));
  assert.ok(landing.includes('validYear(year)'));
  assert.ok(landing.includes('Number.isSafeInteger(cleanMileage)'));
});

test('all public sell entry points use landing but keep existing validated wizard',()=>{
  assert.ok(stack.includes('SellLanding: undefined;'));
  assert.ok(stack.includes('name="SellLanding" component={SellLandingScreen}'));
  assert.ok(stack.includes('SellCarFlow: { listingId?: string; listingType?:'));
  assert.ok(home.includes("navigation.navigate('SellLanding')"));
  assert.ok(!home.includes("navigation.navigate('SellCarFlow')"));
  assert.ok(drawer.includes("stackScreen: 'SellLanding'"));
  assert.ok(landing.includes("navigation.navigate('SellCarFlow',"));
  assert.ok(landing.includes("startListing('AUCTION')"));
  assert.ok(landing.includes("startListing('CLASSIFIED')"));
  assert.ok(wizard.includes("route?.params?.listingType"));
  assert.ok(wizard.includes("route?.params?.prefill"));
  assert.ok(wizard.includes('editListingId ? undefined : route?.params?.prefill'));
  assert.ok(wizard.includes('getVehicleValuation('));
  assert.ok(wizard.includes('nativeAuctionDraftReady'));
  assert.ok(wizard.includes('presentPaymentSheet'));
  assert.ok(!landing.includes("'/listings'"), 'landing must not publish/create listing');
  assert.ok(!landing.includes('presentPaymentSheet'), 'landing must not charge');
});

test('Block 7 evidence honestly marks visuals unverified and permits isolated rollback',()=>{
  for(const s of ['PR #476','PR #478','PR #479','PR #480','PR #481','PR #482','PR #483',
    '360×800','390×844','VISUAL SIGN-OFF: PENDING','synthetic','Revert only Block 7','STOP at 70%']){
    assert.ok(doc.includes(s),s);
  }
});
