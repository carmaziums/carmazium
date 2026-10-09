#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mobile = file => readFileSync(resolve(root, 'carmazium app/carmazium app', file), 'utf8');
const backend = file => readFileSync(resolve(root, 'backend', file), 'utf8');

test('seller and dealer inventory read every page including sold status', () => {
  const shared = mobile('src/lib/myListingsApi.ts');
  assert.ok(shared.includes('page=${page}&limit=${PAGE_SIZE}&includeSold=true'));
  assert.ok(shared.includes('response.pagination?.totalPages'));
  assert.ok(shared.includes('seen.size !== Number(response.pagination.total)'));
  assert.ok(shared.includes('throw new Error('));
  const dealer = mobile('src/screens/main/DealerInventoryScreen.tsx');
  const seller = mobile('src/screens/seller/SellerListingsScreen.tsx');
  const dashboard = mobile('src/screens/sell/MyListingDashboardScreen.tsx');
  for (const screen of [dealer, seller, dashboard]) {
    assert.ok(screen.includes('fetchAllMyListings'), 'Missing all-pages loader');
  }
  assert.doesNotMatch(dealer, /listings\/my\?page=1&limit=50/);
  assert.doesNotMatch(seller, /listings\/my\?page=1&limit=50/);
  assert.doesNotMatch(dashboard, /listings\/my\?page=1&limit=20/);
  assert.ok(backend('src/listings/listings.service.ts').includes('if (!filterDto?.includeSold)'));
});

test('dealer editing routes into existing listing wizard; no fake save actions', () => {
  const screen = mobile('src/screens/main/DealerInventoryScreen.tsx');
  assert.ok(screen.includes("navigation?.navigate('SellCarFlow', { listingId: listing.id })"));
  assert.ok(screen.includes('if (!canManageInventory) return;'));
  assert.ok(screen.includes('onPress={handleEditListing}'));
  assert.doesNotMatch(screen, /onPress: \(\) => \{\}/);
  assert.doesNotMatch(screen, /setOffersStatus\(/);
  assert.ok(screen.includes('No offers yet'));
  assert.ok(screen.includes('Listing status'));
  assert.doesNotMatch(screen, /Edit visibility/);
  // The wizard uses the actual authorized update path, not a local-only edit.
  const wizard = mobile('src/screens/sell/SellCarFlowScreen.tsx');
  assert.ok(wizard.includes('if (editMode && editListingId)'));
  assert.ok(wizard.includes('method: \'PATCH\''));
});

test('loading failures cannot masquerade as a legitimately empty inventory', () => {
  const seller = mobile('src/screens/seller/SellerListingsScreen.tsx');
  const dashboard = mobile('src/screens/sell/MyListingDashboardScreen.tsx');
  assert.ok(seller.includes('<ErrorBanner message={fetchError} onRetry='));
  assert.ok(seller.includes('ListEmptyComponent={fetchError ? null : renderEmpty}'));
  assert.ok(dashboard.includes('loadError && listings.length === 0'));
  assert.ok(dashboard.includes('<ErrorBanner message={loadError} onRetry='));
});

test('saved auctions resolve through dealer-authorised shortlist, never retail details', () => {
  const watchlist = mobile('src/lib/watchlistApi.ts');
  const saved = mobile('src/screens/main/SavedScreen.tsx');
  const auction = mobile('src/lib/auctionApi.ts');
  const controller = backend('src/watchlist/watchlist.controller.ts');
  assert.ok(controller.includes("@Get('auctions')"));
  assert.ok(controller.includes('VerifiedDealerGuard'));
  assert.ok(watchlist.includes('/watchlist/auctions?page=${page}&limit=50&view=all'));
  assert.ok(saved.includes("if (listing.listingType === 'AUCTION')"));
  assert.ok(saved.includes("accountRole !== 'dealer'"));
  assert.ok(saved.includes('getSavedAuctionIdForListing(listing.id)'));
  assert.ok(saved.includes("navigation.navigate('AuctionDeepLink', { auctionId })"));
  assert.ok(auction.includes("listingType: 'AUCTION'"));
  assert.ok(auction.includes('auction: { id: a.id, status: a.status, endTime: a.endTime }'));
});

test('failed watchlist reads cannot clear previously saved vehicles', () => {
  const listApi = mobile('src/lib/watchlistApi.ts');
  const state = mobile('src/store/watchlistStore.ts');
  assert.ok(listApi.includes("throw new Error('Could not load your saved cars.')"));
  const getWatchlistBody = listApi.split('export async function getWatchlist(')[1]?.split('export async function getSavedAuctionIdForListing')[0];
  assert.ok(getWatchlistBody);
  assert.doesNotMatch(getWatchlistBody, /catch\s*\{/);
  assert.ok(state.includes('// Keep existing state on network failure'));
});
