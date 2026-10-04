/**
 * Block 3 cross-client Saved Cars HTTP/Prisma acceptance.
 *
 * This test-only runner uses the *already seeded* disposable PostgreSQL
 * container from radius-postgres-ci.yml. Production authentication itself
 * is not emulated: a TEST-ONLY header-to-user guard simulates two separately
 * authenticated sessions while the real Nest controller, Prisma service,
 * database constraints and response serialization execute.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { WatchlistController } from '../src/watchlist/watchlist.controller';
import { WatchlistService } from '../src/watchlist/watchlist.service';
import { SessionAuthGuard } from '../src/auth/guards/session-auth.guard';
import { VerifiedDealerGuard } from '../src/auth/guards/verified-dealer.guard';
const http = require('supertest') as typeof import('supertest');

const url = new URL(process.env.DATABASE_URL || 'postgresql://missing/missing');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/carmazium_radius_ci' ||
    process.env.RADIUS_LOAD_TEST !== 'ephemeral-postgres-only') {
  throw new Error('REFUSED: cross-client watchlist acceptance requires ephemeral loopback PostgreSQL');
}
const prisma = new PrismaClient();
function assert(value: unknown, label: string): asserts value {
  if (!value) throw Error('CROSS_CLIENT_WATCHLIST_FAILURE: ' + label);
}
const alice = randomUUID(), bob = randomUUID();
const identities = new Map([['web-alice', alice], ['mobile-alice', alice],
  ['web-bob', bob], ['mobile-bob', bob]]);
const requestLog: Array<Record<string, unknown>> = [];

async function acceptance() {
  const listings = await prisma.listing.findMany({
    where: { type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null,
      latitude: { not: null }, longitude: { not: null } },
    select: { id: true, make: true, model: true, transmission: true,
      fuelType: true, latitude: true, longitude: true, location: true },
    orderBy: { id: 'asc' }, take: 28,
  });
  assert(listings.length >= 27, 'radius seed must provide >=27 suitable retail vehicles');
  const matched = listings.slice(0, 26);
  await prisma.user.createMany({ data: [
    { id: alice, email: 'web-mobile-alice@example.invalid', passwordHash: 'synthetic-only', role: 'BUYER' },
    { id: bob, email: 'web-mobile-bob@example.invalid', passwordHash: 'synthetic-only', role: 'BUYER' },
  ]});

  // This guard exists only inside an in-memory Nest test module; it does NOT
  // add a test-header backdoor to the actual application or modify the real
  // production SessionAuthGuard.
  const testIdentityGuard = {
    canActivate: (ctx: any) => {
      const req = ctx.switchToHttp().getRequest();
      const userId = identities.get(req.headers['x-ephemeral-test-client']);
      if (!userId) throw new UnauthorizedException('Test client not authenticated');
      req.user = { id: userId, role: 'BUYER' };
      return true;
    },
  };
  const module = await Test.createTestingModule({
    controllers: [WatchlistController],
    providers: [{ provide: WatchlistService,
      useValue: new WatchlistService(prisma as any) }],
  }).overrideGuard(SessionAuthGuard).useValue(testIdentityGuard)
    .overrideGuard(VerifiedDealerGuard).useValue({
      canActivate: () => false,
    }).compile();
  const app = module.createNestApplication();
  await app.init();
  const request = http(app.getHttpServer());
  const browser = (method: 'get' | 'post' | 'delete', path: string) =>
    request[method](path).set('x-ephemeral-test-client', 'web-alice');
  const mobile = (method: 'get' | 'post' | 'delete', path: string) =>
    request[method](path).set('x-ephemeral-test-client', 'mobile-alice');
  const bobMobile = (method: 'get' | 'post' | 'delete', path: string) =>
    request[method](path).set('x-ephemeral-test-client', 'mobile-bob');
  let cases = 0;
  try {
    // Every watchlist entry point requires a real account context.
    for (const [method, path] of [
      ['get', '/watchlist'] as const,
      ['post', '/watchlist/' + matched[0].id] as const,
      ['delete', '/watchlist/' + matched[0].id] as const,
    ]) {
      const res = await request[method](path);
      assert(res.status === HttpStatus.UNAUTHORIZED, 'anonymous ' + method + ' watchlist must be 401');
      cases++;
    }

    // The website saves one car and the native client immediately sees it
    // from the same account without storing/duplicating a device-only copy.
    const saved = await browser('post', '/watchlist/' + matched[0].id);
    assert(saved.status === 201, 'website must save vehicle successfully');
    const onPhone = await mobile('get', '/watchlist').query({ page: 1, limit: 50 });
    assert(onPhone.status === 200 && onPhone.body.pagination.total === 1,
      'native read after web save must see exactly one backend row');
    assert(onPhone.body.data[0]?.listingId === matched[0].id,
      'same-account native list must match web-saved listing');
    const projection = onPhone.body.data[0]?.listing;
    assert(projection && projection.make === matched[0].make,
      'saved vehicle make consistent');
    for (const field of ['fuelType', 'transmission', 'bodyType', 'color',
      'location', 'latitude', 'longitude']) {
      assert(Object.hasOwn(projection, field), 'native mapping field omitted from shared backend projection: ' + field);
    }
    assert(projection.latitude === matched[0].latitude &&
      projection.longitude === matched[0].longitude,
      'saved car coordinates must match initial search result');
    const bytes = JSON.stringify(onPhone.body);
    for (const privateField of ['passwordHash', 'bankAccountNumber', 'bankSortCode',
      'priceMin', 'priceMax', 'PRIVATE_BANK', 'synthetic-only']) {
      assert(!bytes.includes(privateField), 'private field in shared Saved Cars response: ' + privateField);
    }
    cases++;

    // Different user must not see, delete or acquire a saved vehicle merely
    // because its ID is known. Each user can save the *same* retail listing.
    const otherAccount = await bobMobile('get', '/watchlist').query({ page: 1, limit: 50 });
    assert(otherAccount.status === 200 && otherAccount.body.pagination.total === 0,
      'different buyer must have own empty watchlist');
    const forbiddenDelete = await bobMobile('delete', '/watchlist/' + matched[0].id);
    assert(forbiddenDelete.status === 404,
      'different account cannot remove Alice watchlist item');
    const bobSave = await bobMobile('post', '/watchlist/' + matched[0].id);
    assert(bobSave.status === 201, 'another buyer may independently save same retail vehicle');
    cases++;

    // Idempotency: web and mobile cannot create duplicate saved rows for the
    // same account when they click the heart within the same interval.
    const dupe = await mobile('post', '/watchlist/' + matched[0].id);
    assert(dupe.status === 409, 'duplicate save must be 409 rather than extra row');
    assert((await browser('get', '/watchlist/count')).body.data.count === 1,
      'duplicate write did not change Alice count');
    cases++;

    // Fill >2 website pages; native fetches the complete 50-item page and
    // confirms the exact same 26 unique IDs.
    for (const row of matched.slice(1)) {
      const result = await browser('post', '/watchlist/' + row.id);
      assert(result.status === 201, 'save one of 26 synthetic retail rows');
    }
    const nativeAll = await mobile('get', '/watchlist').query({ page: 1, limit: 50 });
    assert(nativeAll.status === 200 && nativeAll.body.pagination.total === 26,
      'native complete refresh should see all 26 website-created saves');
    assert(new Set(nativeAll.body.data.map((x: any) => x.listingId)).size === 26,
      'native complete refresh duplicate item');
    const webPages = [];
    for (const page of [1, 2, 3]) {
      const res = await browser('get', '/watchlist').query({ page, limit: 12 });
      assert(res.status === 200 && res.body.pagination.total === 26,
        'web page ' + page + ' must retain same total');
      webPages.push(...res.body.data.map((x: any) => x.listingId));
    }
    assert(webPages.length === 26 &&
      new Set(webPages).size === 26 &&
      new Set(webPages).size === new Set(nativeAll.body.data.map((x: any) => x.listingId)).size,
      'website paginated IDs equal native complete refresh');
    for (const id of webPages) {
      assert(nativeAll.body.data.some((x: any) => x.listingId === id),
        'web item absent from native page');
    }
    cases++;

    // Phone removal propagates immediately to the browser's next refresh;
    // Bob's saved copy remains completely unchanged.
    const remove = await mobile('delete', '/watchlist/' + matched[0].id);
    assert(remove.status === 204, 'native remove success');
    const browserRefresh = await browser('get', '/watchlist').query({ page: 1, limit: 50 });
    assert(browserRefresh.body.pagination.total === 25,
      'web refresh must immediately observe native removal');
    assert(browserRefresh.body.data.every((x: any) => x.listingId !== matched[0].id),
      'removed car remains in web');
    const bobCount = await bobMobile('get', '/watchlist/count');
    assert(bobCount.body.data.count === 1, 'Alice remove must not affect Bob');
    const statusCheck = await browser('get', '/watchlist/check/' + matched[0].id);
    assert(statusCheck.status === 200 && statusCheck.body.data.inWatchlist === false,
      'watchlist check agrees with final backend state');
    cases++;

    requestLog.push({ scenarios: cases, accountOne: '26 saved, then 25 after mobile removal',
      accountTwo: '1 independent copy', webPageSize: 12, nativePageSize: 50,
      sameBackend: true, privateFieldsExcluded: true });
    console.log('WATCHLIST_CROSS_CLIENT_POSTGRES_ACCEPTANCE', JSON.stringify(requestLog[0]));
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
void acceptance().catch(error => {
  console.error('WATCHLIST_CROSS_CLIENT_POSTGRES_FAILURE', error);
  process.exitCode = 1;
});
