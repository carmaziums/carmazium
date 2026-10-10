#!/usr/bin/env node
// Block 6 source contracts only. CI green does not prove installed app/screenshots.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=p=>readFileSync(resolve(root,p),'utf8');
const base='carmazium app/carmazium app/src/';
const app=p=>read(base+p);
const web=read('src/app/dashboard/dealer/auctions/page.tsx');
const routes=read('src/config/dealerRouteConfig.ts');
const tab=app('navigation/TabNavigator.tsx');
const hub=app('screens/main/DealerBuyBidScreen.tsx');
const other=app('screens/main/DealerAuctionBuyingSections.tsx');
const live=app('screens/main/LiveScreen.tsx');
const seller=app('screens/seller/SellerAuctionsScreen.tsx');
const stack=app('navigation/MainStackNavigator.tsx');
const doc=read('docs/native/website-native-visual-parity-block6-20261010.md');

test('dealer Buy & Bid opens the real website Auctions & Buying hub, not public Live',()=>{
  assert.ok(routes.includes('href: "/dashboard/dealer/auctions"'));
  assert.ok(routes.includes('title: "Auctions & Buying"'));
  assert.ok(web.includes('Auction and buying navigation'));
  assert.ok(tab.includes('<Tab.Screen name="DealerBuyBid" component={GatedDealerBuyBidTab} />'));
  assert.ok(tab.includes('<Tab.Screen name="Live" component={LiveScreen} />'));
  assert.ok(hub.includes("useState<Section>('mine')"));
  assert.ok(hub.includes('Auctions & Buying'));
  assert.ok(hub.includes('Live auctions, bids and purchases'));
  for(const x of ['My Auctions','Live Auctions','Shortlisted','My Bids','Purchases']){
    assert.ok(web.includes(x),'web '+x);
    assert.ok(hub.includes(x),'native '+x);
  }
  assert.ok(hub.includes('fetchAllMyAuctions<OwnedAuction>'));
  assert.ok(hub.includes("('list')"));
  assert.ok(hub.includes("status === 'ACTIVE'")&&hub.includes("status === 'SCHEDULED'"));
  assert.ok(hub.includes('sellerBonusReleased') && hub.includes('sellerFundsConfirmedAt'));
});

test('seller creation and won workflow reuse existing native authorised route/state',()=>{
  assert.ok(hub.includes("hasPermission('MANAGE_INVENTORY')"));
  assert.ok(hub.includes("hasPermission('VIEW_PURCHASES')"));
  assert.ok(hub.includes("hasPermission('PLACE_BID')"));
  assert.ok(hub.includes("navigation?.navigate('SellerAuctions', { openCreate: true })"));
  assert.ok(hub.includes("navigation?.navigate('SellerAuctions', { initialTab: 'WON' })"));
  assert.ok(stack.includes("initialTab?: 'WON'; openCreate?: boolean"));
  assert.ok(seller.includes("route.params?.initialTab === 'WON'"));
  assert.ok(seller.includes('openCreateModal()'));
  assert.ok(seller.includes("hasDealerPermission('MANAGE_INVENTORY')"));
  assert.ok(!hub.includes("navigation?.navigate('DealerPurchases')"),'won auction should not route to retail purchases');
});

test('native Live keeps all existing auction cards, filters, buyer preview and permissions',()=>{
  assert.ok(hub.includes('<LiveScreen embeddedDealerHub />'));
  assert.ok(live.includes("export const LiveScreen: React.FC<{ embeddedDealerHub?: boolean }>"));
  assert.ok(live.includes('{dealerMode && !embeddedDealerHub && <WebsiteTopBar />}'));
  assert.ok(live.includes("hasPermission('MANAGE_INVENTORY')"));
  assert.ok(live.includes("hasPermission('PLACE_BID')"));
  assert.ok(live.includes('{canCreateAuction && ('));
  assert.ok(live.includes('getActiveAuctions()'));
  assert.ok(live.includes('getAllScheduledAuctions()'));
  assert.ok(live.includes('AuctionFilterSheet'));
  assert.ok(live.includes('getAuctionFirstOfferFloor'));
});

test('auction shortlist is dealer-specific not retail Saved, with exact API and pagination',()=>{
  const website=read('src/lib/auctionShortlistApi.ts');
  assert.ok(website.includes('/watchlist/auctions?page='));
  assert.ok(other.includes('/watchlist/auctions?page=${page}&limit=12&view=${view}'));
  assert.ok(other.includes("useState<'live' | 'all'>('live')"));
  assert.ok(other.includes('setTotalPages'));
  assert.ok(other.includes('AuctionDeepLink'));
  assert.ok(hub.includes('<DealerAuctionShortlist navigation={navigation} />'));
  assert.ok(!hub.includes("navigation?.navigate('Saved')"),'dealer auction shortlist must not become retail Saved Cars');
});

test('My Bids matches web active-position endpoint, while full history remains reachable',()=>{
  const website=read('src/lib/listingApi.ts');
  assert.ok(website.includes("'/bids/my/active'"));
  assert.ok(other.includes("('/bids/my/active')"));
  assert.ok(other.includes('item.isLeading'));
  assert.ok(other.includes('item.currentHighestBid'));
  assert.ok(other.includes('Outbid / Action Needed'));
  assert.ok(other.includes('Live Auction Positions'));
  assert.ok(other.includes("navigation?.navigate('BuyerBids')"));
  assert.ok(!other.includes("method: 'POST'"), 'no new bid creation in overview');
  assert.ok(!other.includes("method: 'PATCH'"), 'no new bid cancel/payment contract in overview');
});

test('prior dealer and consumer tabs plus provenance/limits remain intact',()=>{
  for(const name of ['DealerHome','DealerStock','DealerCustomers','DealerMore','Home','Search','Live','Saved','Profile']){
    assert.ok(tab.includes('<Tab.Screen name="'+name+'"'));
  }
  for(const x of ['PR #476','PR #478','PR #479','PR #480','PR #481','PR #482',
    '360×800','390×844','VISUAL SIGN-OFF: PENDING','STOP at 60%',
    'revert','synthetic']){
    assert.ok(doc.toLowerCase().includes(x.toLowerCase()),x);
  }
});
