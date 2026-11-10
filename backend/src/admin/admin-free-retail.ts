import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildListingActivationData } from '../listings/listing-activation';
import { getListingSubmissionReadiness } from '../listings/listing-readiness';
import { hasOtherActiveRetailRegistration } from '../listings/retail-uniqueness';

export const ADMIN_FREE_RETAIL_EVENT = 'admin_draft_free_retail';

/** One explicit admin action: waive BASIC fee, approve and publish atomically. */
export async function publishDraftRetailFree(prisma: PrismaService, id: string, adminId: string) {
    return prisma.$transaction(async tx => {
        const initial = await tx.listing.findUnique({ where: { id } });
        if (!initial || initial.deletedAt) throw new NotFoundException('Listing not found');
        const ids = [...new Set([id, initial.linkedListingId].filter((value): value is string => !!value))].sort();
        for (const key of ids) {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
        }
        // Serialize this listing against ordinary edits and checkout preparation.
        await tx.$queryRaw`SELECT id FROM public.listings WHERE id = ${id} FOR UPDATE`;
        const listing = await tx.listing.findUnique({
            where: { id }, include: { seller: { select: { id: true, deletedAt: true } } },
        });
        if (!listing || listing.deletedAt) throw new NotFoundException('Listing not found');
        if (listing.linkedListingId !== initial.linkedListingId) throw new ConflictException('The linked listing changed. Refresh and try again.');
        if (listing.status !== 'DRAFT') throw new BadRequestException('Only a draft can be published with this button. Refresh the list to check its current status.');
        if (!listing.sellerId || !listing.seller || listing.seller.deletedAt) throw new BadRequestException('A valid seller account is required.');

        const missing = getListingSubmissionReadiness(listing).missingFields;
        if (missing.length) throw new BadRequestException('Complete the draft before publishing. Missing: ' + missing.join(', ') + '. Use Edit details; do not guess seller declarations.');
        const price = Number(listing.price);
        if (!Number.isFinite(price) || price <= 0) throw new BadRequestException('Enter a valid retail asking price in Edit details first.');
        const vrm = (listing.vrm ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

        const previousGrant = await tx.analyticsEvent.findFirst({ where: {
            type: ADMIN_FREE_RETAIL_EVENT,
            OR: [
                { payload: { path: ['listingId'], equals: id } },
                { AND: [
                    { payload: { path: ['sellerId'], equals: listing.sellerId } },
                    { payload: { path: ['vrm'], equals: vrm } },
                ] },
            ],
        }, select: { id: true } });
        if (previousGrant) throw new BadRequestException('The one-time free retail listing has already been used for this seller and vehicle.');

        const [auctions, sale, acceptedOffer, siblings, pendingFee, completedFee] = await Promise.all([
            tx.auction.findMany({ where: { listingId: { in: ids } } }),
            tx.sale.findFirst({ where: { listingId: { in: ids } }, select: { id: true } }),
            tx.offer.findFirst({ where: { listingId: { in: ids }, status: 'ACCEPTED' }, select: { id: true } }),
            tx.listing.findMany({ where: { sellerId: listing.sellerId, id: { not: id }, deletedAt: null },
                select: { id: true, vrm: true, status: true, linkedListingId: true, type: true } }),
            tx.transaction.findFirst({ where: { listingId: id, type: 'LISTING_FEE', status: 'PENDING', deletedAt: null }, select: { id: true } }),
            tx.transaction.findFirst({ where: { listingId: id, type: 'LISTING_FEE', status: 'COMPLETED', deletedAt: null }, select: { id: true } }),
        ]);
        if (sale || acceptedOffer || auctions.some(auction =>
            auction.deletedAt || !['ENDED', 'CANCELLED'].includes(auction.status)
            || auction.winnerId || auction.wonAt || auction.provisionalOfferBidId
            || auction.stripePayoutTransferId || auction.manualPayoutConfirmedAt
            || auction.sellerBonusReleasedAt || auction.sellerFundsConfirmedAt
            || auction.buyerRefusedAt || auction.handoverRejectedAt
            || auction.buyerFeePaid || auction.buyerFeeTransactionId
            || auction.handoverSubmittedAt || auction.handoverProofPath || auction.handoverProofUrl
            || auction.sellerBonusReleased || auction.buyItNowPendingBuyerId
        )) throw new BadRequestException('Resolve the active auction, accepted offer or recorded sale before publishing in retail.');
        if (pendingFee) throw new BadRequestException('An unfinished retail checkout exists. Close or resolve that payment session before granting a free listing, so the seller cannot be charged afterwards.');
        if (siblings.some(other => (other.vrm ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') === vrm
            && ['ACTIVE', 'PENDING_REVIEW', 'OFFER_ACCEPTED', 'SOLD'].includes(other.status))) {
            throw new BadRequestException('Another live, pending or sold listing exists for this seller and registration. Review it first.');
        }
        if (await hasOtherActiveRetailRegistration(tx, { id, type: 'CLASSIFIED', vrm: listing.vrm })) {
            throw new BadRequestException('Another live retail advert has this registration. Resolve the duplicate before publishing.');
        }
        if (listing.linkedListingId) {
            const linked = siblings.find(other => other.id === listing.linkedListingId);
            if (!linked || linked.linkedListingId !== id || !['DRAFT', 'WITHDRAWN'].includes(linked.status)) {
                throw new BadRequestException('The linked advert needs review before this draft can become a standalone retail listing.');
            }
            const detached = await tx.listing.updateMany({
                where: { id: linked.id, sellerId: listing.sellerId, status: linked.status, linkedListingId: id, deletedAt: null },
                data: { linkedListingId: null },
            });
            if (detached.count !== 1) throw new ConflictException('The linked advert changed. Refresh and try again.');
        }
        // Reuse existing fee evidence; otherwise record an explicit £0 waiver,
        // following the established free-listing grant ledger convention. No Stripe call.
        const fee = completedFee ?? await tx.transaction.create({ data: {
            listingId: id, userId: listing.sellerId, type: 'LISTING_FEE', status: 'COMPLETED', amount: 0,
            description: 'Admin one-time free BASIC retail listing; fee waived, no payment collected',
        }, select: { id: true } });
        const tier = completedFee && ['STANDARD', 'PREMIUM'].includes(listing.badgeTier) ? listing.badgeTier : 'BASIC';
        const changed = await tx.listing.updateMany({
            where: { id, status: 'DRAFT', deletedAt: null, linkedListingId: listing.linkedListingId },
            data: { ...buildListingActivationData(tier), type: 'CLASSIFIED', badgeTier: tier, linkedListingId: null },
        });
        if (changed.count !== 1) throw new ConflictException('The draft changed. Refresh and try again.');
        await tx.bid.updateMany({ where: { listingId: id, archivedAt: null }, data: { archivedAt: new Date() } });
        await tx.analyticsEvent.create({ data: {
            type: ADMIN_FREE_RETAIL_EVENT, userId: adminId,
            payload: { listingId: id, sellerId: listing.sellerId, vrm, previousListingType: listing.type,
                price, feeTransactionId: fee.id, feeWaived: !completedFee, feeCharged: 0, linkedListingId: listing.linkedListingId },
        } });
        return { listingId: id, status: 'ACTIVE' as const, type: 'CLASSIFIED' as const, price, feeCharged: 0, slug: listing.slug };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
}
