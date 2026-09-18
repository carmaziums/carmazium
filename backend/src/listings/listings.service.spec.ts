import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { ScraperService } from '../scraper/scraper.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

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

    beforeEach(async () => {
        prisma = {
            listing: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
                aggregate: jest.fn(),
                update: jest.fn(),
                create: jest.fn(),
            },
            sale: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                aggregate: jest.fn(),
                create: jest.fn(),
            },
            dealerStaff: { findFirst: jest.fn() },
            user: { findUnique: jest.fn() },
            transaction: { findMany: jest.fn() },
            hpiReport: { findUnique: jest.fn().mockResolvedValue({ id: 'hpi-1' }) },
            auction: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
            $transaction: jest.fn(async (arg: any) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma)),
        };
        sellers = { incrementListings: jest.fn(), incrementSales: jest.fn() };
        const config = { get: jest.fn() };
        const scraper = {};
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
            ],
        }).compile();

        service = module.get<ListingsService>(ListingsService);
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
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
            videoUrls: [],
        };

        it('normalises a legacy client starting bid to 70% of the retail/reference price', async () => {
            prisma.listing.findUnique.mockResolvedValue(baseSource);
            prisma.listing.create.mockResolvedValue({ id: 'auction-listing-1', title: 'BMW M3', sellerId: 'seller-1' });
            prisma.auction.create.mockResolvedValue({ id: 'auction-1' });
            prisma.listing.update.mockResolvedValue({});

            await service.alsoAuction('listing-1', 'seller-1', {
                startTime: new Date(Date.now() + 60_000).toISOString(),
                reservePrice: 9000,
                startingBid: 9500,
            });

            expect(prisma.auction.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ startingBid: 7000 }),
                }),
            );
        });

        it('accepts a starting bid at exactly 70% of the retail listing price', async () => {
            prisma.listing.findUnique.mockResolvedValue(baseSource);
            prisma.listing.create = jest.fn().mockResolvedValue({ id: 'auction-listing-1' });
            prisma.auction.create.mockResolvedValue({ id: 'auction-1' });
            prisma.listing.update.mockResolvedValue({});

            const result = await service.alsoAuction('listing-1', 'seller-1', {
                startTime: new Date(Date.now() + 60_000).toISOString(),
                reservePrice: 9000,
                startingBid: 7000,
            });

            expect(result).toEqual({ linkedListingId: 'auction-listing-1', auctionId: 'auction-1' });
        });
    });
});
