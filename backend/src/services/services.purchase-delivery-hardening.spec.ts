import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, ServiceJobStatus, ServiceType } from '@prisma/client';
import { ServicesService } from './services.service';

describe('TradeXchange purchase-to-delivery integrity', () => {
    let prisma: any;
    let service: ServicesService;

    const seller = {
        postcode: 'b1 1aa',
        location: 'Birmingham',
        dealerProfile: {
            businessAddress: '20 Business Road, Birmingham',
            kyc: {
                tradingAddress: '10 Trading Lane, Birmingham',
                businessRegisteredAddress: '30 Registered Street, Birmingham',
            },
        },
    };

    const listing = (overrides: Record<string, unknown> = {}) => ({
        id: 'listing-1',
        title: '2019 BMW 320d',
        status: 'OFFER_ACCEPTED',
        deletedAt: null,
        vrm: 'AB19 XYZ',
        make: 'BMW',
        model: '320d',
        year: 2019,
        location: 'Birmingham',
        seller,
        vehicle: {
            registration: 'AB19XYZ',
            make: 'BMW',
            model: '320d',
            year: 2019,
        },
        sale: null,
        ...overrides,
    });

    const offer = (overrides: Record<string, unknown> = {}) => ({
        id: 'offer-1',
        buyerId: 'buyer-1',
        status: 'ACCEPTED',
        listing: listing(),
        ...overrides,
    });

    const auction = (overrides: Record<string, unknown> = {}) => ({
        id: 'auction-1',
        winnerId: 'buyer-1',
        status: 'ENDED',
        buyerFeePaid: true,
        listing: listing({
            status: 'SOLD',
            sale: { buyerId: 'buyer-1' },
        }),
        ...overrides,
    });

    beforeEach(() => {
        prisma = {
            offer: { findUnique: jest.fn() },
            auction: { findUnique: jest.fn() },
            serviceJob: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockImplementation(async ({ data }: any) => ({
                    id: 'job-new',
                    status: ServiceJobStatus.OPEN,
                    ...data,
                    vehicles: data.vehicles.create,
                })),
            },
            user: { findMany: jest.fn().mockResolvedValue([]) },
        };

        service = new ServicesService(
            prisma,
            { create: jest.fn().mockResolvedValue({}) } as any,
            { sendBrandedEmail: jest.fn().mockResolvedValue({}) } as any,
            { getStripeClient: jest.fn(), refreshConnectAccountReadiness: jest.fn().mockResolvedValue({ ready: true, accountId: 'acct_1' }) } as any,
            { get: jest.fn().mockReturnValue('https://www.carmazium.com') } as any,
        );
    });

    const baseInput = {
        deliveryPostcode: 'B28 8AA',
        deliveryAddress: '99 Customer Road, Birmingham',
    };

    it('rejects a purchase request with no source', async () => {
        await expect(service.createJobFromPurchase('buyer-1', baseInput as any))
            .rejects.toThrow('exactly one purchase source');
        expect(prisma.offer.findUnique).not.toHaveBeenCalled();
        expect(prisma.auction.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a purchase request containing both offerId and auctionId', async () => {
        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
            auctionId: 'auction-1',
        } as any)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.serviceJob.create).not.toHaveBeenCalled();
    });

    it('rejects an accepted offer owned by another buyer', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer({ buyerId: 'buyer-other' }));

        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any)).rejects.toBeInstanceOf(ForbiddenException);

        expect(prisma.serviceJob.create).not.toHaveBeenCalled();
    });

    it('rejects an offer that is not accepted', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer({ status: 'PENDING' }));

        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any)).rejects.toThrow('Only an accepted retail offer');
    });

    it('rejects a retail purchase whose listing is no longer delivery eligible', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer({
            listing: listing({ status: 'ACTIVE' }),
        }));

        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any)).rejects.toThrow('not in a delivery-eligible state');
    });

    it('rejects a retail source when an existing sale belongs to a different buyer', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer({
            listing: listing({ status: 'SOLD', sale: { buyerId: 'other-buyer' } }),
        }));

        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a retail delivery with exact source, listing linkage and best collection address', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer());

        const result = await service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any);

        expect(result.id).toBe('job-new');
        expect(prisma.serviceJob.findFirst).toHaveBeenCalledWith({
            where: {
                customerId: 'buyer-1',
                sourceOfferId: 'offer-1',
                status: { notIn: [ServiceJobStatus.CANCELLED, ServiceJobStatus.EXPIRED] },
            },
            include: { vehicles: true },
        });
        expect(prisma.serviceJob.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                customerId: 'buyer-1',
                serviceType: ServiceType.DELIVERY,
                sourceOfferId: 'offer-1',
                sourceAuctionId: null,
                pickupPostcode: 'B1 1AA',
                pickupAddress: '10 Trading Lane, Birmingham',
                deliveryPostcode: 'B28 8AA',
                vehicles: {
                    create: [{
                        registration: 'AB19XYZ',
                        make: 'BMW',
                        model: '320d',
                        year: 2019,
                        listingId: 'listing-1',
                    }],
                },
            }),
            include: { vehicles: true },
        });
    });

    it('falls back to denormalized listing vehicle data when no Vehicle relation exists', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer({
            listing: listing({
                vehicle: null,
                vrm: ' zz20 zzz ',
                make: 'Toyota',
                model: 'Yaris',
                year: 2020,
            }),
        }));

        await service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any);

        expect(prisma.serviceJob.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                vehicles: {
                    create: [{
                        registration: 'ZZ20ZZZ',
                        make: 'Toyota',
                        model: 'Yaris',
                        year: 2020,
                        listingId: 'listing-1',
                    }],
                },
            }),
        }));
    });

    it('returns the existing active linked job on a repeated click instead of creating another', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer());
        prisma.serviceJob.findFirst.mockResolvedValue({
            id: 'job-existing',
            customerId: 'buyer-1',
            sourceOfferId: 'offer-1',
            status: ServiceJobStatus.OPEN,
            vehicles: [{ listingId: 'listing-1' }],
        });

        const result = await service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any);

        expect(result.id).toBe('job-existing');
        expect(prisma.serviceJob.create).not.toHaveBeenCalled();
    });

    it('allows a new workflow after the prior linked job was cancelled or expired', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer());
        prisma.serviceJob.findFirst.mockResolvedValue(null);

        await service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any);

        expect(prisma.serviceJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                status: { notIn: [ServiceJobStatus.CANCELLED, ServiceJobStatus.EXPIRED] },
            }),
        }));
        expect(prisma.serviceJob.create).toHaveBeenCalledTimes(1);
    });

    it('rejects an auction source for anyone except the recorded winner', async () => {
        prisma.auction.findUnique.mockResolvedValue(auction({ winnerId: 'winner-other' }));

        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            auctionId: 'auction-1',
        } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an auction that is not ended and sold', async () => {
        prisma.auction.findUnique.mockResolvedValue(auction({ status: 'ACTIVE' }));

        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            auctionId: 'auction-1',
        } as any)).rejects.toThrow('not in a completed sale state');
    });

    it('requires the auction buyer fee before TradeXchange delivery is created', async () => {
        prisma.auction.findUnique.mockResolvedValue(auction({ buyerFeePaid: false }));

        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            auctionId: 'auction-1',
        } as any)).rejects.toThrow('buyer fee');
        expect(prisma.serviceJob.create).not.toHaveBeenCalled();
    });

    it('requires the auction Sale row to belong to the winner', async () => {
        prisma.auction.findUnique.mockResolvedValue(auction({
            listing: listing({
                status: 'SOLD',
                sale: { buyerId: 'different-buyer' },
            }),
        }));

        await expect(service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            auctionId: 'auction-1',
        } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a valid auction-linked delivery with only sourceAuctionId populated', async () => {
        prisma.auction.findUnique.mockResolvedValue(auction());

        await service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            auctionId: 'auction-1',
        } as any);

        expect(prisma.serviceJob.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                sourceOfferId: null,
                sourceAuctionId: 'auction-1',
                serviceType: ServiceType.DELIVERY,
                vehicles: {
                    create: [expect.objectContaining({ listingId: 'listing-1' })],
                },
            }),
            include: { vehicles: true },
        });
    });

    it('recovers a concurrent unique-index race by returning the job created by the winning request', async () => {
        prisma.offer.findUnique.mockResolvedValue(offer());
        prisma.serviceJob.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: 'job-race-winner',
                customerId: 'buyer-1',
                sourceOfferId: 'offer-1',
                status: ServiceJobStatus.OPEN,
                vehicles: [{ listingId: 'listing-1' }],
            });
        prisma.serviceJob.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: 'test',
                meta: { target: ['sourceOfferId'] },
            }),
        );

        const result = await service.createJobFromPurchase('buyer-1', {
            ...baseInput,
            offerId: 'offer-1',
        } as any);

        expect(result.id).toBe('job-race-winner');
        expect(prisma.serviceJob.findFirst).toHaveBeenCalledTimes(2);
    });
});
