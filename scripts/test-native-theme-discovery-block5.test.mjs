#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../carmazium app/carmazium app/src/' + path, import.meta.url), 'utf8');
const home = source('screens/main/HomeScreen.tsx');
const search = source('screens/main/SearchScreen.tsx');
const live = source('screens/main/LiveScreen.tsx');
const card = source('components/VehicleCard.tsx');
const horizontal = source('components/HorizontalVehicleCard.tsx');
const auction = source('components/LiveBidCard.tsx');
const specs = source('components/SpecBadge.tsx');
const chips = source('components/AuctionCardBadges.tsx');
const settings = source('screens/main/SettingsScreen.tsx');

test('home screen uses semantic website surfaces for selling hero, retail/auction rails and search', () => {
  assert.match(home, /function useHomeDiscoveryStyles\(\)/);
  for (const key of ['container','greetingLine','greetingDetail','buyJourneyBtn','buyJourneyText',
    'searchBar','searchInput','sectionTitle','auctionCard','listingCard','cardTitle','cardPrice',
    'cardSpecs','recentCard','recentTitle','recentPrice','sellCtaTitle','secondaryRows',
    'bodyTypeCard','bodyTypeLabel','emptyStateText']) {
    assert.match(home, new RegExp(key + ': \\[s\\.' + key + ', \\{ '), key);
  }
  assert.match(home, /barStyle=\{resolvedAppearance === "dark" \? "light-content" : "dark-content"\}/);
  assert.match(home, /placeholderTextColor=\{palette\.textMuted\}/);
  assert.match(home, /<Text style=\{themed\.greetingLine\}>Sell your car<\/Text>/);
});

test('homepage saved-car/watchlist subscriptions and horizontal list remain real data, not themed selectors', () => {
  assert.match(home, /useWatchlistStore\(\(state\) => state\.savedIds\.has\(listing\.id\)\)/);
  assert.match(home, /useWatchlistStore\(\(state\) => state\.toggle\)/);
  assert.match(home, /useAuthStore\(\(state\) => state\.role\)/);
  assert.match(home, /const renderLiveAuction = useCallback<ListRenderItem<AuctionDetail>>/);
  assert.match(home, /function Rail<T>/);
  const rail = home.slice(home.indexOf('function Rail<T>'),home.indexOf('// ─── Section wrapper'));
  assert.doesNotMatch(rail, /themed\./);
  assert.match(rail, /<FlatList/);
  assert.doesNotMatch(home, /=> themed\.savedIds|=> themed\.role|=> themed\.toggle/);
});

test('buyer Search changes appearance without changing make/transmission/AI filter logic', () => {
  assert.match(search, /function useSearchDiscoveryStyles\(\)/);
  for (const key of ['container','headerTitle','auctionBrowseBanner','searchBar','searchInput',
   'quickChip','quickChipText','sortBtn','filterBtn','modalFooter','modalTitle','filterChip',
   'filterChipText','inputBox','inputBoxValue','makeSearchBox','aiModalInput','toggleLabel']) {
    assert.match(search, new RegExp(key + ': \\[s\\.' + key + ', \\{ '), key);
  }
  assert.match(search, /SORT_OPTIONS\.find\(option => option\.id === sortId\)/);
  assert.match(search, /if \(p\.aiFilters\) \{/);
  assert.match(search, /FUEL_MAP/);
  assert.match(search, /onPress=\{resetFilters\}/);
  assert.match(search, /barStyle=\{resolvedAppearance === "dark" \? "light-content" : "dark-content"\}/);
  assert.match(search, /palette\.bgBody\]\}/);
  assert.doesNotMatch(search, /SORT_OPTIONS\.find\(s => themed\./);
});

test('Live Auctions uses current mode on discovery surfaces but preserves dealer bidding gates', () => {
  assert.match(live, /function useLiveDiscoveryStyles\(\)/);
  for(const key of ['container','headerTitle','sectionTitle','searchBar','searchInput',
    'filterBtn','auctionCard','statsRow','statsPrice','upcomingItem','upcomingCarName',
    'emptyUpcoming','bidNowBtnOwn']){
    assert.match(live,new RegExp(key + ': \\[styles\\.' + key + ', \\{ '),key);
  }
  assert.match(live, /backgroundColor: palette\.bgInput, borderColor: palette\.borderDefault/);
  assert.match(live, /const canPlaceDealerBid = !dealerMode \|\| \(!accessLoading && hasPermission\('PLACE_BID'\)\)/);
  assert.match(live, /const isOwnAuction = !!currentUser\?\.id && auction\.seller\?\.id === currentUser\.id/);
  assert.match(live, /getAuctionFirstOfferFloor\(auction\.startingBid, auction\.reserve\)/);
  assert.match(live, /barStyle=\{resolvedAppearance === "dark" \? "light-content" : "dark-content"\}/);
});

test('vehicle grid/list and auction cards show readable title, price, metadata and keep lightbox', () => {
  for (const v of [card, horizontal, auction]) {
    assert.match(v, /useNativeAppearance\(\)/);
    assert.match(v, /backgroundColor: palette\.bgCard, borderColor: palette\.borderDefault/);
    assert.match(v, /color: palette\.textPrimary/);
    assert.match(v, /color: palette\.textSecondary/);
    assert.match(v, /<ImageCarousel/);
  }
  assert.match(card, /<SpecBadge icon="settings-outline" value=\{\`Gearbox:/);
  assert.match(card, /<ImageLightbox/);
  assert.match(horizontal, /Gearbox: \$\{listing\.transmission \|\| 'Not specified'\}/);
  assert.match(horizontal, /<ImageLightbox/);
  assert.match(auction, /getAuctionFirstOfferFloor\(auction\.startingBid, auction\.reserve\)/);
  assert.match(auction, /<AuctionCardChips/);
});

test('auction and spec badges use theme palette while keeping all real transmission and trust distinctions', () => {
  assert.match(specs, /useNativeAppearance\(\)/);
  assert.match(specs, /palette\.bgInput, borderColor: palette\.borderDefault/);
  assert.match(chips, /useNativeAppearance\(\)/);
  assert.match(chips, /palette\.bgInput, borderColor: palette\.borderDefault/);
  assert.match(chips, /Gearbox: \$\{formatTransmission\(transmission\)\}/);
  assert.match(chips, /trustEligible = badgeTier === 'STANDARD' \|\| badgeTier === 'PREMIUM'/);
});

test('Appearance picker is not enabled in Block 5, and production binary release still gated', () => {
  assert.match(settings, /A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(settings, /setAppearancePreference\(/);
});
