import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService listing approval readiness', () => {
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

    it('rejects a new standalone auction with no HPI request', async () => {
        const { service, prisma } = makeService({
            ...validLinkedAuction,
            linkedListingId: null,
            linkedListing: null,
            hpiReport: null,
        });

        await expect(service.approveListing('auction-listing-1'))
            .rejects.toThrow(/HPI/i);

        expect(prisma.listing.update).not.toHaveBeenCalled();
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
});
