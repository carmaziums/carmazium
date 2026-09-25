import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService listing approval readiness', () => {
    const makeService = (listing: any) => {
        const prisma: any = {
            listing: {
                findUnique: jest.fn().mockResolvedValue(listing),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            auction: {
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            bid: {
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            user: { findUnique: jest.fn() },
            transaction: { findFirst: jest.fn() },
            analyticsEvent: { create: jest.fn().mockResolvedValue({ id: 'analytics-1' }) },
        };
        prisma.$transaction = jest.fn(async (arg: any) =>
            Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
        );

        const service = new AdminService(
            prisma,
            {} as any,
            {} as any,
            { sendNotification: jest.fn() } as any,
            { create: jest.fn().mockResolvedValue(null) } as any,
            { incrementListings: jest.fn() } as any,
            {} as any,
            { deleteProof: jest.fn(), hydrateMany: jest.fn(async (r: any) => r) } as any,
        );

        return { service, prisma };
    };

    const completeFields = {
        createdAt: new Date('2026-09-19T01:00:00.000Z'),
        images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
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

    const validLinkedAuction = {
        id: 'auction-listing-1',
        sellerId: 'seller-1',
        type: 'AUCTION',
        status: 'PENDING_REVIEW',
        badgeTier: 'FREE',
        linkedListingId: 'retail-listing-1',
        hpiReport: null,
        ...completeFields,
        auction: {
            id: 'auction-1',
            status: 'SCHEDULED',
            deletedAt: null,
            startTime: new Date(Date.now() + 60_000),
            endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        linkedListing: {
            id: 'retail-listing-1',
            sellerId: 'seller-1',
            type: 'CLASSIFIED',
            status: 'ACTIVE',
            linkedListingId: 'auction-listing-1',
            deletedAt: null,
            hpiReport: { id: 'hpi-source-1' },
        },
    };

    it('accepts linked-source HPI as satisfying the linked auction HPI gate', async () => {
        const { service, prisma } = makeService(validLinkedAuction);
        prisma.listing.update.mockResolvedValue({ id: 'auction-listing-1' });

        await service.approveListing('auction-listing-1');

        expect(prisma.listing.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'auction-listing-1' },
            }),
        );
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'listing_approved',
                userId: 'seller-1',
                payload: expect.objectContaining({
                    listing_id: 'auction-listing-1',
                    listing_type: 'auction',
                }),
            }),
        });
    });

    it('rejects an incomplete listing even if it is already PENDING_REVIEW', async () => {
        const { service, prisma } = makeService({
            ...validLinkedAuction,
            images: [],
        });

        await expect(service.approveListing('auction-listing-1'))
            .rejects.toThrow(/at least 10 photos/i);

        expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it('allows a complete standalone auction with no HPI request', async () => {
        const { service, prisma } = makeService({
            ...validLinkedAuction,
            linkedListingId: null,
            linkedListing: null,
            hpiReport: null,
        });
        prisma.listing.update.mockResolvedValue({ id: 'auction-listing-1' });

        await expect(service.approveListing('auction-listing-1'))
            .resolves.toEqual({ id: 'auction-listing-1' });

        expect(prisma.listing.update).toHaveBeenCalled();
    });

    it.each([
        ['SOLD', 'auction-listing-1', null],
        ['WITHDRAWN', 'auction-listing-1', null],
        ['ACTIVE', null, null],
        ['ACTIVE', 'different-auction', null],
        ['ACTIVE', 'auction-listing-1', new Date()],
    ])(
        'refuses approval when linked retail source is invalid: status=%s reverseLink=%s deleted=%s',
        async (status, reverseLink, deletedAt) => {
            const listing = {
                ...validLinkedAuction,
                linkedListing: {
                    ...validLinkedAuction.linkedListing,
                    status,
                    linkedListingId: reverseLink,
                    deletedAt,
                },
            };
            const { service, prisma } = makeService(listing);

            await expect(service.approveListing('auction-listing-1'))
                .rejects.toBeInstanceOf(BadRequestException);

            expect(prisma.listing.update).not.toHaveBeenCalled();
        },
    );

    it('refuses approval if the auction changes between review and activation', async () => {
        const { service, prisma } = makeService(validLinkedAuction);
        prisma.auction.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.approveListing('auction-listing-1'))
            .rejects.toThrow(/auction changed while this listing was being approved/i);

        expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it('rejects a listing and cancels its scheduled auction in one transaction', async () => {
        const listing = {
            ...validLinkedAuction,
            linkedListingId: null,
            linkedListing: null,
        };
        const { service, prisma } = makeService(listing);
        prisma.listing.update.mockResolvedValue({
            ...listing,
            status: 'REJECTED',
            rejectionReason: 'Needs correction',
        });

        await service.rejectListing('auction-listing-1', { reason: 'Needs correction' } as any);

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: {
                status: 'CANCELLED',
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
            },
        });
    });

    it('force-deletes an open auction and its listing as one lifecycle operation', async () => {
        const listing = {
            ...validLinkedAuction,
            status: 'ACTIVE',
            auction: {
                ...validLinkedAuction.auction,
                status: 'ACTIVE',
            },
            linkedListingId: null,
            linkedListing: null,
        };
        const { service, prisma } = makeService(listing);
        prisma.listing.update.mockResolvedValue({
            ...listing,
            deletedAt: new Date(),
        });

        await service.deleteListing('auction-listing-1');

        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: expect.objectContaining({
                status: 'CANCELLED',
                deletedAt: expect.any(Date),
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
            }),
        });
        expect(prisma.bid.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    listingId: 'auction-listing-1',
                    archivedAt: null,
                }),
                data: { archivedAt: expect.any(Date) },
            }),
        );
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'auction-listing-1' },
            data: {
                deletedAt: expect.any(Date),
                linkedListingId: null,
            },
        });
    });
});
