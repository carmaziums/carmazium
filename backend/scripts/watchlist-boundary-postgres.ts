/**
 * Isolated real PostgreSQL + NestJS HTTP acceptance of retail/trade separation.
 * CI-only: refuses any host or database except disposable loopback PostgreSQL.
 * Test-only identity middleware models independently authenticated accounts;
 * the real production VerifiedDealerGuard checks genuine test DB KYC records.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WatchlistController } from '../src/watchlist/watchlist.controller';
import { WatchlistService } from '../src/watchlist/watchlist.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionAuthGuard } from '../src/auth/guards/session-auth.guard';
import { VerifiedDealerGuard } from '../src/auth/guards/verified-dealer.guard';
const request = require('supertest') as typeof import('supertest');

const url = new URL(process.env.DATABASE_URL || 'postgresql://missing/unknown');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/carmazium_watchlist_boundary_ci' ||
    process.env.WATCHLIST_BOUNDARY_CI !== 'disposable-local-only') {
    throw Error('REFUSED: requires isolated local watchlist test database');
}
const prisma = new PrismaClient();
const ids = {
    buyer: randomUUID(), otherBuyer: randomUUID(),
    approvedDealer: randomUUID(), unverifiedDealer: randomUUID(),
    retail: randomUUID(), auction: randomUUID(),
};
const secret = 'PRIVATE_BANK_TEST_CANARY';
function assert(check: unknown, message: string): asserts check {
    if (!check) throw Error('WATCHLIST_BOUNDARY_FAILED: ' + message);
}

async function main() {
    let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>> | undefined;
    try {
        assert(await prisma.listing.count() === 0 && await prisma.user.count() === 0,
            'refusing to touch non-empty database');
        for (const [id, email, role] of [
            [ids.buyer, 'buyer@example.invalid', 'BUYER'],
            [ids.otherBuyer, 'other@example.invalid', 'BUYER'],
            [ids.approvedDealer, 'approved@example.invalid', 'DEALER'],
            [ids.unverifiedDealer, 'pending@example.invalid', 'DEALER'],
        ] as const) {
            await prisma.user.create({ data: { id, email, role, passwordHash: secret } });
        }
        await prisma.dealerProfile.createMany({ data: [
            { userId: ids.approvedDealer, companyName: 'Verified Demo Motor Trade',
                vatNumber: 'GB-TEST-111', isVerified: true },
            { userId: ids.unverifiedDealer, companyName: 'Pending Demo Motor Trade',
                vatNumber: 'GB-TEST-222', isVerified: false },
        ] });
        await prisma.listing.create({
            data: {
                id: ids.retail, slug: 'test-retail-' + ids.retail, title: 'Test retail car',
                price: 6500, images: [], videoUrls: [], make: 'Honda',
                type: 'CLASSIFIED', status: 'ACTIVE', sellerId: ids.otherBuyer,
                priceMin: 100, priceMax: 999999,
            },
        });
        await prisma.listing.create({
            data: {
                id: ids.auction, slug: 'test-trade-' + ids.auction, title: 'PRIVATE TRADE CANARY',
                price: 1700, images: [], videoUrls: [], make: 'Toyota',
                type: 'AUCTION', status: 'ACTIVE', sellerId: ids.otherBuyer,
                auction: { create: {
                    status: 'ACTIVE',
                    startTime: new Date(Date.now() - 3600000),
                    endTime: new Date(Date.now() + 86400000),
                    reservePrice: 100000, startingBid: 1000, minIncrement: 50,
                } },
            },
        });
        // One legacy buyer row proves existing auction shortlists are hidden
        // from generic Saved Cars without deleting/modifying historic data.
        await prisma.watchlistItem.create({ data: {
            userId: ids.buyer, listingId: ids.auction,
        } });
        const identities = new Map<string, { id: string; role: string }>([
            ['buyer', { id: ids.buyer, role: 'BUYER' }],
            ['other-buyer', { id: ids.otherBuyer, role: 'BUYER' }],
            ['approved', { id: ids.approvedDealer, role: 'DEALER' }],
            ['unverified', { id: ids.unverifiedDealer, role: 'DEALER' }],
        ]);
        const authGuard = {
            canActivate(ctx: any) {
                const httpRequest = ctx.switchToHttp().getRequest();
                const actor = identities.get(httpRequest.headers['x-test-client']);
                if (!actor) throw new UnauthorizedException();
                httpRequest.user = actor;
                return true;
            },
        };
        const module = await Test.createTestingModule({
            controllers: [WatchlistController],
            providers: [
                { provide: PrismaService, useValue: prisma },
                { provide: WatchlistService, useValue: new WatchlistService(prisma as any) },
                VerifiedDealerGuard,
            ],
        }).overrideGuard(SessionAuthGuard).useValue(authGuard).compile();
        const nest = module.createNestApplication();
        await nest.init();
        const api = request(nest.getHttpServer());
        const call = (method: 'get' | 'post' | 'delete', path: string, actor?: string) => {
            const req = api[method](path);
            return actor ? req.set('x-test-client', actor) : req;
        };
        let cases = 0;
        try {
            for (const [method, route] of [
                ['get', '/watchlist'], ['get', '/watchlist/count'],
                ['get', '/watchlist/check/' + ids.auction],
                ['post', '/watchlist/' + ids.auction],
                ['post', '/watchlist/auctions/' + ids.auction],
                ['get', '/watchlist/auctions'],
                ['delete', '/watchlist/auctions/' + ids.auction],
            ] as Array<['get' | 'post' | 'delete', string]>) {
                const r = await call(method, route);
                assert(r.status === 401, 'anonymous ' + method + ' ' + route + ': ' + r.status);
                cases++;
            }
            for (const who of ['buyer', 'unverified']) {
                for (const method of ['get', 'post', 'delete'] as const) {
                    const route = method === 'get'
                        ? '/watchlist/auctions'
                        : '/watchlist/auctions/' + ids.auction;
                    const r = await call(method, route, who);
                    assert(r.status === 403, who + ' trade route must be 403');
                    cases++;
                }
            }
            const retailAuctionAttempt = await call('post', '/watchlist/' + ids.auction, 'other-buyer');
            assert(retailAuctionAttempt.status === 404 &&
                !JSON.stringify(retailAuctionAttempt.body).includes('PRIVATE TRADE CANARY'),
                'retail POST must not reveal auction existence');
            cases++;
            const oldSavedBuyer = await call('get', '/watchlist', 'buyer');
            assert(oldSavedBuyer.status === 200 && oldSavedBuyer.body.pagination.total === 0 &&
                oldSavedBuyer.body.data.length === 0, 'legacy buyer auction must be hidden');
            const oldSavedCheck = await call('get', '/watchlist/check/' + ids.auction, 'buyer');
            assert(oldSavedCheck.body.data.inWatchlist === false, 'generic check must not disclose auction');
            const oldSavedCount = await call('get', '/watchlist/count', 'buyer');
            assert(oldSavedCount.body.data.count === 0, 'generic count must exclude auction');
            cases += 3;
            const wrongType = await call('post', '/watchlist/auctions/' + ids.retail, 'approved');
            assert(wrongType.status === 404, 'trade POST cannot save classified listing');
            const tradeSave = await call('post', '/watchlist/auctions/' + ids.auction, 'approved');
            assert(tradeSave.status === 201 && tradeSave.body.data?.listingId === ids.auction,
                'verified trade dealer must save live auction');
            assert(!JSON.stringify(tradeSave.body).includes('reservePrice'),
                'trade POST must not reveal confidential reserve');
            const tradeStatus = await call('get', '/watchlist/auctions/check/' + ids.auction, 'approved');
            assert(tradeStatus.status === 200 && tradeStatus.body.data.inWatchlist === true,
                'trade-only status check must recognize saved auction');
            const tradeList = await call('get', '/watchlist/auctions', 'approved');
            assert(tradeList.status === 200 && tradeList.body.pagination.total === 1 &&
                tradeList.body.data[0]?.listingId === ids.auction &&
                !JSON.stringify(tradeList.body).includes('reservePrice'),
                'verified-only trade GET must expose only approved shortlist fields');
            const retailDealer = await call('get', '/watchlist', 'approved');
            assert(retailDealer.body.pagination.total === 0,
                'retail GET must not mix dealer trade shortlist');
            cases += 5;
            const duplicate = await call('post', '/watchlist/auctions/' + ids.auction, 'approved');
            assert(duplicate.status === 409, 'trade save deduplication');
            const retailSave = await call('post', '/watchlist/' + ids.retail, 'buyer');
            assert(retailSave.status === 201 && !JSON.stringify(retailSave.body).includes('priceMin'),
                'retail POST only returns safe metadata');
            const retailList = await call('get', '/watchlist', 'buyer');
            assert(retailList.body.pagination.total === 1 &&
                retailList.body.data[0]?.listingId === ids.retail &&
                !JSON.stringify(retailList.body).includes(secret),
                'retail Saved Cars preserved with legacy trade rows hidden');
            const otherCount = await call('get', '/watchlist/count', 'other-buyer');
            assert(otherCount.body.data.count === 0, 'other account cannot read buyer retail saves');
            const removeTrade = await call('delete', '/watchlist/auctions/' + ids.auction, 'approved');
            assert(removeTrade.status === 204, 'verified dealer can remove own auction');
            assert((await call('get', '/watchlist/auctions', 'approved')).body.pagination.total === 0,
                'trade shortlist removal reflects accurately');
            cases += 6;
            console.log('WATCHLIST_SECURITY_POSTGRES_PASS', JSON.stringify({
                cases,
                tradeVerification: 'actual VerifiedDealerGuard with real database KYC',
                anonymous: 401,
                retailAuctionSave: 404,
                unverifiedTrade: 403,
                legacyAuctionHidden: true,
                retailSavedPreserved: true,
                auctionShortlistVerified: true,
                noSensitiveListingOnPost: true,
            }));
        } finally {
            await nest.close();
        }
    } finally {
        await prisma.$disconnect();
    }
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
