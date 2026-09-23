import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OffersService } from './offers.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EmailService } from '../email/email.service';
import { OfferResponseStatus } from './dto/respond-offer.dto';
import { AuctionsService } from '../auctions/auctions.service';
import { DealersService } from '../dealers/dealers.service';

/**
 * Retail offers are private negotiations. One buyer's amount must never create
 * a public price ladder for another buyer, while the server-owned 70% floor,
 * asking-price ceiling, and one-open-negotiation-per-buyer rules remain strict.
 */
describe('OffersService — private retail negotiations', () => {
    let service: OffersService;
    let prisma: any;
    let auctionsService: any;

    const baseListing = {
        id: 'listing-1',
        sellerId: 'seller-1',
        type: 'CLASSIFIED',
        status: 'ACTIVE',
        deletedAt: null,
        title: 'Test',
        price: 10000,
    };

    beforeEach(async () => {
        prisma = {
            listing: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                updateMany: jest.fn(),
                update: jest.fn(),
            },
            offer: {
                findFirst: jest.fn(),
                create: jest.fn(),
                updateMany: jest.fn(),
                update: jest.fn(),
                findUnique: jest.fn(),
                count: jest.fn(),
                findMany: jest.fn(),
            },
            dealerProfile: { findUnique: jest.fn() },
            dealerStaff: { findFirst: jest.fn() },
            user: { findUnique: jest.fn() },
            $transaction: jest.fn((fn: any) => fn(prisma)),
        };
        auctionsService = {
            cancelLinkedAuctionForRetailDeal: jest.fn().mockResolvedValue(null),
            publishRetailDealAuctionCancellation: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OffersService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: NotificationsService,
                    useValue: {
                        create: jest.fn().mockResolvedValue({}),
                        shouldSendEmail: jest.fn().mockResolvedValue(false),
                    },
                },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                {
                    provide: EmailService,
                    useValue: {
                        sendOfferReceivedEmail: jest.fn(),
                        sendOfferAcceptedEmail: jest.fn(),
                        sendOfferRejectedEmail: jest.fn(),
                        sendOfferCounteredEmail: jest.fn(),
                        sendCounterAcceptedEmail: jest.fn(),
                    },
                },
                { provide: AuctionsService, useValue: auctionsService },
                { provide: DealersService, useValue: { syncRetailLeadActivity: jest.fn().mockResolvedValue(null) } },
            ],
        }).compile();

        service = module.get<OffersService>(OffersService);
    });

    it('allows a buyer to submit a lower private offer than another buyer', async () => {
        prisma.listing.findFirst.mockResolvedValue(baseListing);
        prisma.offer.findFirst
            .mockResolvedValueOnce(null) // no active offer from this buyer
            .mockResolvedValueOnce(null); // no exhausted negotiation
        prisma.offer.create.mockResolvedValue({
            id: 'offer-B',
            listingId: 'listing-1',
            buyerId: 'buyer-B',
            amount: 7500,
            status: 'PENDING',
        });
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await service.makeOffer('buyer-B', {
            listingId: 'listing-1',
            amount: 7500,
        } as any);

        expect(result.amount).toBe(7500);
        expect(prisma.offer.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                amount: 7500,
                amountMin: 7500,
                amountMax: 7500,
            }),
        });
    });

    it('validates the actual offer amount against the 70% floor even if amountMax is higher', async () => {
        prisma.listing.findFirst.mockResolvedValue(baseListing);

        await expect(
            service.makeOffer('buyer-A', {
                listingId: 'listing-1',
                amount: 6000,
                amountMax: 9000,
            } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/70%/i) });

        expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('rejects a retail offer above the asking price', async () => {
        prisma.listing.findFirst.mockResolvedValue(baseListing);

        await expect(
            service.makeOffer('buyer-A', {
                listingId: 'listing-1',
                amount: 10500,
            } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/asking price/i) });
    });

    it('blocks a second open negotiation from the same buyer instead of creating duplicates', async () => {
        prisma.listing.findFirst.mockResolvedValue(baseListing);
        prisma.offer.findFirst.mockResolvedValueOnce({
            id: 'existing',
            status: 'PENDING',
            updatedAt: new Date(),
            counterExpiresAt: null,
        });

        await expect(
            service.makeOffer('buyer-A', {
                listingId: 'listing-1',
                amount: 8000,
            } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/already have a pending offer/i) });

        expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('amends the same pending offer row without comparing another buyer offer', async () => {
        prisma.offer.findUnique.mockResolvedValue({
            id: 'offer-B',
            listingId: 'listing-1',
            buyerId: 'buyer-B',
            amount: 8000,
            message: 'Old message',
            status: 'PENDING',
            updatedAt: new Date(),
            listing: {
                id: 'listing-1',
                title: 'Test',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                deletedAt: null,
                price: 10000,
            },
        });
        prisma.offer.update.mockResolvedValue({
            id: 'offer-B',
            listingId: 'listing-1',
            buyerId: 'buyer-B',
            amount: 7800,
            status: 'PENDING',
        });

        const result = await service.amendOffer('offer-B', 'buyer-B', {
            amount: 7800,
            message: 'Can collect tomorrow',
        } as any);

        expect(prisma.offer.update).toHaveBeenCalledWith({
            where: { id: 'offer-B' },
            data: expect.objectContaining({
                amount: 7800,
                amountMin: 7800,
                amountMax: 7800,
                message: 'Can collect tomorrow',
            }),
        });
        expect(result.amount).toBe(7800);
    });

    it('accepting one offer atomically closes every other pending/countered negotiation', async () => {
        const offer = {
            id: 'offer-win',
            listingId: 'listing-1',
            buyerId: 'buyer-1',
            amount: 8200,
            counterAmount: null,
            status: 'PENDING',
            updatedAt: new Date(),
            counterAttemptsSeller: 0,
            listing: {
                id: 'listing-1',
                title: 'Test',
                sellerId: 'seller-1',
                slug: 'test',
                status: 'ACTIVE',
                price: 10000,
            },
        };
        prisma.offer.findUnique
            .mockResolvedValueOnce(offer)
            .mockResolvedValueOnce({ ...offer, status: 'ACCEPTED', finalAmount: 8200 });
        prisma.listing.updateMany.mockResolvedValue({ count: 1 });
        prisma.offer.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 2 });
        prisma.listing.findUnique.mockResolvedValue({ linkedListingId: null });
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await service.respondToOffer(
            'offer-win',
            'seller-1',
            OfferResponseStatus.ACCEPTED,
        );

        expect(result.status).toBe('ACCEPTED');
        expect(prisma.listing.updateMany).toHaveBeenCalledWith({
            where: { id: 'listing-1', status: 'ACTIVE', deletedAt: null },
            data: { status: 'OFFER_ACCEPTED' },
        });
        expect(prisma.offer.updateMany).toHaveBeenCalledWith({
            where: {
                listingId: 'listing-1',
                id: { not: 'offer-win' },
                status: { in: ['PENDING', 'COUNTERED'] },
            },
            data: { status: 'REJECTED', counterExpiresAt: null },
        });
    });

    it('buyer acceptance of a seller counter uses the same exclusive deal close', async () => {
        const offer = {
            id: 'offer-1',
            listingId: 'listing-1',
            buyerId: 'buyer-1',
            amount: 8000,
            counterAmount: 8500,
            status: 'COUNTERED',
            lastCounteredBy: 'SELLER',
            counterExpiresAt: new Date(Date.now() + 60_000),
            counterAttemptsBuyer: 0,
            listing: {
                id: 'listing-1',
                title: 'Test',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                price: 10000,
            },
        };
        prisma.offer.findUnique
            .mockResolvedValueOnce(offer)
            .mockResolvedValueOnce({ ...offer, status: 'ACCEPTED', finalAmount: 8500 });
        prisma.listing.updateMany.mockResolvedValue({ count: 1 });
        prisma.offer.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        prisma.listing.findUnique.mockResolvedValue({ linkedListingId: 'auction-listing-1' });
        auctionsService.cancelLinkedAuctionForRetailDeal.mockResolvedValue({
            auctionId: 'auction-1',
            bidderIds: ['bidder-2'],
            listingTitle: 'Test',
        });

        const result = await service.respondToCounterOffer(
            'offer-1',
            'buyer-1',
            OfferResponseStatus.ACCEPTED,
        );

        expect(result.status).toBe('ACCEPTED');
        expect(auctionsService.cancelLinkedAuctionForRetailDeal).toHaveBeenCalledWith(
            'auction-listing-1',
            'listing-1',
            prisma,
        );
        expect(auctionsService.publishRetailDealAuctionCancellation).toHaveBeenCalled();
    });

    it('allows a buyer to cancel a COUNTERED negotiation that is still active', async () => {
        prisma.offer.findUnique.mockResolvedValue({
            id: 'offer-B',
            listingId: 'listing-1',
            buyerId: 'buyer-B',
            amount: 8500,
            status: 'COUNTERED',
            listing: {
                id: 'listing-1',
                title: 'Test',
                sellerId: 'seller-1',
            },
        });
        prisma.offer.update.mockResolvedValue({
            id: 'offer-B',
            status: 'WITHDRAWN',
        });

        const result = await service.withdrawOffer('offer-B', 'buyer-B');

        expect(result.status).toBe('WITHDRAWN');
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
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            $transaction: jest.fn((fn: any) => fn(prisma)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OffersService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue({}), shouldSendEmail: jest.fn().mockResolvedValue(false) } },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                { provide: EmailService, useValue: { sendOfferReceivedEmail: jest.fn(), sendOfferAcceptedEmail: jest.fn(), sendOfferRejectedEmail: jest.fn(), sendOfferCounteredEmail: jest.fn(), sendCounterAcceptedEmail: jest.fn() } },
                { provide: AuctionsService, useValue: { cancelLinkedAuctionForRetailDeal: jest.fn().mockResolvedValue(null), publishRetailDealAuctionCancellation: jest.fn().mockResolvedValue(undefined) } },
                { provide: DealersService, useValue: { syncRetailLeadActivity: jest.fn().mockResolvedValue(null) } },
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
