import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OffersService } from './offers.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { OfferResponseStatus } from './dto/respond-offer.dto';

/**
 * Unit tests for the offer/bid validation rules.
 * The most important guarantee: a new offer from buyer B must be strictly higher
 * than the current highest active offer (PENDING / COUNTERED / ACCEPTED) from any
 * other buyer A. Equal or lower amounts must be rejected.
 */
describe('OffersService — incremental bidding', () => {
    let service: OffersService;
    let prisma: any;

    const baseListing = {
        id: 'listing-1',
        sellerId: 'seller-1',
        status: 'ACTIVE',
        deletedAt: null,
        title: 'Test',
        price: 10000,
    };

    beforeEach(async () => {
        prisma = {
            listing: { findFirst: jest.fn() },
            offer: {
                findFirst: jest.fn(),
                create: jest.fn(),
                updateMany: jest.fn(),
                update: jest.fn(),
                findUnique: jest.fn(),
                count: jest.fn(),
                findMany: jest.fn(),
            },
            dealerStaff: { findFirst: jest.fn() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OffersService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue({}) } },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
            ],
        }).compile();

        service = module.get<OffersService>(OffersService);
    });

    it('rejects a bid from buyer B that equals the current highest bid from buyer A', async () => {
        prisma.listing.findFirst.mockResolvedValue(baseListing);
        // Current highest active offer is £8,000 from another buyer
        prisma.offer.findFirst.mockResolvedValueOnce({
            id: 'offer-A',
            amount: 8000,
            counterAmount: null,
            buyerId: 'buyer-A',
            status: 'PENDING',
        });

        await expect(
            service.makeOffer('buyer-B', { listingId: 'listing-1', amount: 8000 } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a bid from buyer B that is lower than the current highest bid from buyer A', async () => {
        prisma.listing.findFirst.mockResolvedValue(baseListing);
        prisma.offer.findFirst.mockResolvedValueOnce({
            id: 'offer-A',
            amount: 9000,
            counterAmount: null,
            buyerId: 'buyer-A',
            status: 'PENDING',
        });

        await expect(
            service.makeOffer('buyer-B', { listingId: 'listing-1', amount: 8500 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/higher than the current highest bid/i) });
    });

    it('accepts a bid from buyer B that is strictly higher than buyer A', async () => {
        prisma.listing.findFirst.mockResolvedValue(baseListing);
        prisma.offer.findFirst.mockResolvedValueOnce({
            id: 'offer-A',
            amount: 8000,
            counterAmount: null,
            buyerId: 'buyer-A',
            status: 'PENDING',
        });
        prisma.offer.updateMany.mockResolvedValue({ count: 0 });
        prisma.offer.create.mockResolvedValue({ id: 'offer-B', amount: 8500 });

        const result = await service.makeOffer('buyer-B', {
            listingId: 'listing-1',
            amount: 8500,
        } as any);

        expect(prisma.offer.create).toHaveBeenCalled();
        expect(result.id).toBe('offer-B');
    });

    it('uses counterAmount when comparing against a COUNTERED competing offer', async () => {
        prisma.listing.findFirst.mockResolvedValue(baseListing);
        // Competing offer was countered to £9,500 — new bid must be > 9,500, not just > 8,000.
        prisma.offer.findFirst.mockResolvedValueOnce({
            id: 'offer-A',
            amount: 8000,
            counterAmount: 9500,
            buyerId: 'buyer-A',
            status: 'COUNTERED',
        });

        await expect(
            service.makeOffer('buyer-B', { listingId: 'listing-1', amount: 9500 } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still enforces the 70%-of-asking-price floor when no competing offers exist', async () => {
        prisma.listing.findFirst.mockResolvedValue({ ...baseListing, price: 10000 });
        prisma.offer.findFirst.mockResolvedValueOnce(null);

        // 70% of 10,000 = 7,000. An offer of 5,000 must be rejected.
        await expect(
            service.makeOffer('buyer-A', { listingId: 'listing-1', amount: 5000 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/70%/i) });
    });
});

/**
 * Once a seller accepts an offer, that offer must remain visible in seller-side
 * dashboards even after the listing is marked SOLD. The dealer/staff aggregator
 * should still surface accepted offers tied to sold listings.
 */
describe('OffersService — accepted offer remains visible after sale', () => {
    let service: OffersService;
    let prisma: any;

    beforeEach(async () => {
        prisma = {
            listing: { findFirst: jest.fn(), findMany: jest.fn() },
            offer: {
                findFirst: jest.fn(),
                create: jest.fn(),
                updateMany: jest.fn(),
                update: jest.fn(),
                findUnique: jest.fn(),
                count: jest.fn(),
                findMany: jest.fn(),
            },
            dealerStaff: { findFirst: jest.fn() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OffersService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue({}) } },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
            ],
        }).compile();

        service = module.get<OffersService>(OffersService);
    });

    it('returns accepted offers for sold listings via getReceivedOffers', async () => {
        prisma.dealerStaff.findFirst.mockResolvedValue(null);
        // The seller has one listing that has since been sold
        prisma.listing.findMany.mockResolvedValue([{ id: 'listing-sold' }]);
        // An accepted offer still exists on that sold listing
        prisma.offer.findMany.mockResolvedValue([
            {
                id: 'offer-accepted',
                listingId: 'listing-sold',
                status: 'ACCEPTED',
                amount: 9000,
            },
        ]);

        const result = await service.getReceivedOffers('seller-1');

        expect(prisma.listing.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ sellerId: 'seller-1', deletedAt: null }),
            }),
        );
        // Crucially the listing query has NO `status` filter — sold listings are kept
        const listingFindManyArgs = prisma.listing.findMany.mock.calls[0][0];
        expect(listingFindManyArgs.where.status).toBeUndefined();

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('ACCEPTED');
    });
});
