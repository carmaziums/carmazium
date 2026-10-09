#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const readMobile = path => readFileSync(resolve(root, 'carmazium app/carmazium app', path), 'utf8');
const readBackend = path => readFileSync(resolve(root, 'backend', path), 'utf8');

test('auction bidders must enter a monetary amount and explicitly confirm', () => {
  const auction = readMobile('src/screens/vehicle/AuctionDetailScreen.tsx');
  assert.ok(auction.includes('Confirm your auction bid'));
  assert.ok(auction.includes('Confirm Bid'));
  assert.ok(auction.includes('Review Amount'));
  assert.ok(auction.includes('£125 platform fee'));
  assert.ok(auction.includes('bidConfirmPendingRef.current = true'));
  assert.ok(auction.includes('bidSubmissionInFlightRef.current = true'));
  assert.ok(auction.includes('bidSubmissionInFlightRef.current = false'));
  assert.ok(auction.includes('handleBid(bidAmount)'));
  assert.ok(auction.includes('onSubmitEditing={() => Keyboard.dismiss()}'));
  assert.ok(auction.includes('auction.status !== \'ACTIVE\''));
  assert.ok(auction.includes('auction.listing.sellerId === businessUserId'));
  assert.ok(auction.includes('setBidError(\'Enter a valid bid amount in pounds'));
  assert.ok(auction.includes(String.raw`/^\d+(?:\.\d{1,2})?$/`));
  assert.doesNotMatch(auction, /Number\(bidAmount\) \|\| minimumAllowedBid/);
  assert.ok(auction.includes('await placeBid(auction.listingId, parsed)'));
  assert.ok(auction.includes('loadAuctionRef.current({ silent: true })'));
});

test('backend remains final authority on verified dealers, minimum bids and own-auction blocks', () => {
  const bids = readBackend('src/bids/bids.service.ts');
  const controller = readBackend('src/auctions/auctions.controller.ts');
  assert.ok(bids.includes('Only verified dealers can place bids'));
  assert.ok(bids.includes('OWN_AUCTION'));
  assert.ok(bids.includes('BID_TOO_LOW'));
  assert.ok(controller.includes('VerifiedDealerGuard'));
});

test('seller listing checkout/publication cannot double-submit and scheduled date is parsed consistently', () => {
  const sell = readMobile('src/screens/sell/SellCarFlowScreen.tsx');
  assert.ok(sell.includes('const publishingInFlightRef = useRef(false)'));
  assert.ok(sell.includes('if (publishingInFlightRef.current) return'));
  assert.ok(sell.includes('publishingInFlightRef.current = true'));
  assert.ok(sell.includes('publishingInFlightRef.current = false'));
  assert.ok(sell.includes('parseNativeAuctionLocalStart(auctionStartDate)'));
  assert.ok(sell.includes('nativeScheduledStartIsValid(auctionStartDate)'));
  assert.ok(sell.includes('auctionPayload.startTime = parsedStart.toISOString()'));
  assert.doesNotMatch(sell, /auctionPayload\.startTime = new Date\(auctionStartDate\)\.toISOString\(\)/);
  assert.ok(sell.includes('allImages.length < MIN_PHOTOS'));
});

test('dealer live auctions handle API errors and load the entire scheduled catalogue', () => {
  const live = readMobile('src/screens/main/LiveScreen.tsx');
  const api = readMobile('src/lib/auctionApi.ts');
  assert.ok(live.includes('getAllScheduledAuctions()'));
  assert.ok(live.includes("listingType: 'AUCTION'"));
  assert.ok(live.includes('auction: { id: a.id, status: a.status, endTime: a.endTime }'));
  assert.ok(live.includes('auction: { id: auc.id, status: auc.status, endTime: auc.endTime }'));
  assert.doesNotMatch(live, /LOT \{String\(idx \+ 6\)/);
  assert.ok(live.includes('Promise.all(['));
  assert.ok(live.includes('useFocusEffect(useCallback(() => {'));
  assert.ok(live.includes('void fetchData();'));
  assert.ok(api.includes("throw new Error('Could not load live auctions.')"));
  assert.ok(live.includes('auctionLoadError'));
  assert.ok(live.includes('<ErrorBanner message={auctionLoadError}'));
  assert.ok(live.includes('filteredActive.length === 0 && !auctionLoadError'));
  assert.doesNotMatch(live, /getScheduledAuctions\(1, 20\)/);
  assert.ok(api.includes('export async function getAllScheduledAuctions()'));
  assert.ok(api.includes('getScheduledAuctions(page, pageSize)'));
  assert.ok(api.includes('expectedTotal !== total'));
  assert.ok(api.includes('found.size === total'));
  assert.ok(api.includes('maxPages = 40'));
});
