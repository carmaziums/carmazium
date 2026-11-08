import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Administrative closure of an advert, not evidence of a platform purchase. */
export async function markListingSold(
    prisma: PrismaService, listingId: string, adminId: string,
    input: { source: 'EXTERNAL' | 'UNKNOWN'; reason: string },
) {
    const reason = input.reason?.trim();
    if (!['EXTERNAL', 'UNKNOWN'].includes(input.source) || !reason || reason.length < 10 || reason.length > 1000) {
        throw new BadRequestException('Choose the buyer source and enter a reason of 10–1000 characters.');
    }
    return prisma.$transaction(async tx => {
        const initial = await tx.listing.findUnique({ where: { id: listingId } });
        if (!initial || initial.deletedAt) throw new NotFoundException('Listing not found');
        const ids = [...new Set([listingId, initial.linkedListingId].filter((id): id is string => Boolean(id)))].sort();
        // Same lock order as seller completion and auction acceptance.
        for (const id of ids) {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text`;
        }
        const listings = await tx.listing.findMany({ where: { id: { in: ids } } });
        const current = listings.find(l => l.id === listingId);
        if (!current || current.deletedAt || current.linkedListingId !== initial.linkedListingId) {
            throw new ConflictException('The listing changed. Refresh and try again.');
        }
        if (current.status === 'SOLD') return { listingId, status: 'SOLD', alreadySold: true };
        if (ids.length > 1) {
            const linked = listings.find(l => l.id !== listingId);
            if (!linked || linked.deletedAt || !current.sellerId || linked.sellerId !== current.sellerId || linked.linkedListingId !== listingId) {
                throw new ConflictException('The linked adverts need review before this vehicle can be marked sold.');
            }
        }
        const [auction, acceptedOffer, sale] = await Promise.all([
            tx.auction.findFirst({ where: { listingId: { in: ids }, OR: [
                { status: { in: ['ACTIVE', 'SCHEDULED'] } },
                { winnerId: { not: null } }, { wonAt: { not: null } },
                { provisionalOfferBidId: { not: null } },
                { buyItNowPendingBuyerId: { not: null } },
            ] } }),
            tx.offer.findFirst({ where: { listingId: { in: ids }, status: 'ACCEPTED' } }),
            tx.sale.findFirst({ where: { listingId: { in: ids } } }),
        ]);
        if (auction || acceptedOffer || sale || listings.some(l => l.status === 'OFFER_ACCEPTED' || l.status === 'SOLD')) {
            throw new BadRequestException('This vehicle has an auction or recorded deal to resolve first. Complete or cancel that deal through its existing workflow before marking it sold elsewhere.');
        }
        const updated = await tx.listing.updateMany({
            where: { id: { in: ids }, deletedAt: null, status: { notIn: ['SOLD', 'OFFER_ACCEPTED'] } },
            data: { status: 'SOLD' },
        });
        if (updated.count !== ids.length) throw new ConflictException('The listing changed. Refresh and try again.');
        await tx.offer.updateMany({
            where: { listingId: { in: ids }, status: { in: ['PENDING', 'COUNTERED'] } },
            data: { status: 'CANCELLED' },
        });
        await tx.analyticsEvent.create({ data: {
            type: 'admin_listing_marked_sold', userId: adminId,
            payload: {
                listingId, listingIds: ids, source: input.source, reason,
                previousStatuses: listings.map(l => ({ listingId: l.id, status: l.status })),
                platformSaleRecorded: false,
            },
        } });
        return { listingId, status: 'SOLD', alreadySold: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
