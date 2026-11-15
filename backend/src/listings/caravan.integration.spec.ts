import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from './listings.service';

const integration = process.env.CARAVAN_POSTGRES_TEST === '1' ? describe : describe.skip;

// This suite must never connect to production or shared customer databases.
integration('Manual caravans with disposable PostgreSQL', () => {
    let prisma: PrismaService;
    let service: ListingsService;
    let sellerId: string;
    let outsiderId: string;
    const ids: string[] = [];

    beforeAll(async () => {
        if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) {
            throw new Error('Requires the exact disposable CI PostgreSQL database');
        }
        prisma = new PrismaService();
        const suffix = randomUUID();
        const seller = await prisma.user.create({ data: { email: `caravan-${suffix}@invalid.example`, passwordHash: 'synthetic-only', role: 'SELLER' } });
        const outsider = await prisma.user.create({ data: { email: `outsider-${suffix}@invalid.example`, passwordHash: 'synthetic-only', role: 'BUYER' } });
        sellerId = seller.id;
        outsiderId = outsider.id;
        service = new ListingsService(prisma, { incrementListings: jest.fn() } as any,
            { get: (key: string) => key === 'SUPABASE_URL' ? 'https://synthetic-damage-qa.supabase.co' : undefined } as any,
            {} as any, {} as any, {} as any);
        // Suppress only external geocoding/notifications; all database writes and
        // listing ownership, photo, readiness, payment and review gates are real.
        jest.spyOn(service as any, 'geocodeLocation').mockResolvedValue(null);
        jest.spyOn(service as any, 'notifySubmittedForReview').mockResolvedValue(undefined);
    });

    afterAll(async () => {
        if (!prisma) return;
        await prisma.auction.deleteMany({ where: { listingId: { in: ids } } });
        await prisma.listing.deleteMany({ where: { id: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: [sellerId, outsiderId].filter(Boolean) } } });
        await prisma.$disconnect();
    });

    it.each(['AUCTION', 'CLASSIFIED'])('saves and resumes a one-photo %s caravan, enforcing ownership and review/payment', async (listingType) => {
        const listing = await service.create({
            title: `Synthetic caravan ${listingType}`, bodyType: 'CARAVAN', listingType,
            price: 6900, location: 'Birmingham', badgeTier: 'BASIC',
            images: [`https://synthetic-damage-qa.supabase.co/storage/v1/object/public/listings/${sellerId}/vehicle/caravan-qa.jpg`],
            stolenRecovered: false, hasOutstandingFinance: false, isLegalRegisteredKeeper: true,
            partnerDistributionAccepted: true,
            ...(listingType === 'AUCTION' ? {
                auctionStartTime: new Date(Date.now() + 60_000).toISOString(),
                auctionReservePrice: 6000, auctionMinIncrement: 100,
            } : {}),
        } as any, sellerId);
        ids.push(listing.id);
        expect(listing.status).toBe('DRAFT');
        expect(listing.bodyType).toBe('CARAVAN');
        for (const key of ['vrm', 'vin', 'year', 'mileage', 'fuelType', 'transmission']) expect(listing[key]).toBeNull();
        expect(Number(listing.price)).toBe(6900);
        expect(listing.images).toHaveLength(1);
        await expect(service.update(listing.id, outsiderId, { title: 'Unauthorized change' })).rejects.toBeInstanceOf(ForbiddenException);
        await service.update(listing.id, sellerId, { description: 'Synthetic test: dimensions and equipment entered manually.' });
        expect((await service.findById(listing.id)).description).toContain('dimensions and equipment');
        await expect(service.publishListing(listing.id, outsiderId)).rejects.toBeInstanceOf(ForbiddenException);
        const submitted = await service.publishListing(listing.id, sellerId);
        if (listingType === 'AUCTION') {
            expect(submitted).toEqual({ activated: false, pendingReview: true });
            expect((await service.findById(listing.id)).status).toBe('PENDING_REVIEW');
            const auction = await prisma.auction.findUniqueOrThrow({ where: { listingId: listing.id } });
            expect(Number(auction.startingBid)).toBe(4830);
            expect(Number(auction.reservePrice)).toBe(6000);
            expect(auction.status).toBe('SCHEDULED');
        } else {
            expect(submitted).toEqual({ activated: false, requiresPayment: true });
            expect((await service.findById(listing.id)).status).toBe('DRAFT');
            expect(await prisma.transaction.count({ where: { listingId: listing.id } })).toBe(0);
        }
        // Neither channel is published by a seller submission alone.
        expect((await service.findById(listing.id)).status).not.toBe('ACTIVE');
    });
});
