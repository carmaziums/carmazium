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
import { DvlaService } from '../dvla/dvla.service';
import * as marketSearch from './live-market-search';

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
    let dvla: { lookupVrm: jest.Mock };
    let config: { get: jest.Mock };

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
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(0),
                aggregate: jest.fn(),
                create: jest.fn(),
                upsert: jest.fn(),
            },
            offer: {
                findFirst: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            user: { findUnique: jest.fn() },
            analyticsEvent: {
                findUnique: jest.fn().mockResolvedValue(null),
                findFirst: jest.fn().mockResolvedValue(null),
                findMany: jest.fn().mockResolvedValue([]),
                create: jest.fn().mockResolvedValue({}),
            },
            transaction: { findMany: jest.fn(), update: jest.fn() },
            hpiReport: { findUnique: jest.fn().mockResolvedValue({ id: 'hpi-1' }) },
            auction: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
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
        sellers = {
            incrementListings: jest.fn().mockResolvedValue(undefined),
            incrementSales: jest.fn().mockResolvedValue(undefined),
        };
        config = {
            get: jest.fn((key: string) =>
                key === 'SUPABASE_URL' ? 'https://test.supabase.co' : undefined,
            ),
        };
        scraper = { scrape: jest.fn() };
        dvla = { lookupVrm: jest.fn().mockResolvedValue({
            vrm: 'BF10XYP', make: 'VOLKSWAGEN', model: 'GOLF',
            year: 2010, dataSource: 'DVLA',
        }) };
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
                { provide: DvlaService, useValue: dvla },
            ],
        }).compile();

        service = module.get<ListingsService>(ListingsService);
    });

    describe('Block 1 registration identity safeguards', () => {
        it('rejects a Ford make submitted for a Volkswagen registration before market search', async () => {
            await expect(service.estimateVehicleValue({
                registration: 'BF10XYP', make: 'FORD', model: 'FIESTA',
                year: 2010, mileage: 50000,
            } as any)).rejects.toThrow(/make does not match/i);
            expect(prisma.listing.findMany).not.toHaveBeenCalled();
        });

        it('rejects an invented performance model before market search', async () => {
            await expect(service.estimateVehicleValue({
                registration: 'BF10XYP', make: 'VOLKSWAGEN', model: 'GOLF R',
                year: 2010, mileage: 50000,
            } as any)).rejects.toThrow(/model does not match/i);
            expect(prisma.listing.findMany).not.toHaveBeenCalled();
        });

        it('fails closed if the registration service is unavailable', async () => {
            dvla.lookupVrm.mockRejectedValueOnce(new Error('DVLA unavailable'));
            await expect(service.estimateVehicleValue({
                registration: 'BF10XYP', make: 'VOLKSWAGEN', model: 'GOLF',
                year: 2010, mileage: 50000,
            } as any)).rejects.toThrow(/DVLA unavailable/i);
            expect(prisma.listing.findMany).not.toHaveBeenCalled();
        });

        it('does not call DVLA when a registration is not provided', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            jest.spyOn(service as any, 'getLiveUkMarketComparables').mockResolvedValue(null);
            const result = await service.estimateVehicleValue({
                make: 'FORD', model: 'FOCUS', year: 2019, mileage: 45000,
            } as any);
            expect(dvla.lookupVrm).not.toHaveBeenCalled();
            expect(result.identityVerification?.status).toBe('UNVERIFIED');
            expect(result.confidence).toBe('LOW');
        });
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

        it('rejects initial auction creation when Buy It Now is below reserve', async () => {
            prisma.listing.findMany.mockResolvedValue([]);

            await expect(
                service.create(
                    makeAuctionListing({
                        auctionStartTime: new Date(Date.now() + 60_000).toISOString(),
                        auctionReservePrice: 9000,
                        auctionMinIncrement: 100,
                        auctionBuyItNowPrice: 8500,
                    }) as any,
                    sellerId,
                ),
            ).rejects.toMatchObject({
                message: 'Buy It Now price must be equal to or higher than the reserve price.',
            });

            expect(prisma.listing.create).not.toHaveBeenCalled();
            expect(prisma.auction.create).not.toHaveBeenCalled();
        });

        it('allows initial auction Buy It Now to equal reserve', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            prisma.listing.create.mockResolvedValue({
                id: 'listing-new',
                title: 'BMW M3 Auction',
                sellerId,
                type: 'AUCTION',
                status: 'DRAFT',
            });
            prisma.auction.create.mockResolvedValue({ id: 'auction-new' });

            await service.create(
                makeAuctionListing({
                    auctionStartTime: new Date(Date.now() + 60_000).toISOString(),
                    auctionReservePrice: 9000,
                    auctionMinIncrement: 100,
                    auctionBuyItNowPrice: 9000,
                }) as any,
                sellerId,
            );

            expect(prisma.auction.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        reservePrice: 9000,
                        buyItNowPrice: 9000,
                    }),
                }),
            );
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

    describe('controlled sale completion', () => {
        it('routes generic SOLD through recordSale and uses the accepted buyer/price', async () => {
            const active = {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'OFFER_ACCEPTED',
                type: 'CLASSIFIED',
                price: 12000,
                deletedAt: null,
            };
            const sold = { ...active, status: 'SOLD' };
            prisma.listing.findUnique
                .mockResolvedValueOnce(active)
                .mockResolvedValueOnce(active)
                .mockResolvedValueOnce(sold);
            prisma.listing.updateMany.mockResolvedValue({ count: 1 });
            prisma.offer.findFirst.mockResolvedValue({
                id: 'offer-1',
                listingId: 'listing-1',
                buyerId: 'buyer-1',
                amount: 10000,
                finalAmount: 10500,
                counterAmount: 10500,
                status: 'ACCEPTED',
                buyer: {
                    firstName: 'Test',
                    lastName: 'Buyer',
                    email: 'buyer@example.test',
                },
            });

            await service.updateStatus('listing-1', 'seller-1', 'SOLD' as any);

            expect(prisma.sale.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { listingId: 'listing-1' },
                    create: expect.objectContaining({
                        listingId: 'listing-1',
                        sellerId: 'seller-1',
                        buyerId: 'buyer-1',
                        soldPrice: 10500,
                    }),
                    update: expect.objectContaining({
                        buyerId: 'buyer-1',
                        soldPrice: 10500,
                    }),
                }),
            );
            expect(sellers.incrementSales).toHaveBeenCalledWith('seller-1');
        });

        it('does not allow a sold listing to be reactivated outside cancellation', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'SOLD',
                type: 'CLASSIFIED',
                price: 12000,
                deletedAt: null,
            });

            await expect(
                service.updateStatus('listing-1', 'seller-1', 'ACTIVE' as any),
            ).rejects.toThrow(/sale cancellation workflow/i);

            expect(prisma.listing.update).not.toHaveBeenCalled();
        });

        it('does not allow an accepted deal to be reactivated outside cancellation', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'OFFER_ACCEPTED',
                type: 'CLASSIFIED',
                price: 12000,
                deletedAt: null,
            });

            await expect(
                service.updateStatus('listing-1', 'seller-1', 'ACTIVE' as any),
            ).rejects.toThrow(/sale cancellation workflow/i);

            expect(prisma.listing.update).not.toHaveBeenCalled();
        });

        it('blocks manual SOLD transitions for auction listings', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                type: 'AUCTION',
                price: 12000,
                deletedAt: null,
            });

            await expect(
                service.updateStatus('listing-1', 'seller-1', 'SOLD' as any),
            ).rejects.toThrow(/auction lifecycle/i);

            expect(prisma.sale.upsert).not.toHaveBeenCalled();
        });

        it('uses compare-and-set so a racing sale completion cannot double-count', async () => {
            const active = {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                type: 'CLASSIFIED',
                price: 12000,
                deletedAt: null,
            };
            prisma.listing.findUnique.mockResolvedValue(active);
            prisma.listing.updateMany.mockResolvedValue({ count: 0 });

            await expect(
                service.recordSale('listing-1', 'seller-1', { soldPrice: 11500 }),
            ).rejects.toThrow(/changed while the sale was being recorded/i);

            expect(prisma.sale.upsert).not.toHaveBeenCalled();
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

    describe('dashboard earnings integrity', () => {
        it('uses Sale count as the seller completed-sales source of truth', async () => {
            prisma.dealerStaff.findFirst.mockResolvedValue(null);
            prisma.listing.count.mockResolvedValue(7);
            prisma.listing.aggregate.mockResolvedValue({ _sum: { viewCount: 20 } });
            prisma.sale.count.mockResolvedValue(5);
            prisma.sale.aggregate.mockResolvedValue({ _sum: { soldPrice: 189300 } });

            const stats = await service.getSellerStats('seller-1');

            expect(stats.soldListings).toBe(5);
            expect(prisma.sale.count).toHaveBeenCalledWith({ where: { sellerId: 'seller-1' } });
        });

        it('does not double-count auction Sale rows in earnings totals', async () => {
            prisma.dealerStaff.findFirst.mockResolvedValue(null);
            prisma.sale.findMany.mockResolvedValue([]);
            prisma.sale.count.mockResolvedValue(2);
            prisma.sale.aggregate.mockResolvedValue({ _sum: { soldPrice: 138100 } });
            prisma.auction.findMany.mockResolvedValue([
                {
                    id: 'auction-1',
                    listingId: 'listing-1',
                    winningBidAmount: 120100,
                    sellerBonusReleasedAt: new Date('2026-09-20T12:00:00Z'),
                    updatedAt: new Date('2026-09-20T12:00:00Z'),
                    listing: { id: 'listing-1', title: 'Auction Vehicle', images: [], vrm: 'AA11AAA' },
                    winner: { id: 'buyer-1', firstName: 'Buyer', lastName: 'One', email: 'buyer@example.test' },
                },
            ]);

            const result = await service.getEarnings('seller-1');

            expect(result.totalRevenue).toBe(138100);
            expect(result.totalSales).toBe(2);
            expect(result.totalAuctionRevenue).toBe(120100);
            expect(result.totalAuctionSales).toBe(1);
            expect(result.totalAuctionBonus).toBe(100);
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

    describe('stable valuation journey base', () => {
        const valuationId = '11111111-1111-4111-8111-111111111111';

        it('persists the first market base against the valuation journey ID', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            jest.spyOn(service as any, 'getLiveUkMarketComparables').mockResolvedValue({
                checkedAt: '2026-09-27T10:00:00.000Z',
                rawComparableCount: 1,
                comparables: [
                    { price: 4200, year: 2010, mileage: 138734, kind: 'ACTIVE_ASK' },
                ],
            });

            const result = await service.estimateVehicleValue({
                make: 'VOLKSWAGEN',
                model: 'Golf',
                year: 2010,
                mileage: 138734,
                registration: 'BF10 XYP',
                valuationId,
            } as any);

            expect(result.auction.marketValue).toBeGreaterThan(0);
            expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: valuationId,
                    type: 'valuation_base_snapshot',
                    sessionId: expect.stringMatching(/^valuation-base:[a-f0-9]{64}$/),
                    payload: expect.objectContaining({
                        valuation_id: valuationId,
                        identity: {
                            registration: 'BF10XYP',
                            make: 'VOLKSWAGEN',
                            model: 'GOLF',
                            year: 2010,
                            mileage: 138734,
                        },
                        baseValuation: expect.objectContaining({
                            auction: expect.objectContaining({
                                marketValue: expect.any(Number),
                            }),
                        }),
                    }),
                }),
            });
        });

        it('reuses the frozen base and does not search the live market again', async () => {
            const frozenBase = {
                low: 4200,
                mid: 4750,
                high: 5300,
                confidence: 'LOW',
                confidenceScore: 0.28,
                comparables: 1,
                evidence: {
                    completedSales: 0,
                    acceptedOffers: 0,
                    auctionResults: 0,
                    activeAsks: 1,
                },
                source: 'CARMAZIUM_MARKET',
                explanation: 'Frozen base',
                retail: {
                    suggestedAsking: 5300,
                    suggestedMinimum: 4750,
                },
                auction: {
                    marketValue: 4200,
                    openingBid: 2940,
                    reserveLow: 3780,
                    reserveHigh: 4200,
                    suggestedReserve: 4000,
                },
                marketEvidence: {
                    carmaziumComparables: 1,
                    liveUkComparables: 0,
                    liveUkSearchStatus: 'INSUFFICIENT',
                    rawLiveUkComparables: 0,
                },
            };

            prisma.analyticsEvent.findUnique.mockResolvedValue({
                id: valuationId,
                type: 'valuation_base_snapshot',
                payload: {
                    identity: {
                        registration: 'BF10XYP',
                        make: 'VOLKSWAGEN',
                        model: 'GOLF',
                        year: 2010,
                        mileage: 138734,
                    },
                    baseValuation: frozenBase,
                },
            });

            const liveSearch = jest.spyOn(service as any, 'getLiveUkMarketComparables');

            const result = await service.estimateVehicleValue({
                make: 'Volkswagen',
                model: 'Golf',
                year: 2010,
                mileage: 138734,
                registration: 'BF10 XYP',
                valuationId,
                condition: 'POOR',
            } as any);

            expect(liveSearch).not.toHaveBeenCalled();
            expect(prisma.listing.findMany).not.toHaveBeenCalled();
            expect(result.source).toBe('CARMAZIUM_MARKET');
            expect(result.marketEvidence).toEqual(frozenBase.marketEvidence);
            expect(result.auction.marketValue).toBeLessThan(4200);
        });

        it('rejects reusing a valuation journey after registration or mileage changes', async () => {
            prisma.analyticsEvent.findUnique.mockResolvedValue({
                id: valuationId,
                type: 'valuation_base_snapshot',
                payload: {
                    identity: {
                        registration: 'BF10XYP',
                        make: 'VOLKSWAGEN',
                        model: 'GOLF',
                        year: 2010,
                        mileage: 138734,
                    },
                    baseValuation: {
                        low: 4200,
                        mid: 4750,
                        high: 5300,
                        confidence: 'LOW',
                        confidenceScore: 0.28,
                        comparables: 1,
                        evidence: {
                            completedSales: 0,
                            acceptedOffers: 0,
                            auctionResults: 0,
                            activeAsks: 1,
                        },
                        source: 'CARMAZIUM_MARKET',
                        explanation: 'Frozen base',
                        retail: {
                            suggestedAsking: 5300,
                            suggestedMinimum: 4750,
                        },
                        auction: {
                            marketValue: 4200,
                            openingBid: 2940,
                            reserveLow: 3780,
                            reserveHigh: 4200,
                            suggestedReserve: 4000,
                        },
                    },
                },
            });

            await expect(service.estimateVehicleValue({
                make: 'VOLKSWAGEN',
                model: 'Golf',
                year: 2010,
                mileage: 140000,
                registration: 'BF10XYP',
                valuationId,
            } as any)).rejects.toThrow(/registration or mileage changed/i);
        });

        it('reuses the same vehicle base across a new journey for 24 hours', async () => {
            const previousJourneyBase = {
                low: 2650,
                mid: 3100,
                high: 3300,
                confidence: 'LOW',
                confidenceScore: 0.42,
                comparables: 6,
                evidence: {
                    completedSales: 0,
                    acceptedOffers: 0,
                    auctionResults: 0,
                    activeAsks: 6,
                },
                source: 'BLENDED_MARKET',
                explanation: 'Frozen same-vehicle base',
                retail: {
                    suggestedAsking: 3300,
                    suggestedMinimum: 3100,
                },
                auction: {
                    marketValue: 2650,
                    openingBid: 1855,
                    reserveLow: 2385,
                    reserveHigh: 2650,
                    suggestedReserve: 2500,
                },
            };

            prisma.analyticsEvent.findUnique.mockResolvedValueOnce(null);
            prisma.analyticsEvent.findFirst.mockResolvedValueOnce({
                id: '22222222-2222-4222-8222-222222222222',
                type: 'valuation_base_snapshot',
                payload: {
                    identity: {
                        registration: 'BF10XYP',
                        make: 'VOLKSWAGEN',
                        model: 'GOLF',
                        year: 2010,
                        mileage: 138734,
                    },
                    baseValuation: previousJourneyBase,
                },
            });

            const liveSearch = jest.spyOn(service as any, 'getLiveUkMarketComparables');

            const result = await service.estimateVehicleValue({
                make: 'Volkswagen',
                model: 'Golf',
                year: 2010,
                mileage: 138734,
                registration: 'BF10 XYP',
                valuationId: '33333333-3333-4333-8333-333333333333',
            } as any);

            expect(result.auction.marketValue).toBe(2650);
            expect(liveSearch).not.toHaveBeenCalled();
            expect(prisma.listing.findMany).not.toHaveBeenCalled();
            expect(prisma.analyticsEvent.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        type: 'valuation_base_snapshot',
                        sessionId: expect.stringMatching(/^valuation-base:[a-f0-9]{64}$/),
                    }),
                }),
            );
            expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: '33333333-3333-4333-8333-333333333333',
                    type: 'valuation_base_snapshot',
                    sessionId: expect.stringMatching(/^valuation-base:[a-f0-9]{64}$/),
                    payload: expect.objectContaining({
                        valuation_id: '33333333-3333-4333-8333-333333333333',
                        reusedFromSnapshotId: '22222222-2222-4222-8222-222222222222',
                        baseValuation: expect.objectContaining({
                            auction: expect.objectContaining({ marketValue: 2650 }),
                        }),
                    }),
                }),
            });
        });

        it('returns the winning frozen base when two requests race to create the same journey', async () => {
            const winnerBase = {
                low: 2650,
                mid: 3100,
                high: 3300,
                confidence: 'LOW',
                confidenceScore: 0.42,
                comparables: 6,
                evidence: {
                    completedSales: 0,
                    acceptedOffers: 0,
                    auctionResults: 0,
                    activeAsks: 6,
                },
                source: 'BLENDED_MARKET',
                explanation: 'Winning base',
                retail: {
                    suggestedAsking: 3300,
                    suggestedMinimum: 3100,
                },
                auction: {
                    marketValue: 2650,
                    openingBid: 1855,
                    reserveLow: 2385,
                    reserveHigh: 2650,
                    suggestedReserve: 2500,
                },
            };

            prisma.listing.findMany.mockResolvedValue([]);
            jest.spyOn(service as any, 'getLiveUkMarketComparables').mockResolvedValue(null);
            prisma.analyticsEvent.create.mockRejectedValueOnce({ code: 'P2002' });
            prisma.analyticsEvent.findFirst.mockResolvedValue(null);
            prisma.analyticsEvent.findUnique
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({
                    id: valuationId,
                    type: 'valuation_base_snapshot',
                    payload: {
                        identity: {
                            registration: 'BF10XYP',
                            make: 'VOLKSWAGEN',
                            model: 'GOLF',
                            year: 2010,
                            mileage: 138734,
                        },
                        baseValuation: winnerBase,
                    },
                });

            const result = await service.estimateVehicleValue({
                make: 'VOLKSWAGEN',
                model: 'Golf',
                year: 2010,
                mileage: 138734,
                registration: 'BF10XYP',
                valuationId,
            } as any);

            expect(result.auction.marketValue).toBe(2650);
            expect(result.source).toBe('BLENDED_MARKET');
        });
    });

    describe('Block 7 frozen-base deterministic seller edits', () => {
        const id = '77777777-7777-4777-8777-777777777777';
        const storedBase = {
            low: 7500, mid: 9000, high: 10500,
            source: 'LIVE_UK_MARKET',
            confidence: 'MEDIUM', confidenceScore: 0.58,
            comparables: 4, evidence: {
                completedSales: 0, acceptedOffers: 0, auctionResults: 0, activeAsks: 4,
            },
            explanation: 'Frozen genuine advert evidence.',
            marketEvidence: {
                carmaziumComparables: 0, liveUkComparables: 4,
                liveUkAttempts: 1, blendedMarketAttempts: 0,
                valuationStrategy: 'LIVE',
            },
            retail: {
                suggestedAsking: 10800, suggestedMinimum: 9200,
                evidenceBasis: 'OBSERVED', observedAsks: 4,
            },
            privateSale: {
                low: 7000, mid: 8100, high: 9000,
                evidenceBasis: 'PROVISIONAL_PROXY', verifiedSales: 0,
            },
            auction: {
                marketValue: 6900, openingBid: 5100, reserveLow: 6400,
                reserveHigh: 7300, suggestedReserve: 6900,
                evidenceBasis: 'OBSERVED', verifiedOutcomes: 5,
            },
        };
        const identity = {
            make: 'VOLKSWAGEN', model: 'GOLF', year: 2010,
            mileage: 138734, registration: 'BF10XYP',
        };
        const request = {
            ...identity, valuationId: id,
        };

        beforeEach(() => {
            prisma.analyticsEvent.findUnique.mockResolvedValue({
                id, type: 'valuation_base_snapshot', payload: {
                    identity, baseValuation: storedBase,
                },
            });
        });

        it('returns a path-independent price after sequential seller edits without repeated market search', async () => {
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables');
            const poor = await service.estimateVehicleValue({
                ...request, condition: 'POOR', exteriorGrade: 5, transmission: 'MANUAL',
            } as any);
            const clean = await service.estimateVehicleValue({
                ...request, condition: 'EXCELLENT', exteriorGrade: 1, transmission: 'CVT',
                ulezCompliant: true, euroStandard: 'EURO_4',
            } as any);
            const editedBack = await service.estimateVehicleValue({
                ...request, condition: 'POOR', exteriorGrade: 5, transmission: 'MANUAL',
            } as any);
            expect(search).not.toHaveBeenCalled();
            expect(prisma.listing.findMany).not.toHaveBeenCalled();
            expect(poor.mid).toBeLessThan(clean.mid);
            expect(editedBack.mid).toBe(poor.mid);
            expect(editedBack.retail.suggestedAsking).toBe(poor.retail.suggestedAsking);
            expect(editedBack.auction.suggestedReserve).toBe(poor.auction.suggestedReserve);
            expect(editedBack.privateSale?.mid).toBe(poor.privateSale?.mid);
            expect(clean.specificationAdjustment?.base.mid).toBe(storedBase.mid);
            expect(clean.marketEvidence).toEqual(storedBase.marketEvidence);
            expect(clean.auction.verifiedOutcomes).toBe(5);
        });

        it('normalizes equivalent hyphenated trim and fuel/transmission aliases on the same frozen base', async () => {
            const a = await service.estimateVehicleValue({
                ...request, variant: 'ST-LINE', fuelType: 'PETROL_PLUGIN_HYBRID',
                transmission: 'SEMI_AUTOMATIC',
            } as any);
            const b = await service.estimateVehicleValue({
                ...request, variant: 'ST LINE', fuelType: 'Petrol Plug-in Hybrid',
                transmission: 'Semi-Automatic',
            } as any);
            expect(a.mid).toBe(b.mid);
            expect(a.retail).toEqual(b.retail);
            expect(a.privateSale).toEqual(b.privateSale);
            expect(a.auction).toEqual(b.auction);
            expect(a.specificationAdjustment?.reasonCodes)
                .toEqual(b.specificationAdjustment?.reasonCodes);
        });
    });

    describe('Block 6 completed-sale provenance and separate channels', () => {
        const car = { make: 'VOLKSWAGEN', model: 'GOLF', year: 2018, mileage: 57000 };
        const common = {
            type: 'AUCTION',
            status: 'SOLD',
            year: 2018, mileage: 57000, make: 'VOLKSWAGEN', model: 'GOLF',
            price: 15000, fuelType: 'PETROL', transmission: 'MANUAL',
            variant: null, writeOffCategory: null, condition: null,
            serviceHistory: null, owners: null, sale: { soldPrice: 99999 },
            offers: [],
        };
        const completed = (id: string, winningBidAmount: number) => ({
            ...common, id,
            auction: {
                status: 'ENDED', winnerId: 'winner', winningBidAmount,
                buyerFeePaid: true, sellerFundsConfirmedAt: new Date(),
                sellerFundsConfirmationRequired: true,
                sellerBonusReleased: true, buyerRefusedAt: null,
            },
        });

        it('uses only handed-over completed auctions; pending high bids cannot inflate the guide', async () => {
            const pending = {
                ...completed('pending', 65_000),
                auction: {
                    ...completed('pending', 65_000).auction,
                    sellerBonusReleased: false,
                },
            };
            prisma.listing.findMany.mockResolvedValue([
                completed('one', 5800), completed('two', 6300),
                completed('three', 6700), pending,
            ]);
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue(null);
            const result = await service.estimateVehicleValue(car as any);
            expect(search).toHaveBeenCalledTimes(10);
            expect(result.evidence.auctionResults).toBe(3);
            expect(result.auction.evidenceBasis).toBe('OBSERVED');
            expect(result.auction.verifiedOutcomes).toBe(3);
            expect(result.auction.marketValue).toBe(6300);
            expect(result.privateSale?.evidenceBasis).toBe('PROVISIONAL_PROXY');
        });

        it('prefers a completed classified sold price over an earlier accepted offer', async () => {
            prisma.listing.findMany.mockResolvedValue([{
                ...common, id: 'sold-retail', type: 'CLASSIFIED',
                sale: { soldPrice: 9000 },
                offers: [{ amount: 15000, finalAmount: 14900, status: 'ACCEPTED' }],
                auction: null,
            }]);
            jest.spyOn(service as any, 'getLiveUkMarketComparables').mockResolvedValue(null);
            const result = await service.estimateVehicleValue(car as any);
            expect(result.evidence.completedSales).toBe(1);
            expect(result.evidence.acceptedOffers).toBe(0);
            expect(result.privateSale?.verifiedSales).toBe(0);
            expect(result.privateSale?.evidenceBasis).toBe('PROVISIONAL_PROXY');
            expect(result.auction.verifiedOutcomes).toBe(0);
        });
    });

    describe('Block 5 unique advert evidence across live attempts', () => {
        const car = {
            make: 'VOLKSWAGEN', model: 'GOLF', year: 2018, mileage: 57000,
        };
        const row = (url: string, price: number) => ({
            sourceUrl: url, sourceDomain: 'dealer.example',
            listingTitle: '2018 Volkswagen Golf SE',
            price, year: 2018, mileage: 57000,
            variant: 'SE', transmission: 'MANUAL',
            kind: 'ACTIVE_ASK' as const,
            modelMatchQuality: 'EXACT_MODEL' as const,
        });
        const result = (comparables: ReturnType<typeof row>[]) => ({
            checkedAt: '2026-10-02T12:00:00.000Z',
            sourceDomains: ['dealer.example'],
            rawComparableCount: comparables.length, comparables,
        });

        it('does not inflate comparable count from repeats across five search passes', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            const a = row('https://dealer.example/cars/golf-123?utm_source=pass1', 10995);
            const repeat = row('https://dealer.example/cars/golf-123?utm_source=pass2', 10995);
            const b = row('https://dealer.example/cars/golf-456', 10750);
            const c = row('https://dealer.example/cars/golf-789', 10995);
            // The first two cars share the same price and mileage. They
            // must remain independent; only a repeat of the same URL merges.
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValueOnce(result([a, b]))
                .mockResolvedValueOnce(result([repeat]))
                .mockResolvedValueOnce(result([c]))
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);

            const valuation = await service.estimateVehicleValue(car as any);
            expect(search).toHaveBeenCalledTimes(5);
            expect(valuation.source).toBe('LIVE_UK_MARKET');
            expect(valuation.marketEvidence?.liveUkComparables).toBe(3);
            expect(valuation.marketEvidence?.blendedMarketAttempts).toBe(0);
        });

        it('frozen results are unchanged when downstream sources repeat a known URL', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            const a = row('https://dealer.example/cars/golf-123', 10995);
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue(result([a]));
            const first = await service.estimateVehicleValue(car as any);
            const repeated = await service.estimateVehicleValue(car as any);
            expect(first.mid).toBe(repeated.mid);
            expect(first.marketEvidence?.liveUkComparables).toBe(1);
            expect(repeated.marketEvidence?.liveUkComparables).toBe(1);
            expect(search).toHaveBeenCalledTimes(10);
        });
    });

    describe('Block 4 reliable live search delivery', () => {
        const car = { make: 'Audi', model: 'Audi A1', year: 2018, mileage: 106470,
            variant: 'Sport', fuelType: 'Petrol', transmission: 'Manual' };
        const evidence = {
            checkedAt: '2026-10-02T12:00:00.000Z',
            rawComparableCount: 1,
            sourceDomains: ['dealer.example'],
            comparables: [{ price: 7200, year: 2018, mileage: 106470, kind: 'ACTIVE_ASK' }],
        };

        it('shares an in-flight external search without skipping distinct plan attempts', async () => {
            config.get.mockImplementation((key: string) =>
                key === 'OPENAI_API_KEY' ? 'test-key' : undefined);
            let finish!: (value: typeof evidence) => void;
            const pending = new Promise<typeof evidence>((resolve) => { finish = resolve; });
            const sdk = jest.spyOn(marketSearch, 'searchLiveUkVehicleMarket')
                .mockImplementation(() => pending as any);
            try {
                const first = (service as any).getLiveUkMarketComparables(car, { phase: 'LIVE', attempt: 1 });
                const duplicate = (service as any).getLiveUkMarketComparables({
                    ...car, model: 'A1',
                }, { phase: 'LIVE', attempt: 1 });
                finish(evidence);
                expect(await first).toEqual(evidence);
                expect(await duplicate).toEqual(evidence);
                expect(sdk).toHaveBeenCalledTimes(1);

                // Same first plan after settlement: no retained search data
                // while contractual short caching is disabled.
                expect(await (service as any).getLiveUkMarketComparables(
                    car, { phase: 'LIVE', attempt: 1 },
                )).toEqual(evidence);
                // Second plan must still be searched, not treated as a retry
                // of plan one or suppressed by the shared result.
                expect(await (service as any).getLiveUkMarketComparables(
                    car, { phase: 'LIVE', attempt: 2 },
                )).toEqual(evidence);
                expect(sdk).toHaveBeenCalledTimes(3);
                expect(sdk.mock.calls[0][1].timeoutMs).toBe(18_000);
            } finally {
                sdk.mockRestore();
            }
        });

        it('applies only bounded, explicitly configured per-search timeout', async () => {
            config.get.mockImplementation((key: string) => ({
                OPENAI_API_KEY: 'test-key',
                OPENAI_WEB_VALUATION_TIMEOUT_MS: '999999',
            } as Record<string, string>)[key]);
            const sdk = jest.spyOn(marketSearch, 'searchLiveUkVehicleMarket')
                .mockResolvedValue(evidence as any);
            try {
                await (service as any).getLiveUkMarketComparables(
                    car, { phase: 'LIVE', attempt: 1 },
                );
                expect(sdk.mock.calls[0][1].timeoutMs).toBe(22_000);
            } finally {
                sdk.mockRestore();
            }
        });

        it('treats an individual plan failure as recoverable, never as a fake comparable', async () => {
            config.get.mockImplementation((key: string) =>
                key === 'OPENAI_API_KEY' ? 'test-key' : undefined);
            const sdk = jest.spyOn(marketSearch, 'searchLiveUkVehicleMarket')
                .mockRejectedValueOnce(new Error('provider timeout'))
                .mockResolvedValue(evidence as any);
            const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation();
            try {
                expect(await (service as any).getLiveUkMarketComparables(
                    car, { phase: 'LIVE', attempt: 1 },
                )).toBeNull();
                expect(await (service as any).getLiveUkMarketComparables(
                    car, { phase: 'LIVE', attempt: 2 },
                )).toEqual(evidence);
                // Failed results are not retained, so a later first-plan
                // retry may again consult the actual first source.
                expect(await (service as any).getLiveUkMarketComparables(
                    car, { phase: 'LIVE', attempt: 1 },
                )).toEqual(evidence);
                expect(sdk).toHaveBeenCalledTimes(3);
                expect(JSON.stringify(warn.mock.calls)).not.toContain('provider timeout');
            } finally {
                sdk.mockRestore();
                warn.mockRestore();
            }
        });
    });

    describe('Block 3 licensed market reference isolation', () => {
        const dto = {
            registration: 'BF10XYP', make: 'VOLKSWAGEN', model: 'GOLF',
            year: 2010, mileage: 138734,
            valuationId: '77777777-7777-4777-8777-777777777777',
        };
        const live = {
            checkedAt: '2026-10-02T12:00:00.000Z',
            rawComparableCount: 3,
            sourceDomains: ['example-dealer.co.uk'],
            comparables: [
                { price: 7200, year: 2010, mileage: 135000, kind: 'ACTIVE_ASK' },
                { price: 7350, year: 2010, mileage: 139000, kind: 'ACTIVE_ASK' },
                { price: 7400, year: 2011, mileage: 125000, kind: 'ACTIVE_ASK' },
            ],
        };
        const benchmark = {
            status: 'AVAILABLE',
            benchmark: {
                source: 'CAP_HPI', evidenceType: 'LICENSED_PROVIDER_BENCHMARK',
                checkedAt: '2026-10-02T12:00:00.000Z',
                retail: 7900, tradeClean: 6000, tradeAverage: 5500, tradeBelow: 4800,
            },
        };

        it('keeps CAP reference prices out of consumer quotes and frozen comparable evidence', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            jest.spyOn(service as any, 'getLiveUkMarketComparables').mockResolvedValue(live);
            const reference = jest.spyOn(service as any, 'getLicensedBenchmark');
            reference.mockResolvedValueOnce(null);
            const baseline = await service.estimateVehicleValue(dto as any);
            reference.mockResolvedValueOnce(benchmark);
            const withReference = await service.estimateVehicleValue({
                ...dto, valuationId: '88888888-8888-4888-8888-888888888888',
            } as any);
            expect(reference).toHaveBeenCalledTimes(2);
            expect(withReference.low).toEqual(baseline.low);
            expect(withReference.mid).toEqual(baseline.mid);
            expect(withReference.high).toEqual(baseline.high);
            expect(withReference.source).toBe('LIVE_UK_MARKET');
            const events = prisma.analyticsEvent.create.mock.calls
                .map((call: any[]) => call[0].data);
            const internal = events.find((row: any) => row.type === 'valuation_licensed_benchmark_check');
            expect(internal.payload).toEqual(expect.objectContaining({
                source: 'CAP_HPI', comparisonStatus: 'ALIGNED',
            }));
            expect(JSON.stringify(internal)).not.toMatch(/7900|6000|5500|4800|BF10XYP/);
            const snapshots = events.filter((row: any) => row.type === 'valuation_base_snapshot');
            expect(JSON.stringify(snapshots)).not.toMatch(/CAP_HPI/);
        });

        it('does not abandon all five live/five blended attempts if optional provider is unavailable', async () => {
            prisma.listing.findMany.mockResolvedValue([]);
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue(null);
            const reference = jest.spyOn(service as any, 'getLicensedBenchmark')
                .mockResolvedValue({ status: 'UNAVAILABLE' });
            const result = await service.estimateVehicleValue(dto as any);
            expect(search).toHaveBeenCalledTimes(10);
            expect(reference).toHaveBeenCalledTimes(1);
            expect(result.source).toBe('CARMAZIUM_MODEL');
            expect(result.marketEvidence).toEqual(expect.objectContaining({
                liveUkAttempts: 5, blendedMarketAttempts: 5,
            }));
            const events = prisma.analyticsEvent.create.mock.calls
                .map((call: any[]) => call[0].data);
            expect(events.find((row: any) => row.type === 'valuation_licensed_benchmark_check')
                .payload.comparisonStatus).toBe('UNAVAILABLE');
        });

        it('does not call CAP for an unverified or registration-free valuation by default', async () => {
            const result = await (service as any).getLicensedBenchmark({
                ...dto, registration: undefined,
            }, { status: 'UNVERIFIED' });
            expect(result).toBeNull();
        });
    });

    describe('Block 2: consistent market base across equivalent journeys', () => {
        const audiVrm = 'RO18YWN';
        const firstId = '11111111-1111-4111-8111-111111111111';
        const secondId = '22222222-2222-4222-8222-222222222222';
        const lookup = {
            vrm: audiVrm, make: 'AUDI', model: 'A1',
            year: 2018, dataSource: 'DVLA' as const,
        };
        const firstRequest = {
            registration: 'RO18 YWN', make: 'AUDI', model: 'Audi A1',
            year: 2018, mileage: 106470, valuationId: firstId,
        };
        const secondRequest = {
            ...firstRequest, registration: audiVrm, model: 'A1',
            valuationId: secondId,
        };
        const marketResult = (mid: number) => ({
            checkedAt: '2026-10-02T12:00:00.000Z',
            sourceDomains: ['example-dealer.co.uk'],
            rawComparableCount: 3,
            comparables: [mid - 200, mid, mid + 200].map((price) => ({
                price, year: 2018, mileage: 106470, kind: 'ACTIVE_ASK',
            })),
        });

        beforeEach(() => {
            dvla.lookupVrm.mockResolvedValue(lookup);
            prisma.listing.findMany.mockResolvedValue([]);
        });

        it('reuses a saved Audi A1 base for the equivalent model label without searching again', async () => {
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue(marketResult(7450));
            const first = await service.estimateVehicleValue(firstRequest as any);
            const firstInsert = prisma.analyticsEvent.create.mock.calls[0][0].data;
            const stored = {
                id: firstId, type: 'valuation_base_snapshot',
                payload: firstInsert.payload,
            };
            prisma.analyticsEvent.findFirst.mockResolvedValueOnce(stored);

            const second = await service.estimateVehicleValue(secondRequest as any);
            expect(second.auction.marketValue).toEqual(first.auction.marketValue);
            expect(second.mid).toEqual(first.mid);
            expect(search).toHaveBeenCalledTimes(1);
            expect(prisma.analyticsEvent.create).toHaveBeenCalledTimes(2);
            const inserts = prisma.analyticsEvent.create.mock.calls.map((call: any[]) => call[0].data);
            expect(inserts[0].sessionId).toBe(inserts[1].sessionId);
            expect(inserts[1].payload.reusedFromSnapshotId).toBe(firstId);
        });

        it('assigns legacy VRM requests without valuationId a server journey and reuses the saved base', async () => {
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue(marketResult(7450));
            const legacy = {
                registration: audiVrm, make: 'AUDI',
                model: 'A1', year: 2018, mileage: 106470,
            };
            const first = await service.estimateVehicleValue(legacy as any);
            const firstData = prisma.analyticsEvent.create.mock.calls[0][0].data;
            expect(firstData.id).toMatch(/^[0-9a-f-]{36}$/i);
            prisma.analyticsEvent.findFirst.mockResolvedValueOnce({
                id: firstData.id,
                type: 'valuation_base_snapshot',
                payload: firstData.payload,
            });
            const second = await service.estimateVehicleValue(legacy as any);
            expect(search).toHaveBeenCalledTimes(1);
            expect(second.mid).toBe(first.mid);
            const secondData = prisma.analyticsEvent.create.mock.calls[1][0].data;
            expect(secondData.id).not.toBe(firstData.id);
            expect(secondData.sessionId).toBe(firstData.sessionId);
        });

        it('under the DB lock prefers a newly committed quote over the independently searched result', async () => {
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValueOnce(marketResult(7450))
                .mockResolvedValueOnce(marketResult(5900));
            // Both clients initially observed an empty cache. By the time
            // the second enters its serialized snapshot transaction, the
            // first request has already committed.
            prisma.analyticsEvent.findFirst
                .mockResolvedValueOnce(null) // first pre-search read
                .mockResolvedValueOnce(null) // first under lock
                .mockResolvedValueOnce(null); // second pre-search stale read

            const first = await service.estimateVehicleValue(firstRequest as any);
            const stored = prisma.analyticsEvent.create.mock.calls[0][0].data;
            prisma.analyticsEvent.findFirst.mockResolvedValueOnce({
                id: firstId, type: 'valuation_base_snapshot', payload: stored.payload,
            });
            const second = await service.estimateVehicleValue(secondRequest as any);
            expect(search).toHaveBeenCalledTimes(2);
            expect(second.mid).toBe(first.mid);
            expect(second.auction.marketValue).toBe(first.auction.marketValue);
            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
            // Both labels should take exactly the same cross-instance lock.
            expect(prisma.$queryRaw.mock.calls[0][1]).toBe(
                prisma.$queryRaw.mock.calls[1][1],
            );
            expect(prisma.analyticsEvent.create.mock.calls[1][0].data.payload.reusedFromSnapshotId)
                .toBe(firstId);
        });

        it('an overlapping fallback must not eclipse an earlier usable live base', async () => {
            const liveBase = {
                low: 6500, mid: 7450, high: 8000,
                confidence: 'LOW', confidenceScore: 0.4,
                comparables: 5, evidence: {
                    completedSales: 0, acceptedOffers: 0,
                    auctionResults: 0, activeAsks: 5,
                }, source: 'LIVE_UK_MARKET',
                explanation: 'Older live snapshot', retail: {
                    suggestedAsking: 8000, suggestedMinimum: 7450,
                }, auction: {
                    marketValue: 6500, openingBid: 4550,
                    reserveLow: 5850, reserveHigh: 6500, suggestedReserve: 6150,
                },
            };
            const fallback = {
                ...liveBase, source: 'CARMAZIUM_MODEL', comparables: 0,
                marketEvidence: { valuationStrategy: 'FALLBACK' },
            };
            const identity = {
                registration: audiVrm, make: 'AUDI', model: 'A1',
                year: 2018, mileage: 106470,
            };
            const newest = { id: secondId, type: 'valuation_base_snapshot',
                payload: { identity, baseValuation: fallback } };
            const older = { id: firstId, type: 'valuation_base_snapshot',
                payload: { identity, baseValuation: liveBase } };
            prisma.analyticsEvent.findFirst.mockResolvedValueOnce(newest);
            prisma.analyticsEvent.findMany.mockResolvedValueOnce([newest, older]);
            const found = await (service as any).findRecentReusableMarketBase(prisma, firstRequest);
            expect(found.row.id).toBe(firstId);
            expect(found.base.source).toBe('LIVE_UK_MARKET');
            expect(prisma.analyticsEvent.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 20 }),
            );
        });

        it('does not return an unfrozen cached quote if alias persistence fails', async () => {
            const frozen = {
                low: 6500, mid: 7450, high: 8000,
                source: 'LIVE_UK_MARKET', confidence: 'LOW',
                confidenceScore: 0.4, comparables: 3,
                retail: { suggestedAsking: 8000, suggestedMinimum: 7450 },
                auction: {
                    marketValue: 6500, openingBid: 4550,
                    reserveLow: 5850, reserveHigh: 6500, suggestedReserve: 6150,
                },
            };
            prisma.analyticsEvent.findFirst.mockResolvedValueOnce({
                id: firstId,
                type: 'valuation_base_snapshot',
                payload: {
                    identity: {
                        registration: audiVrm, make: 'AUDI',
                        model: 'A1', year: 2018, mileage: 106470,
                    },
                    baseValuation: frozen,
                },
            });
            prisma.analyticsEvent.create.mockRejectedValueOnce(new Error('database write failed'));
            await expect(service.estimateVehicleValue(secondRequest as any))
                .rejects.toThrow(/database write failed/);
            expect(prisma.listing.findMany).not.toHaveBeenCalled();
        });

        it('does not share a cached generic valuation without a registration', async () => {
            const search = jest.spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue(marketResult(7450));
            await service.estimateVehicleValue({
                ...firstRequest, registration: undefined,
            } as any);
            expect(prisma.analyticsEvent.findFirst).not.toHaveBeenCalled();
            expect(search).toHaveBeenCalledTimes(1);
        });
    });

    describe('live-first valuation retries with blended fallback', () => {
        it('prefers a standalone live valuation before blending even when CarMazium has internal comparables', async () => {
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
            expect(result.source).toBe('LIVE_UK_MARKET');
            expect(result.marketEvidence).toEqual(expect.objectContaining({
                carmaziumComparables: 4,
                liveUkComparables: 3,
                liveUkSearchStatus: 'USED',
                liveUkAttempts: 1,
                blendedMarketAttempts: 0,
                valuationStrategy: 'LIVE',
            }));
        });

        it('uses all five live attempts before accepting a sparse live valuation', async () => {
            prisma.listing.findMany.mockResolvedValue([]);

            const sparse = {
                checkedAt: new Date().toISOString(),
                rawComparableCount: 2,
                comparables: [
                    { price: 3495, year: 2012, mileage: 95000, transmission: 'MANUAL', kind: 'ACTIVE_ASK' },
                    { price: 3995, year: 2012, mileage: 95877, transmission: 'AUTOMATIC', kind: 'ACTIVE_ASK' },
                ],
            };

            const liveSearch = jest
                .spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue(sparse);

            const result = await service.estimateVehicleValue({
                make: 'SKODA',
                model: 'OCTAVIA',
                year: 2012,
                mileage: 95000,
                transmission: 'MANUAL',
            } as any);

            expect(liveSearch).toHaveBeenCalledTimes(5);
            expect(result.source).toBe('LIVE_UK_MARKET');
            expect(result.confidence).toBe('LOW');
            expect(result.retail.suggestedAsking).toBeGreaterThan(0);
            expect(result.auction.marketValue).toBeGreaterThan(0);
            expect(result.marketEvidence).toEqual(expect.objectContaining({
                carmaziumComparables: 0,
                liveUkComparables: 2,
                liveUkSearchStatus: 'USED',
                rawLiveUkComparables: 2,
                liveUkAttempts: 5,
                blendedMarketAttempts: 0,
                valuationStrategy: 'LIVE',
            }));
        });

        it('can build a standalone live valuation from unique comparables accumulated across five attempts', async () => {
            prisma.listing.findMany.mockResolvedValue([]);

            const liveSearch = jest
                .spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValueOnce({
                    checkedAt: new Date().toISOString(),
                    rawComparableCount: 1,
                    comparables: [
                        { price: 10000, year: 2020, mileage: 30000, kind: 'ACTIVE_ASK' },
                    ],
                })
                .mockResolvedValueOnce({
                    checkedAt: new Date().toISOString(),
                    rawComparableCount: 2,
                    comparables: [
                        { price: 10500, year: 2020, mileage: 32000, kind: 'ACTIVE_ASK' },
                        { price: 11000, year: 2021, mileage: 28000, kind: 'ACTIVE_ASK' },
                    ],
                })
                .mockResolvedValue(null);

            const result = await service.estimateVehicleValue({
                make: 'FORD',
                model: 'FOCUS',
                year: 2020,
                mileage: 30000,
            } as any);

            expect(liveSearch).toHaveBeenCalledTimes(5);
            expect(result.source).toBe('LIVE_UK_MARKET');
            expect(result.marketEvidence).toEqual(expect.objectContaining({
                liveUkComparables: 3,
                liveUkAttempts: 5,
                blendedMarketAttempts: 0,
                valuationStrategy: 'LIVE',
            }));
        });

        it('enters blended mode only after five empty live attempts and combines recovered live evidence with CarMazium signals', async () => {
            const internalRows = [0, 1].map((index) => ({
                id: `internal-blend-${index}`,
                type: 'CLASSIFIED',
                status: 'ACTIVE',
                price: 9000 + index * 500,
                make: 'FORD',
                model: 'FOCUS',
                variant: 'Titanium',
                year: 2019,
                mileage: 40000 + index * 2000,
                fuelType: 'PETROL',
                transmission: 'MANUAL',
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

            const recovered = {
                checkedAt: new Date().toISOString(),
                rawComparableCount: 1,
                comparables: [
                    { price: 9750, year: 2019, mileage: 41000, kind: 'ACTIVE_ASK' },
                ],
            };

            const liveSearch = jest
                .spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(recovered)
                .mockResolvedValue(null);

            const result = await service.estimateVehicleValue({
                make: 'FORD',
                model: 'FOCUS',
                year: 2019,
                mileage: 40000,
            } as any);

            expect(liveSearch).toHaveBeenCalledTimes(6);
            expect(result.source).toBe('BLENDED_MARKET');
            expect(result.marketEvidence).toEqual(expect.objectContaining({
                carmaziumComparables: 2,
                liveUkComparables: 1,
                liveUkAttempts: 5,
                blendedMarketAttempts: 1,
                valuationStrategy: 'BLENDED',
            }));
        });

        it('tries five blended searches after five empty live searches before using another fallback', async () => {
            prisma.listing.findMany.mockResolvedValue([]);

            const liveSearch = jest
                .spyOn(service as any, 'getLiveUkMarketComparables')
                .mockResolvedValue(null);

            const result = await service.estimateVehicleValue({
                make: 'SKODA',
                model: 'OCTAVIA',
                year: 2012,
                mileage: 95000,
                transmission: 'MANUAL',
            } as any);

            expect(liveSearch).toHaveBeenCalledTimes(10);
            expect(result.source).toBe('CARMAZIUM_MODEL');
            expect(result.confidence).toBe('LOW');
            expect(result.retail.suggestedAsking).toBeGreaterThan(0);
            expect(result.retail.suggestedMinimum).toBeGreaterThan(0);
            expect(result.auction.marketValue).toBeGreaterThan(0);
            expect(result.auction.suggestedReserve).toBeGreaterThan(0);
            expect(result.marketEvidence).toEqual(expect.objectContaining({
                carmaziumComparables: 0,
                liveUkComparables: 0,
                liveUkSearchStatus: 'UNAVAILABLE',
                rawLiveUkComparables: 0,
                liveUkAttempts: 5,
                blendedMarketAttempts: 5,
                valuationStrategy: 'FALLBACK',
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

        it('rejects linked auction creation when Buy It Now is below reserve before claiming the retail source', async () => {
            await expect(
                service.alsoAuction('listing-1', 'seller-1', {
                    startTime: new Date(Date.now() + 60_000).toISOString(),
                    reservePrice: 9000,
                    minIncrement: 100,
                    buyItNowPrice: 8500,
                }),
            ).rejects.toMatchObject({
                message: 'Buy It Now price must be equal to or higher than the reserve price.',
            });

            expect(prisma.listing.updateMany).not.toHaveBeenCalled();
            expect(prisma.listing.create).not.toHaveBeenCalled();
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

    describe('auction/listing lifecycle synchronization', () => {
        it('blocks generic withdrawal while an auction is already live', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                type: 'AUCTION',
                status: 'ACTIVE',
                price: 10000,
                deletedAt: null,
                linkedListingId: null,
            });
            prisma.auction.findUnique.mockResolvedValue({
                id: 'auction-1',
                status: 'ACTIVE',
                deletedAt: null,
            });

            await expect(
                service.updateStatus('listing-1', 'seller-1', 'WITHDRAWN' as any),
            ).rejects.toThrow(/live auction cannot be withdrawn/i);

            expect(prisma.listing.update).not.toHaveBeenCalled();
            expect(prisma.auction.updateMany).not.toHaveBeenCalled();
        });

        it('cancels and archives a scheduled auction atomically when the seller withdraws it', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                type: 'AUCTION',
                status: 'PENDING_REVIEW',
                price: 10000,
                deletedAt: null,
                linkedListingId: 'retail-1',
            });
            prisma.auction.findUnique.mockResolvedValue({
                id: 'auction-1',
                status: 'SCHEDULED',
                deletedAt: null,
            });
            prisma.listing.update.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'WITHDRAWN',
            });

            await service.updateStatus('listing-1', 'seller-1', 'WITHDRAWN' as any);

            expect(prisma.auction.updateMany).toHaveBeenCalledWith({
                where: {
                    id: 'auction-1',
                    status: 'SCHEDULED',
                    deletedAt: null,
                },
                data: {
                    status: 'CANCELLED',
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                },
            });
            expect(prisma.bid.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        listingId: 'listing-1',
                        archivedAt: null,
                    }),
                    data: { archivedAt: expect.any(Date) },
                }),
            );
            expect(prisma.listing.updateMany).toHaveBeenCalledWith({
                where: {
                    id: 'retail-1',
                    linkedListingId: 'listing-1',
                },
                data: { linkedListingId: null },
            });
            expect(prisma.listing.update).toHaveBeenCalledWith({
                where: { id: 'listing-1' },
                data: {
                    status: 'WITHDRAWN',
                    linkedListingId: null,
                },
            });
        });

        it('blocks deletion of a live auction through the generic listing endpoint', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                type: 'AUCTION',
                status: 'ACTIVE',
                deletedAt: null,
                linkedListingId: null,
            });
            prisma.auction.findUnique.mockResolvedValue({
                id: 'auction-1',
                status: 'ACTIVE',
                deletedAt: null,
            });

            await expect(
                service.softDelete('listing-1', 'seller-1'),
            ).rejects.toThrow(/live auction cannot be deleted/i);

            expect(prisma.listing.update).not.toHaveBeenCalled();
        });

        it('soft-deletes and cancels a scheduled auction in the same transaction', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'listing-1',
                sellerId: 'seller-1',
                type: 'AUCTION',
                status: 'PENDING_REVIEW',
                deletedAt: null,
                linkedListingId: null,
            });
            prisma.auction.findUnique.mockResolvedValue({
                id: 'auction-1',
                status: 'SCHEDULED',
                deletedAt: null,
            });
            prisma.listing.update.mockResolvedValue({
                id: 'listing-1',
                deletedAt: new Date(),
            });

            await service.softDelete('listing-1', 'seller-1');

            expect(prisma.auction.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        id: 'auction-1',
                        status: 'SCHEDULED',
                        deletedAt: null,
                    },
                    data: expect.objectContaining({
                        status: 'CANCELLED',
                        deletedAt: expect.any(Date),
                    }),
                }),
            );
            expect(prisma.listing.update).toHaveBeenCalledWith({
                where: { id: 'listing-1' },
                data: {
                    deletedAt: expect.any(Date),
                    linkedListingId: null,
                },
            });
        });
    });
});
