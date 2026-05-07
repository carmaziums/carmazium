import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { SellersService } from '../sellers/sellers.service';

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
            },
            sale: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                aggregate: jest.fn(),
                create: jest.fn(),
            },
            dealerStaff: { findFirst: jest.fn() },
            $transaction: jest.fn(async (cb: any) => cb(prisma)),
        };
        sellers = { incrementListings: jest.fn(), incrementSales: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ListingsService,
                { provide: PrismaService, useValue: prisma },
                { provide: SellersService, useValue: sellers },
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
});
