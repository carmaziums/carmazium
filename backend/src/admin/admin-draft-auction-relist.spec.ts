
import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

const completeDraft = {
    id: 'listing-1',
    sellerId: 'seller-1',
    seller: { id: 'seller-1', deletedAt: null },
    type: 'CLASSIFIED',
    status: 'DRAFT',
    deletedAt: null,
    linkedListingId: null,
    title: '2019 Renault Kadjar',
    vrm: 'AB12 CDE',
    price: 6100,
    images: Array.from({ length: 10 }, (_, i) => 'image-' + i),
    make: 'Renault',
    model: 'Kadjar',
    year: 2019,
    mileage: 30000,
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'SUV',
    location: 'Birmingham',
    owners: '1',
    description: 'Complete vehicle description',
    condition: 'GOOD',
    stolenRecovered: false,
    hasOutstandingFinance: false,
    isLegalRegisteredKeeper: true,
    auction: null,
};

function buildSubject(overrides: Record<string, any> = {}) {
    const listing = { ...completeDraft, ...overrides };
    const prisma: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        $transaction: jest.fn(async (fn: any) => fn(prisma)),
        listing: {
            findUnique: jest.fn().mockResolvedValue(listing),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ id: 'listing-1' }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        auction: {
            create: jest.fn().mockResolvedValue({ id: 'auction-new' }),
            update: jest.fn().mockResolvedValue({ id: 'auction-previous' }),
        },
        sale: { findFirst: jest.fn().mockResolvedValue(null) },
        offer: { findFirst: jest.fn().mockResolvedValue(null) },
        bid: {
            count: jest.fn().mockResolvedValue(0),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        analyticsEvent: {
            create: jest.fn().mockResolvedValue({ id: 'event-1' }),
        },
    };
    const notifications = {
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    const gateway = { sendNotification: jest.fn() };
    const service = new AdminService(
        prisma,
        {} as any,
        {} as any,
        gateway as any,
        notifications as any,
        {} as any,
        {} as any,
        {} as any,
    );
    return { service, prisma, notifications, gateway };
}

describe('AdminService one-click auction relisting', () => {
    it('re-lists an eligible standalone retail draft in one atomic transaction', async () => {
        const { service, prisma, notifications } = buildSubject();
        const outcome = await service.relistDraftAsAuction('listing-1', 'admin-1');

        expect(outcome).toMatchObject({
            listingId: 'listing-1',
            auctionId: 'auction-new',
            reservePrice: 6100,
            reserveSource: 'DRAFT_LISTED_PRICE',
            status: 'SCHEDULED',
        });
        expect(prisma.auction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                listingId: 'listing-1',
                reservePrice: 6100,
                startingBid: 4270,
                status: 'SCHEDULED',
                minIncrement: 100,
                buyerFeePaid: false,
            }),
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: expect.objectContaining({
                status: 'ACTIVE',
                type: 'AUCTION',
                badgeTier: 'FREE',
            }),
        });
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'admin_draft_auction_relist',
                userId: 'admin-1',
                payload: expect.objectContaining({
                    auctionId: 'auction-new',
                    reserveSource: 'DRAFT_LISTED_PRICE',
                }),
            }),
        });
        expect(notifications.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'seller-1',
                entityId: 'auction-new',
            }),
        );
    });

    it('retains historical reserve and increment while archiving past bids', async () => {
        const { service, prisma } = buildSubject({
            type: 'AUCTION',
            price: 10000,
            auction: {
                id: 'auction-previous',
                status: 'ENDED',
                reservePrice: 9000,
                minIncrement: 250,
                buyItNowPrice: 12000,
                deletedAt: null,
                winnerId: null,
                wonAt: null,
                buyerFeePaid: false,
            },
        });
        const outcome = await service.relistDraftAsAuction('listing-1', 'admin-1');
        expect(outcome).toMatchObject({
            auctionId: 'auction-previous',
            reservePrice: 9000,
            reserveSource: 'PREVIOUS_RESERVE',
        });
        expect(prisma.auction.create).not.toHaveBeenCalled();
        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-previous' },
            data: expect.objectContaining({
                reservePrice: 9000,
                startingBid: 7000,
                minIncrement: 250,
                buyItNowPrice: 12000,
                provisionalOfferBidId: null,
            }),
        });
        expect(prisma.bid.updateMany).toHaveBeenCalledWith({
            where: { listingId: 'listing-1', archivedAt: null },
            data: { archivedAt: expect.any(Date) },
        });
    });

    it('does not relist a second time after the listing is already ACTIVE', async () => {
        const { service, prisma } = buildSubject({ status: 'ACTIVE' });
        await expect(service.relistDraftAsAuction('listing-1', 'admin-1'))
            .rejects.toThrow(/only DRAFT/i);
        expect(prisma.auction.create).not.toHaveBeenCalled();
        expect(prisma.bid.updateMany).not.toHaveBeenCalled();
    });

    it('returns the missing fields rather than publishing an incomplete draft', async () => {
        const { service, prisma } = buildSubject({ images: [] });
        await expect(service.relistDraftAsAuction('listing-1', 'admin-1'))
            .rejects.toThrow(/at least 10 photos/i);
        expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it.each([
        { field: 'winnerId', value: 'buyer-1' },
        { field: 'provisionalOfferBidId', value: 'bid-1' },
        { field: 'buyerFeeTransactionId', value: 'fee-1' },
        { field: 'handoverProofPath', value: 'auction-previous/file.jpg' },
        { field: 'sellerBonusReleased', value: true },
    ])('blocks ended auctions with unresolved history in $field', async ({ field, value }) => {
        const { service, prisma } = buildSubject({
            type: 'AUCTION',
            auction: {
                id: 'auction-previous', status: 'ENDED', deletedAt: null,
                [field]: value,
            },
        });
        await expect(service.relistDraftAsAuction('listing-1', 'admin-1'))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('heals exactly one unlinked retail sibling when recovering an old no-sale auction draft', async () => {
        const { service, prisma } = buildSubject({
            type: 'CLASSIFIED',
            auction: {
                id: 'auction-previous',
                status: 'ENDED',
                reservePrice: 5200,
                minIncrement: 100,
                deletedAt: null,
                winnerId: null,
                wonAt: null,
            },
        });
        prisma.listing.findMany.mockResolvedValue([{
            id: 'retail-1',
            type: 'CLASSIFIED',
            status: 'ACTIVE',
            vrm: 'AB12CDE',
            linkedListingId: null,
        }]);
        await service.relistDraftAsAuction('listing-1', 'admin-1');
        expect(prisma.listing.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                id: 'retail-1',
                linkedListingId: null,
                status: 'ACTIVE',
            }),
            data: { linkedListingId: 'listing-1' },
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: expect.objectContaining({
                type: 'AUCTION',
                linkedListingId: 'retail-1',
            }),
        });
    });

    it('rolls back relisting if the historical retail sibling changes before it is claimed', async () => {
        const { service, prisma } = buildSubject({
            type: 'CLASSIFIED',
            auction: { id: 'auction-previous', status: 'ENDED', reservePrice: 5200 },
        });
        prisma.listing.findMany.mockResolvedValue([{
            id: 'retail-1',
            type: 'CLASSIFIED',
            status: 'ACTIVE',
            vrm: 'AB12CDE',
            linkedListingId: null,
        }]);
        prisma.listing.updateMany.mockResolvedValue({ count: 0 });
        await expect(service.relistDraftAsAuction('listing-1', 'admin-1'))
            .rejects.toThrow(/matching retail listing changed/i);
        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('rejects a conflicting live vehicle under the same seller and VRM', async () => {
        const { service, prisma } = buildSubject();
        prisma.listing.findMany.mockResolvedValue([{
            id: 'listing-other',
            type: 'CLASSIFIED',
            status: 'ACTIVE',
            vrm: 'AB12CDE',
            linkedListingId: null,
        }]);
        await expect(service.relistDraftAsAuction('listing-1', 'admin-1'))
            .rejects.toThrow(/another active or pending listing/i);
        expect(prisma.auction.create).not.toHaveBeenCalled();
    });

    it('does not bypass a recorded sale or accepted offer', async () => {
        const a = buildSubject();
        a.prisma.sale.findFirst.mockResolvedValue({ id: 'sale-1' });
        await expect(a.service.relistDraftAsAuction('listing-1', 'admin-1'))
            .rejects.toThrow(/sale or accepted-offer/i);

        const b = buildSubject();
        b.prisma.offer.findFirst.mockResolvedValue({ id: 'offer-1' });
        await expect(b.service.relistDraftAsAuction('listing-1', 'admin-1'))
            .rejects.toThrow(/sale or accepted-offer/i);
        expect(b.prisma.bid.updateMany).not.toHaveBeenCalled();
    });
});
