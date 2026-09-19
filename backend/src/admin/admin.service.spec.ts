import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService linked auction approval integrity', () => {
    const makeService = (listing: any) => {
        const prisma: any = {
            listing: {
                findUnique: jest.fn().mockResolvedValue(listing),
                update: jest.fn(),
            },
            auction: {
                update: jest.fn(),
            },
            user: { findUnique: jest.fn() },
            transaction: { findFirst: jest.fn() },
        };

        const service = new AdminService(
            prisma,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            { incrementListings: jest.fn() } as any,
            {} as any,
        );

        return { service, prisma };
    };

    const validAuction = {
        id: 'auction-listing-1',
        sellerId: 'seller-1',
        type: 'AUCTION',
        status: 'PENDING_REVIEW',
        badgeTier: 'FREE',
        linkedListingId: 'retail-listing-1',
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
        },
    };

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
                ...validAuction,
                linkedListing: {
                    ...validAuction.linkedListing,
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
});
