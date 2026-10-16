/**
 * Disposable PostgreSQL acceptance for issue #428.
 * Runs only against a loopback database created by GitHub Actions.
 * Authentication identities are test-only request headers inside this Nest
 * module; production SessionAuthGuard/VerifiedDealerGuard code is untouched.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WatchlistController } from '../src/watchlist/watchlist.controller';
import { WatchlistService } from '../src/watchlist/watchlist.service';
import { SessionAuthGuard } from '../src/auth/guards/session-auth.guard';
import { VerifiedDealerGuard } from '../src/auth/guards/verified-dealer.guard';
const http = require('supertest') as typeof import('supertest');

const db = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (!['127.0.0.1', 'localhost'].includes(db.hostname) ||
    db.pathname !== '/carmazium_watchlist_boundary_ci' ||
    process.env.WATCHLIST_BOUNDARY_TEST !== 'ephemeral-postgres-only') {
  throw new Error('REFUSED: watchlist boundary test requires disposable loopback PostgreSQL');
}
const prisma = new PrismaClient();
const buyerId = randomUUID();
const dealerId = randomUUID();
const retailId = randomUUID();
const auctionListingId = randomUUID();

function assert(value: unknown, label: string): asserts value {
  if (!value) throw new Error('WATCHLIST_BOUNDARY_FAILURE: ' + label);
}

async function seed() {
  assert(await prisma.watchlistItem.count() === 0, 'test database must start empty');
  await prisma.user.createMany({
    data: [
      { id: buyerId, email: 'retail-buyer@example.invalid', passwordHash: 'synthetic', role: 'BUYER' },
      { id: dealerId, email: 'verified-dealer@example.invalid', passwordHash: 'synthetic', role: 'DEALER' },
    ],
  });
  await prisma.listing.createMany({
    data: [
      {
        id: retailId, title: 'Synthetic Retail Car', slug: 'synthetic-retail-' + retailId,
        price: 9000, images: [], videoUrls: [], type: 'CLASSIFIED', status: 'ACTIVE',
        make: 'Toyota', model: 'Yaris', year: 2022, mileage: 20000,
      },
      {
        id: auctionListingId, title: 'Synthetic Trade Auction', slug: 'synthetic-auction-' + auctionListingId,
        price: 8000, images: [], videoUrls: [], type: 'AUCTION', status: 'ACTIVE',
        make: 'Honda', model: 'Jazz', year: 2021, mileage: 30000,
      },
    ],
  });
  await prisma.auction.create({
    data: {
      listingId: auctionListingId,
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 3_600_000),
      reservePrice: 7000,
      startingBid: 5000,
      minIncrement: 100,
      status: 'ACTIVE',
    },
  });
}

async function main() {
  await seed();
  const service = new WatchlistService(prisma as any);
  const identities = new Map([
    ['buyer', { id: buyerId, role: 'BUYER' }],
    ['dealer', { id: dealerId, role: 'DEALER' }],
  ]);
  const sessionGuard = {
    canActivate(ctx: any) {
      const req = ctx.switchToHttp().getRequest();
      const identity = identities.get(String(req.headers['x-test-user']));
      if (!identity) throw new UnauthorizedException('Synthetic client not authenticated');
      req.user = identity;
      return true;
    },
  };
  const dealerGuard = {
    canActivate(ctx: any) {
      const req = ctx.switchToHttp().getRequest();
      return req.headers['x-test-user'] === 'dealer';
    },
  };
  const module = await Test.createTestingModule({
    controllers: [WatchlistController],
    providers: [{ provide: WatchlistService, useValue: service }],
  })
    .overrideGuard(SessionAuthGuard).useValue(sessionGuard)
    .overrideGuard(VerifiedDealerGuard).useValue(dealerGuard)
    .compile();
  const app = module.createNestApplication();
  await app.init();
  const request = http(app.getHttpServer());
  const buyer = (method: 'get'|'post'|'delete', url: string) =>
    request[method](url).set('x-test-user', 'buyer');
  const dealer = (method: 'get'|'post'|'delete', url: string) =>
    request[method](url).set('x-test-user', 'dealer');
  let scenarios = 0;
  try {
    // Retail still works.
    assert((await buyer('post', '/watchlist/' + retailId)).status === 201,
      'buyer saves active classified');
    const retail = await buyer('get', '/watchlist').query({ page: 1, limit: 20 });
    assert(retail.status === 200 && retail.body.pagination.total === 1,
      'buyer retail watchlist returns one row');
    assert(retail.body.data[0].listingId === retailId &&
      retail.body.data[0].listing.type === 'CLASSIFIED',
      'generic watchlist is classified');
    scenarios++;

    // Known trade ID cannot be saved through generic retail mutation.
    const buyerAuctionSave = await buyer('post', '/watchlist/' + auctionListingId);
    assert(buyerAuctionSave.status === 404,
      'buyer generic auction POST must not reveal/save trade listing');
    scenarios++;

    // Even a verified dealer cannot use generic POST to bypass the explicit
    // trade endpoint. This keeps API semantics unambiguous.
    assert((await dealer('post', '/watchlist/' + auctionListingId)).status === 404,
      'dealer generic auction POST must be retail-only');
    scenarios++;

    // Seed a legacy auction watchlist row under the buyer to prove generic
    // GET/count/check/delete cannot disclose or mutate it. Do not delete it:
    // preserving legacy rows is a core migration requirement.
    const legacy = await prisma.watchlistItem.create({
      data: { userId: buyerId, listingId: auctionListingId },
    });
    const hiddenList = await buyer('get', '/watchlist').query({ page: 1, limit: 20 });
    assert(hiddenList.body.pagination.total === 1 &&
      hiddenList.body.data.every((x: any) => x.listingId !== auctionListingId),
      'legacy auction row hidden from generic GET');
    const genericCount = await buyer('get', '/watchlist/count');
    assert(genericCount.body.data.count === 1, 'generic count excludes legacy auction');
    const genericCheck = await buyer('get', '/watchlist/check/' + auctionListingId);
    assert(genericCheck.body.data.inWatchlist === false, 'generic check hides legacy auction');
    assert((await buyer('delete', '/watchlist/' + auctionListingId)).status === 404,
      'generic DELETE cannot mutate legacy auction shortlist');
    assert(await prisma.watchlistItem.findUnique({ where: { id: legacy.id } }),
      'legacy auction shortlist row preserved in database');
    scenarios++;

    // Unverified buyer cannot enter the explicit dealer path.
    assert((await buyer('post', '/watchlist/auctions/' + auctionListingId)).status === 403,
      'buyer explicit auction save is forbidden');
    assert((await buyer('get', '/watchlist/auctions')).status === 403,
      'buyer explicit auction read is forbidden');
    scenarios++;

    // Verified dealer saves and reads via explicit trade endpoints.
    const tradeSave = await dealer('post', '/watchlist/auctions/' + auctionListingId);
    assert(tradeSave.status === 201, 'verified dealer explicit auction save');
    const tradeList = await dealer('get', '/watchlist/auctions')
      .query({ page: 1, limit: 12, view: 'live' });
    assert(tradeList.status === 200 && tradeList.body.pagination.total === 1,
      'verified dealer explicit shortlist returns saved auction');
    assert(tradeList.body.data[0].listingId === auctionListingId,
      'verified dealer shortlist auction identity');
    const dealerGeneric = await dealer('get', '/watchlist').query({ page: 1, limit: 20 });
    assert(dealerGeneric.body.pagination.total === 0,
      'dealer generic Saved Cars does not expose trade shortlist');
    scenarios++;

    // Trade endpoint refuses retail IDs and dedicated delete preserves clean split.
    assert((await dealer('post', '/watchlist/auctions/' + retailId)).status === 404,
      'trade mutation refuses classified listing');
    assert((await dealer('delete', '/watchlist/auctions/' + auctionListingId)).status === 204,
      'verified dealer dedicated auction removal');
    const after = await dealer('get', '/watchlist/auctions')
      .query({ page: 1, limit: 12, view: 'all' });
    assert(after.body.pagination.total === 0, 'dealer shortlist empty after explicit delete');
    scenarios++;

    // Account separation remains intact.
    const buyerFinal = await buyer('get', '/watchlist').query({ page: 1, limit: 20 });
    assert(buyerFinal.body.pagination.total === 1 &&
      buyerFinal.body.data[0].listingId === retailId,
      'retail buyer saved car unchanged by dealer operations');
    assert(await prisma.watchlistItem.findUnique({ where: { id: legacy.id } }),
      'buyer legacy trade row still retained but hidden');
    scenarios++;

    console.log('WATCHLIST_RETAIL_TRADE_BOUNDARY_ACCEPTANCE', JSON.stringify({
      scenarios,
      retailSavedCars: 'generic routes classified/public only',
      genericTradeId: '404/no disclosure/no mutation',
      unverifiedTradeRoutes: '403',
      verifiedDealer: 'explicit auction POST/GET/DELETE pass',
      legacyAuctionRows: 'preserved but hidden from retail routes',
      target: 'ephemeral-postgres-only',
    }));
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
void main().catch((error) => {
  console.error('WATCHLIST_RETAIL_TRADE_BOUNDARY_FAILED', error);
  process.exitCode = 1;
});
