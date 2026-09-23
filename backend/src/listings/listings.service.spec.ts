const mockListingCheckoutSessionRetrieve = jest.fn();
const mockListingPaymentIntentRetrieve = jest.fn();

jest.mock('stripe', () => {
    const MockStripe = jest.fn().mockImplementation(() => ({
        checkout: { sessions: { retrieve: mockListingCheckoutSessionRetrieve } },
        paymentIntents: { retrieve: mockListingPaymentIntentRetrieve },
    }));
    return { __esModule: true, default: MockStripe };
});

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { ScraperService } from '../scraper/scraper.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { DealersService } from '../dealers/dealers.service';

/**
 * Listings service guarantees:
 *  - Any SOLD transition (whether via /sold or /status) creates exactly one Sale row
 *    so earnings can never silently drop a finalized vehicle.
 *  - `findMyListings` honors `includeSold` so seller offer dashboards keep accepted
 *    offers visible after the listing is closed.
 *  - Seller stats and seller performance source `totalRevenue` from `Sale.soldPrice`,
 *    not `Listing.price`, so the metric is consistent with the unified dashboard.
 */
describe('ListingsService', () => {
    let service: ListingsService;
    let prisma: any;
    let sellers: any;
    let scraper: any;

    beforeEach(async () => {
        mockListingCheckoutSessionRetrieve.mockReset();
        mockListingPaymentIntentRetrieve.mockReset();
        prisma = {
            listing: {
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn(),
                aggregate: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                create: jest.fn(),
            },
            sale: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                aggregate: jest.fn(),
                create: jest.fn(),
            },
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            user: { findUnique: jest.fn() },
            transaction: { findMany: jest.fn(), update: jest.fn() },
            hpiReport: { findUnique: jest.fn().mockResolvedValue({ id: 'hpi-1' }) },
            auction: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
            bid: {
                findFirst: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            // The production query casts pg_advisory_xact_lock(void) to text
            // because Prisma cannot deserialize PostgreSQL void columns.
            $queryRaw: jest.fn().mockResolvedValue([{ lock_result: '' }]),
            $transaction: jest.fn(async (arg: any) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma)),
        };
        sellers = { incrementListings: jest.fn(), incrementSales: jest.fn() };
        const config = {
            get: jest.fn((key: string) =>
                key === 'SUPABASE_URL' ? 'https://test.supabase.co' : undefined,
            ),
        };
        scraper = { scrape: jest.fn() };
        const notifications = { create: jest.fn().mockResolvedValue(null) };
        const notificationsGateway = { sendNotification: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ListingsService,
                { provide: PrismaService, useValue: prisma },
                { provide: SellersService, useValue: sellers },
                { provide: ConfigService, useValue: config },
                { provide: ScraperService, useValue: scraper },
                { provide: NotificationsService, useValue: notifications },
                { provide: NotificationsGateway, useValue: notificationsGateway },
                { provide: DealersService, useValue: { markRetailLeadWon: jest.fn().mockResolvedValue(null) } },
            ],
        }).compile();

        service = module.get<ListingsService>(ListingsService);
    });

    describe('auction to retail conversion', () => {
        const sellerId = '11111111-1111-4111-8111-111111111111';

        it('offers a safe conversion instead of treating an ended auction vehicle as a duplicate', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                id: 'listing-1',
                vrm: 'AB12CDE',
                type: 'CLASSIFIED',
                status: 'DRAFT',
                title: 'BMW M3',
                price: 10000,
                year: 2020,
                mileage: 30000,
                linkedListingId: null,
                importedFromUrl: null,
                writeOffCategory: 'NONE',
            }]);
            prisma.auction.findUnique.mockResolvedValue({
                id: 'auction-1',
                status: 'ENDED',
                reservePrice: 9000,
                winnerId: null,
                winningBidAmount: null,
                buyerFeePaid: false,
                deletedAt: null,
            });
            prisma.bid.findFirst.mockResolvedValue(null);

            const result = await service.getRetailConversionCandidate(sellerId, 'AB12 CDE');

            expect(result.candidate).toEqual(expect.objectContaining({
                listingId: 'listing-1',
                auctionStatus: 'ENDED',
                canConvert: true,
                reserveMet: false,
            }));
        });

        it('recovers a legacy AUCTION draft even when its Auction row is missing', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                id: 'orphan-auction',
                slug: 'bmw-m3-orphan',
                vrm: 'AB12CDE',
                type: 'AUCTION',
                status: 'DRAFT',
                title: 'BMW M3',
                price: 10000,
                year: 2020,
                mileage: 30000,
                linkedListingId: null,
                importedFromUrl: null,
                writeOffCategory: 'NONE',
            }]);
            prisma.auction.findUnique.mockResolvedValue(null);
            prisma.bid.findFirst.mockResolvedValue(null);

            const result = await service.getRetailConversionCandidate(sellerId, 'AB12CDE');

            expect(result.candidate).toEqual(expect.objectContaining({
                listingId: 'orphan-auction',
                auctionId: null,
                auctionStatus: 'DRAFT',
                canConvert: true,
            }));
        });

        it('blocks an active auction conversion once the reserve has been met', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                id: 'listing-1',
                vrm: 'AB12CDE',
                type: 'AUCTION',
                status: 'ACTIVE',
                title: 'BMW M3',
                price: 10000,
                year: 2020,
                mileage: 30000,
                linkedListingId: null,
                importedFromUrl: null,
                writeOffCategory: 'NONE',
            }]);
            prisma.auction.findUnique.mockResolvedValue({
                id: 'auction-1',
                status: 'ACTIVE',
                reservePrice: 9000,
                winnerId: null,
                winningBidAmount: null,
                buyerFeePaid: false,
                deletedAt: null,
            });
            prisma.bid.findFirst.mockResolvedValue({ amount: 9500 });

            const result = await service.getRetailConversionCandidate(sellerId, 'AB12CDE');

            expect(result.candidate).toEqual(expect.objectContaining({
                canConvert: false,
                reserveMet: true,
            }));
            expect(result.candidate?.blockedReason).toContain('reserve has been met');
        });

        it('reuses the same listing row, cancels the auction and leaves Retail as DRAFT for payment', async () => {
            const source = {
                id: 'listing-1',
                slug: 'bmw-m3-abcd',
                sellerId,
                vrm: 'AB12CDE',
                type: 'AUCTION',
                status: 'ACTIVE',
                title: 'BMW M3',
                vehicleType: 'CAR',
                isImported: false,
                writeOffCategory: 'NONE',
                linkedListingId: null,
                deletedAt: null,
                auction: {
                    id: 'auction-1',
                    status: 'ACTIVE',
                    reservePrice: 9000,
                    winnerId: null,
                    winningBidAmount: null,
                    buyerFeePaid: false,
                },
            };
            prisma.listing.findUnique.mockResolvedValue(source);
            prisma.bid.findFirst.mockResolvedValue({ amount: 8000 });
            prisma.bid.findMany.mockResolvedValue([]);
            prisma.auction.update.mockResolvedValue({ ...source.auction, status: 'CANCELLED' });
            prisma.listing.update.mockResolvedValue({
                ...source,
                type: 'CLASSIFIED',
                status: 'DRAFT',
                badgeTier: 'BASIC',
                price: 12000,
            });

            const result = await service.convertAuctionToRetail('listing-1', sellerId, {
                title: 'BMW M3 Retail',
                price: 12000,
                priceMin: 11000,
                priceMax: 12000,
                mileage: 30000,
                year: 2020,
                vrm: 'AB12 CDE',
                images: [],
                listingType: 'CLASSIFIED',
                badgeTier: 'BASIC',
                status: 'DRAFT',
                confirmAuctionCancellation: true,
            } as any);

            expect(prisma.auction.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'auction-1' },
                data: expect.objectContaining({ status: 'CANCELLED' }),
            }));
            expect(prisma.bid.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ listingId: 'listing-1' }),
                data: expect.objectContaining({ archivedAt: expect.any(Date) }),
            }));
            expect(prisma.listing.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'listing-1' },
                data: expect.objectContaining({
                    type: 'CLASSIFIED',
                    status: 'DRAFT',
                    badgeTier: 'BASIC',
                    price: 12000,
                }),
            }));
            expect(result).toEqual(expect.objectContaining({
                listingId: 'listing-1',
                auctionCancelled: true,
            }));
        });

        it('re-checks reserve safety on confirmation and refuses an unsafe conversion', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId,
                vrm: 'AB12CDE',
                type: 'AUCTION',
                status: 'ACTIVE',
                vehicleType: 'CAR',
                isImported: false,
                writeOffCategory: 'NONE',
                linkedListingId: null,
                deletedAt: null,
                auction: {
                    id: 'auction-1',
                    status: 'ACTIVE',
                    reservePrice: 9000,
                    winnerId: null,
                    winningBidAmount: null,
                    buyerFeePaid: false,
                },
            });
            prisma.bid.findFirst.mockResolvedValue({ amount: 9500 });

            await expect(service.convertAuctionToRetail('listing-1', sellerId, {
                title: 'BMW M3 Retail',
                price: 12000,
                mileage: 30000,
                year: 2020,
                vrm: 'AB12CDE',
                images: [],
                listingType: 'CLASSIFIED',
                badgeTier: 'BASIC',
                confirmAuctionCancellation: true,
            } as any)).rejects.toThrow(BadRequestException);

            expect(prisma.listing.update).not.toHaveBeenCalled();
            expect(prisma.auction.update).not.toHaveBeenCalled();
        });
    });

    describe('atomic initial auction creation', () => {
        const sellerId = '11111111-1111-4111-8111-111111111111';
        const tenImages = Array.from(
            { length: 10 },
            (_, index) => `https://test.supabase.co/storage/v1/object/public/listings/${sellerId}/vehicle/${index}.jpg`,
        );

        const makeAuctionListing = (overrides: Record<string, any> = {}) => ({
            title: 'BMW M3 Auction',
            price: 10000,
            mileage: 30000,
            year: 2020,
            vrm: 'AB12CDE',
            images: tenImages,
            listingType: 'AUCTION',
            badgeTier: 'FREE',
            ...overrides,
        });

        it('creates Listing + Auction explicitly inside one transaction and keeps the listing DRAFT', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            prisma.listing.create.mockResolvedValue({
                id: 'listing-new',
                title: 'BMW M3 Auction',
                sellerId,
                type: 'AUCTION',
                status: 'DRAFT',
            });
            prisma.auction.create.mockResolvedValue({ id: 'auction-new' });

            const start = new Date(Date.now() + 60_000);
            await service.create(
                makeAuctionListing({
                    status: 'ACTIVE',
                    auctionStartTime: start.toISOString(),
                    auctionReservePrice: 9000,
                    auctionMinIncrement: 100,
                    auctionStartingBid: 9999,
                    auctionBuyItNowPrice: 12000,
                }) as any,
                sellerId,
            );

            const listingCreateCall = prisma.listing.create.mock.calls[0][0];
            expect(listingCreateCall.data.status).toBe('DRAFT');
            expect(listingCreateCall.data.type).toBe('AUCTION');
            expect(listingCreateCall.data.auction).toBeUndefined();

            expect(prisma.auction.create).toHaveBeenCalledTimes(1);
            const auctionCreateCall = prisma.auction.create.mock.calls[0][0];
            expect(auctionCreateCall.data).toEqual(expect.objectContaining({
                listingId: 'listing-new',
                reservePrice: 9000,
                startingBid: 7000,
                minIncrement: 100,
                buyItNowPrice: 12000,
                status: 'SCHEDULED',
            }));
            expect(auctionCreateCall.data.startTime.getTime()).toBe(start.getTime());
            expect(auctionCreateCall.data.endTime.getTime() - auctionCreateCall.data.startTime.getTime())
                .toBe(24 * 60 * 60 * 1000);

            // Both creates execute through the same interactive transaction.
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('keeps an intentional AUCTION draft as DRAFT when no schedule is supplied', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            prisma.listing.create.mockResolvedValue({
                id: 'listing-draft',
                title: 'BMW M3 Auction',
                sellerId,
                type: 'AUCTION',
                status: 'DRAFT',
            });

            await service.create(
                makeAuctionListing({ status: 'ACTIVE' }) as any,
                sellerId,
            );

            const createCall = prisma.listing.create.mock.calls[0][0];
            expect(createCall.data.status).toBe('DRAFT');
            expect(createCall.data.auction).toBeUndefined();
        });

        it('rejects a partial auction schedule instead of creating a half-configured listing', async () => {
            prisma.listing.findMany.mockResolvedValue([]);

            await expect(
                service.create(
                    makeAuctionListing({
                        auctionStartTime: new Date(Date.now() + 60_000).toISOString(),
                        auctionReservePrice: 9000,
                    }) as any,
                    sellerId,
                ),
            ).rejects.toThrow(/requires start time, reserve price and minimum increment/i);

            expect(prisma.listing.create).not.toHaveBeenCalled();
            expect(prisma.auction.create).not.toHaveBeenCalled();
        });
    });

    describe('listing creation idempotency', () => {
        const sellerId = '11111111-1111-4111-8111-111111111111';
        const images = Array.from(
            { length: 10 },
            (_, index) => `https://test.supabase.co/storage/v1/object/public/listings/${sellerId}/vehicle/${index}.jpg`,
        );
        const payload = {
            title: 'BMW M3 2020',
            price: 10000,
            mileage: 30000,
            year: 2020,
            vrm: 'AB 12 CDE',
            images,
            listingType: 'CLASSIFIED',
            badgeTier: 'BASIC',
            status: 'DRAFT',
        };

        it('reuses an existing same-channel DRAFT under the transaction lock', async () => {
            const existing = {
                id: 'existing-draft',
                sellerId,
                vrm: 'AB12CDE',
                type: 'CLASSIFIED',
                status: 'DRAFT',
                title: 'Existing BMW M3',
                deletedAt: null,
            };
            prisma.listing.findMany.mockResolvedValue([{
                id: existing.id,
                vrm: existing.vrm,
                type: existing.type,
                status: existing.status,
                title: 'BMW M3 2020',
                price: 10000,
                year: 2020,
                mileage: 30000,
                linkedListingId: null,
                importedFromUrl: null,
            }]);
            prisma.listing.findUnique.mockResolvedValue(existing);

            const result = await service.create(payload as any, sellerId);

            expect(prisma.$queryRaw).toHaveBeenCalled();
            const advisorySql = prisma.$queryRaw.mock.calls[0][0].join('');
            expect(advisorySql).toContain('pg_advisory_xact_lock');
            expect(advisorySql).toContain('::text AS lock_result');
            expect(prisma.listing.create).not.toHaveBeenCalled();
            expect(result).toBe(existing);
        });

        it('rejects a different same-VRM draft instead of silently returning stale data', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                id: 'older-draft',
                vrm: 'AB12CDE',
                type: 'CLASSIFIED',
                status: 'DRAFT',
                title: 'Older BMW draft',
                price: 9500,
                year: 2020,
                mileage: 30000,
                linkedListingId: null,
                importedFromUrl: null,
            }]);

            await expect(service.create(payload as any, sellerId))
                .rejects.toThrow(/already has an existing classified listing \(draft\)/i);

            expect(prisma.listing.create).not.toHaveBeenCalled();
        });

        it('rejects a conflicting live listing instead of creating another row', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                id: 'live-listing',
                vrm: 'AB12CDE',
                type: 'CLASSIFIED',
                status: 'ACTIVE',
            }]);

            await expect(service.create(payload as any, sellerId))
                .rejects.toThrow(/already has an existing classified listing \(active\)/i);

            expect(prisma.$queryRaw).toHaveBeenCalled();
            expect(prisma.listing.create).not.toHaveBeenCalled();
        });

        it('rejects a normal create when the same VRM already exists in the other channel', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                id: 'auction-draft',
                vrm: 'AB12CDE',
                type: 'AUCTION',
                status: 'DRAFT',
            }]);

            await expect(service.create(payload as any, sellerId))
                .rejects.toThrow(/existing auction listing/i);

            expect(prisma.listing.create).not.toHaveBeenCalled();
        });
    });

    describe('generic listing update protection', () => {
        it('does not write lifecycle/commercial fields even if the service is called with a forged DTO object', async () => {
            const existing = {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'DRAFT',
                type: 'CLASSIFIED',
                badgeTier: 'BASIC',
                location: null,
                deletedAt: null,
            };
            prisma.listing.findUnique.mockResolvedValue(existing);
            prisma.listing.update.mockImplementation(async ({ data }: any) => ({
                ...existing,
                ...data,
            }));

            await service.update(
                'listing-1',
                'seller-1',
                {
                    title: 'Updated vehicle title',
                    status: 'ACTIVE',
                    listingType: 'AUCTION',
                    badgeTier: 'PREMIUM',
                } as any,
            );

            expect(prisma.listing.update).toHaveBeenCalledWith({
                where: { id: 'listing-1' },
                data: { title: 'Updated vehicle title' },
            });
        });
    });

    describe('updateStatus -> SOLD', () => {
        it('creates a Sale record when transitioning to SOLD for the first time', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                price: 12000,
                deletedAt: null,
            });
            prisma.listing.update.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'SOLD',
            });
            prisma.sale.findFirst.mockResolvedValue(null);

            await service.updateStatus('listing-1', 'seller-1', 'SOLD' as any);

            expect(prisma.sale.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        listingId: 'listing-1',
                        sellerId: 'seller-1',
                        soldPrice: 12000,
                    }),
                }),
            );
            expect(sellers.incrementSales).toHaveBeenCalledWith('seller-1');
        });

        it('does NOT double-insert a Sale when one already exists for the listing', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                price: 12000,
                deletedAt: null,
            });
            prisma.listing.update.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'SOLD',
            });
            prisma.sale.findFirst.mockResolvedValue({ id: 'existing-sale' });

            await service.updateStatus('listing-1', 'seller-1', 'SOLD' as any);

            expect(prisma.sale.create).not.toHaveBeenCalled();
        });

        it('does not create a Sale when the listing was already SOLD', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'SOLD',
                price: 12000,
                deletedAt: null,
            });
            prisma.listing.update.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'SOLD',
            });

            await service.updateStatus('listing-1', 'seller-1', 'SOLD' as any);

            expect(prisma.sale.create).not.toHaveBeenCalled();
            expect(sellers.incrementSales).not.toHaveBeenCalled();
        });
    });

    describe('findMyListings', () => {
        it('excludes SOLD listings by default', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            prisma.listing.count.mockResolvedValue(0);

            await service.findMyListings('seller-1');

            const args = prisma.listing.findMany.mock.calls[0][0];
            expect(args.where.status).toEqual({ not: 'SOLD' });
        });

        it('includes SOLD listings when includeSold is true (offer dashboard scenario)', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            prisma.listing.count.mockResolvedValue(0);

            await service.findMyListings('seller-1', { includeSold: true } as any);

            const args = prisma.listing.findMany.mock.calls[0][0];
            expect(args.where.status).toBeUndefined();
        });
    });

    describe('getSellerStats / getSellerPerformance', () => {
        it('sources totalRevenue from Sale.soldPrice, not Listing.price', async () => {
            prisma.dealerStaff.findFirst.mockResolvedValue(null);
            prisma.listing.count.mockResolvedValue(0);
            prisma.listing.aggregate.mockResolvedValue({ _sum: { viewCount: 0 } });
            prisma.sale.aggregate.mockResolvedValue({ _sum: { soldPrice: 42000 } });

            const stats = await service.getSellerStats('seller-1');

            expect(stats.totalRevenue).toBe(42000);
            // The sale aggregate should be filtered by the resolved owner ID, not by
            // listing.status — that's the bug we're guarding against.
            expect(prisma.sale.aggregate).toHaveBeenCalledWith({
                where: { sellerId: 'seller-1' },
                _sum: { soldPrice: true },
            });
        });

        it('aggregates revenue against the dealership owner when called by staff', async () => {
            prisma.dealerStaff.findFirst.mockResolvedValue({
                dealerProfile: { userId: 'owner-1' },
            });
            prisma.listing.count.mockResolvedValue(0);
            prisma.listing.aggregate.mockResolvedValue({ _sum: { viewCount: 0 } });
            prisma.sale.aggregate.mockResolvedValue({ _sum: { soldPrice: 100000 } });

            const stats = await service.getSellerStats('staff-1');

            expect(stats.totalRevenue).toBe(100000);
            expect(prisma.sale.aggregate).toHaveBeenCalledWith({
                where: { sellerId: 'owner-1' },
                _sum: { soldPrice: true },
            });
        });
    });

    describe('publishListing retail payment gate', () => {
        const tenImages = Array.from({ length: 10 }, (_, i) => `image-${i}`);
        const submissionReady = {
            images: tenImages,
            vrm: 'AB12CDE',
            make: 'BMW',
            model: 'M3',
            year: 2020,
            mileage: 25000,
            fuelType: 'PETROL',
            transmission: 'AUTOMATIC',
            bodyType: 'COUPE',
            title: 'BMW M3 2020',
            location: 'Birmingham',
            owners: '1',
            description: 'Well presented vehicle with full details.',
            condition: 'GOOD',
            stolenRecovered: false,
            hasOutstandingFinance: false,
            isLegalRegisteredKeeper: true,
            isDepartedSale: false,
        };

        it('rejects incomplete listings before any payment/review decision', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-incomplete',
                sellerId: 'seller-1',
                type: 'CLASSIFIED',
                badgeTier: 'BASIC',
                status: 'DRAFT',
                ...submissionReady,
                images: [],
                createdAt: new Date('2026-09-19T01:00:00.000Z'),
                deletedAt: null,
            });

            await expect(
                service.publishListing('listing-incomplete', 'seller-1'),
            ).rejects.toThrow(/at least 10 photos/i);

            expect(prisma.transaction.findMany).not.toHaveBeenCalled();
        });

        it('allows a complete retail listing to continue without an HPI request', async () => {
            prisma.hpiReport.findUnique.mockResolvedValue(null);
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-no-hpi',
                sellerId: 'seller-1',
                type: 'CLASSIFIED',
                badgeTier: 'BASIC',
                status: 'DRAFT',
                ...submissionReady,
                createdAt: new Date('2026-09-19T01:00:00.000Z'),
                deletedAt: null,
            });
            prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
            prisma.transaction.findMany.mockResolvedValue([]);

            const result = await service.publishListing('listing-no-hpi', 'seller-1');

            expect(result).toEqual({ activated: false, requiresPayment: true });
            expect(prisma.hpiReport.findUnique).not.toHaveBeenCalled();
        });

        it('heals a legacy FREE retail draft to BASIC and still requires payment', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                type: 'CLASSIFIED',
                badgeTier: 'FREE',
                status: 'DRAFT',
                ...submissionReady,
                deletedAt: null,
            });
            prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
            prisma.transaction.findMany.mockResolvedValue([]);

            const result = await service.publishListing('listing-1', 'seller-1');

            expect(prisma.listing.update).toHaveBeenCalledWith({
                where: { id: 'listing-1' },
                data: { badgeTier: 'BASIC' },
            });
            expect(result).toEqual({ activated: false, requiresPayment: true });
            expect(prisma.listing.update).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'PENDING_REVIEW' }),
                }),
            );
        });

        it('reconciles a successful native PaymentIntent when the webhook is delayed', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-native-paid',
                sellerId: 'seller-1',
                type: 'CLASSIFIED',
                badgeTier: 'BASIC',
                status: 'DRAFT',
                ...submissionReady,
                deletedAt: null,
            });
            prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
            prisma.transaction.findMany.mockResolvedValue([{
                id: 'txn-native',
                status: 'PENDING',
                stripePaymentId: 'pi_native_paid',
            }]);
            mockListingPaymentIntentRetrieve.mockResolvedValue({
                id: 'pi_native_paid',
                status: 'succeeded',
            });
            prisma.listing.update.mockResolvedValue({});

            const result = await service.publishListing('listing-native-paid', 'seller-1');

            expect(mockListingPaymentIntentRetrieve).toHaveBeenCalledWith('pi_native_paid');
            expect(mockListingCheckoutSessionRetrieve).not.toHaveBeenCalled();
            expect(prisma.transaction.update).toHaveBeenCalledWith({
                where: { id: 'txn-native' },
                data: {
                    status: 'COMPLETED',
                    stripePaymentId: 'pi_native_paid',
                },
            });
            expect(prisma.listing.update).toHaveBeenCalledWith({
                where: { id: 'listing-native-paid' },
                data: { status: 'PENDING_REVIEW', rejectionReason: null },
            });
            expect(result).toEqual({ activated: false, pendingReview: true });
        });

        it('keeps FREE auction listings free and submits them for review', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-2',
                sellerId: 'seller-1',
                type: 'AUCTION',
                badgeTier: 'FREE',
                status: 'DRAFT',
                ...submissionReady,
                title: 'Auction car',
                deletedAt: null,
            });
            prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
            prisma.listing.update.mockResolvedValue({});
            prisma.auction.findUnique.mockResolvedValue({
                id: 'auction-1',
                deletedAt: null,
                status: 'SCHEDULED',
                startTime: new Date(Date.now() + 60_000),
                endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            });

            const result = await service.publishListing('listing-2', 'seller-1');

            expect(result).toEqual({ activated: false, pendingReview: true });
            expect(prisma.listing.update).toHaveBeenCalledWith({
                where: { id: 'listing-2' },
                data: { status: 'PENDING_REVIEW', rejectionReason: null },
            });
            expect(prisma.transaction.findMany).not.toHaveBeenCalled();
        });
    });

    describe('external listing import image isolation', () => {
        it('never persists third-party image URLs on the imported Listing row', async () => {
            scraper.scrape.mockResolvedValue({
                platform: 'AUTOTRADER',
                originalUrl: 'https://www.autotrader.co.uk/car-details/123',
                title: 'Imported BMW 3 Series',
                images: [
                    'https://m.atcdn.co.uk/a/media/w1024/example.jpg',
                ],
            });
            prisma.listing.create.mockImplementation(async ({ data }: any) => ({
                id: 'imported-listing-1',
                ...data,
            }));

            const result = await service.importFromUrl(
                'https://www.autotrader.co.uk/car-details/123',
                'seller-1',
                {
                    price: 12000,
                    vrm: 'AB12CDE',
                    badgeTier: 'BASIC',
                },
            );

            expect(prisma.listing.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    sellerId: 'seller-1',
                    images: [],
                    importedSource: 'AUTOTRADER',
                }),
            });
            expect(result.images).toEqual([]);

            // Secure Storage credentials are intentionally absent in this unit
            // test, so the background importer must fail closed rather than
            // writing the original third-party URL back into the listing.
            await new Promise((resolve) => setImmediate(resolve));
            expect(prisma.listing.update).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        images: ['https://m.atcdn.co.uk/a/media/w1024/example.jpg'],
                    },
                }),
            );
        });

        it('reuses an existing imported/normal DRAFT for the same seller and normalized VRM', async () => {
            scraper.scrape.mockResolvedValue({
                platform: 'AUTOTRADER',
                originalUrl: 'https://www.autotrader.co.uk/car-details/123',
                title: 'Imported BMW 3 Series',
                images: [],
            });
            const existing = {
                id: 'existing-import-draft',
                sellerId: 'seller-1',
                vrm: 'AB12CDE',
                type: 'CLASSIFIED',
                status: 'DRAFT',
                title: 'Existing BMW',
                images: [],
            };
            prisma.listing.findMany.mockResolvedValue([{
                id: existing.id,
                vrm: 'AB 12 CDE',
                type: 'CLASSIFIED',
                status: 'DRAFT',
                title: 'Imported BMW 3 Series',
                price: 12000,
                year: null,
                mileage: null,
                linkedListingId: null,
                importedFromUrl: 'https://www.autotrader.co.uk/car-details/123',
            }]);
            prisma.listing.findUnique.mockResolvedValue(existing);

            const result = await service.importFromUrl(
                'https://www.autotrader.co.uk/car-details/123',
                'seller-1',
                { price: 12000, vrm: ' ab 12 cde ', badgeTier: 'BASIC' },
            );

            expect(prisma.$queryRaw).toHaveBeenCalled();
            expect(prisma.listing.create).not.toHaveBeenCalled();
            expect(result).toBe(existing);
        });
    });

    describe('alsoListRetail', () => {
        it('returns the existing linked retail DRAFT instead of deleting and recreating it', async () => {
            prisma.listing.findUnique
                .mockResolvedValueOnce({
                    id: 'auction-1',
                    sellerId: 'seller-1',
                    type: 'AUCTION',
                    status: 'ACTIVE',
                    deletedAt: null,
                    linkedListingId: 'retail-1',
                })
                .mockResolvedValueOnce({
                    id: 'retail-1',
                    deletedAt: null,
                });

            const result = await service.alsoListRetail(
                'auction-1',
                'seller-1',
                { price: 12000, badgeTier: 'BASIC' },
            );

            expect(result).toEqual({ linkedListingId: 'retail-1' });
            expect(prisma.listing.create).not.toHaveBeenCalled();
            expect(prisma.listing.updateMany).not.toHaveBeenCalled();
        });

        it('returns the winning link when another request claims the source first', async () => {
            prisma.listing.findUnique
                .mockResolvedValueOnce({
                    id: 'auction-1',
                    sellerId: 'seller-1',
                    type: 'AUCTION',
                    status: 'ACTIVE',
                    deletedAt: null,
                    linkedListingId: null,
                    title: 'BMW M3',
                })
                .mockResolvedValueOnce({
                    linkedListingId: 'retail-winner',
                });
            prisma.listing.updateMany.mockResolvedValue({ count: 0 });

            const result = await service.alsoListRetail(
                'auction-1',
                'seller-1',
                { price: 12000, badgeTier: 'BASIC' },
            );

            expect(result).toEqual({ linkedListingId: 'retail-winner' });
            expect(prisma.listing.create).not.toHaveBeenCalled();
        });
    });

    describe('mandatory live AI valuation research', () => {
        it('runs live UK market research even when CarMazium already has strong internal comparables', async () => {
            const internalRows = [0, 1, 2, 3].map((index) => ({
                id: `internal-${index}`,
                type: 'CLASSIFIED',
                status: 'ACTIVE',
                price: 40000 + index * 1000,
                make: 'BMW',
                model: 'M3',
                variant: 'Competition',
                year: 2020,
                mileage: 30000 + index * 1000,
                fuelType: 'PETROL',
                transmission: 'AUTOMATIC',
                writeOffCategory: null,
                condition: 'GOOD',
                serviceHistory: 'FULL',
                owners: 2,
                isImported: false,
                sale: null,
                auction: null,
                offers: [],
            }));
            prisma.listing.findMany.mockResolvedValue(internalRows);

            const liveSearch = jest
                .spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue({
                    checkedAt: new Date().toISOString(),
                    rawComparableCount: 3,
                    comparables: [
                        { price: 42500, year: 2020, mileage: 31000, kind: 'ACTIVE_ASK' },
                        { price: 43500, year: 2021, mileage: 28000, kind: 'ACTIVE_ASK' },
                        { price: 41500, year: 2019, mileage: 34000, kind: 'ACTIVE_ASK' },
                    ],
                });

            const result = await service.estimateVehicleValue({
                make: 'BMW',
                model: 'M3',
                year: 2020,
                mileage: 30000,
                variant: 'Competition',
                fuelType: 'PETROL',
                transmission: 'AUTOMATIC',
            } as any);

            expect(liveSearch).toHaveBeenCalledTimes(1);
            expect(result.source).toBe('BLENDED_MARKET');
            expect(result.marketEvidence).toEqual(expect.objectContaining({
                carmaziumComparables: 4,
                liveUkComparables: 3,
                liveUkSearchStatus: 'USED',
            }));
        });
    });

    describe('alsoAuction', () => {
        const baseSource = {
            id: 'listing-1',
            sellerId: 'seller-1',
            type: 'CLASSIFIED',
            linkedListingId: null,
            price: 10000,
            title: 'BMW M3',
            slug: 'bmw-m3',
            status: 'ACTIVE',
            deletedAt: null,
            createdAt: new Date('2026-09-18T12:00:00.000Z'),
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
            videoUrls: [],
            vrm: 'AB12CDE',
            make: 'BMW',
            model: 'M3',
            year: 2020,
            mileage: 25000,
            fuelType: 'PETROL',
            transmission: 'AUTOMATIC',
            bodyType: 'COUPE',
            location: 'Birmingham',
            owners: '1',
            description: 'Well presented vehicle with full details.',
            condition: 'GOOD',
            stolenRecovered: false,
            hasOutstandingFinance: false,
            isLegalRegisteredKeeper: true,
            isDepartedSale: false,
            hpiReport: { id: 'hpi-1' },
        };

        beforeEach(() => {
            prisma.listing.findUnique.mockResolvedValue(baseSource);
            prisma.listing.updateMany.mockResolvedValue({ count: 1 });
            prisma.listing.create.mockImplementation(async ({ data }: any) => ({
                id: data.id,
                title: data.title,
                sellerId: data.sellerId,
                status: data.status,
                linkedListingId: data.linkedListingId,
                auction: {
                    id: 'auction-1',
                    ...data.auction.create,
                },
            }));
        });

        it('allows a linked auction to be created when the retail source has no HPI report', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                ...baseSource,
                hpiReport: null,
            });

            const result = await service.alsoAuction('listing-1', 'seller-1', {
                startTime: new Date(Date.now() + 60_000).toISOString(),
                reservePrice: 9000,
                startingBid: 9500,
                minIncrement: 100,
                buyItNowPrice: 12000,
            });

            expect(result).toBeDefined();
            expect(prisma.listing.create).toHaveBeenCalled();
        });

        it('atomically claims the active retail source before creating the linked auction', async () => {
            const result = await service.alsoAuction('listing-1', 'seller-1', {
                startTime: new Date(Date.now() + 60_000).toISOString(),
                reservePrice: 9000,
                startingBid: 9500,
                minIncrement: 100,
                buyItNowPrice: 12000,
            });

            expect(prisma.listing.updateMany).toHaveBeenCalledWith({
                where: {
                    id: 'listing-1',
                    sellerId: 'seller-1',
                    type: 'CLASSIFIED',
                    status: 'ACTIVE',
                    linkedListingId: null,
                    deletedAt: null,
                },
                data: { linkedListingId: expect.any(String) },
            });

            expect(prisma.listing.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: 'AUCTION',
                        status: 'PENDING_REVIEW',
                        linkedListingId: 'listing-1',
                        auction: {
                            create: expect.objectContaining({
                                status: 'SCHEDULED',
                                startingBid: 7000,
                                reservePrice: 9000,
                                minIncrement: 100,
                                buyItNowPrice: 12000,
                            }),
                        },
                    }),
                    include: { auction: true },
                }),
            );

            expect(prisma.auction.create).not.toHaveBeenCalled();
            expect(result).toEqual({
                linkedListingId: expect.any(String),
                auctionId: 'auction-1',
            });
        });

        it('rejects the second concurrent request when the retail source has already been claimed', async () => {
            prisma.listing.updateMany.mockResolvedValue({ count: 0 });

            await expect(
                service.alsoAuction('listing-1', 'seller-1', {
                    startTime: new Date(Date.now() + 60_000).toISOString(),
                    reservePrice: 9000,
                }),
            ).rejects.toThrow(/changed while the auction was being created/i);

            expect(prisma.listing.create).not.toHaveBeenCalled();
        });

        it.each([
            ['SOLD', null],
            ['WITHDRAWN', null],
            ['ACTIVE', 'existing-linked-listing'],
        ])('rejects an ineligible source state %s / linked=%s inside the transaction', async (status, linkedListingId) => {
            prisma.listing.findUnique.mockResolvedValue({
                ...baseSource,
                status,
                linkedListingId,
            });

            await expect(
                service.alsoAuction('listing-1', 'seller-1', {
                    startTime: new Date(Date.now() + 60_000).toISOString(),
                    reservePrice: 9000,
                }),
            ).rejects.toBeInstanceOf(BadRequestException);

            expect(prisma.listing.updateMany).not.toHaveBeenCalled();
            expect(prisma.listing.create).not.toHaveBeenCalled();
        });

        it('keeps the linked auction under review while its Auction row remains scheduled', async () => {
            await service.alsoAuction('listing-1', 'seller-1', {
                startTime: new Date(Date.now() + 60_000).toISOString(),
                reservePrice: 9000,
            });

            const data = prisma.listing.create.mock.calls[0][0].data;
            expect(data.status).toBe('PENDING_REVIEW');
            expect(data.auction.create.status).toBe('SCHEDULED');
            expect(data.auction.create.startingBid).toBe(7000);
            expect(data.auction.create.endTime.getTime() - data.auction.create.startTime.getTime())
                .toBe(24 * 60 * 60 * 1000);
        });
    });
});
