import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTradeAuctionAccess } from './trade-access';

/** Auction-scoped condition reports: the lot may return to DRAFT when it ends.
 * Do not relax the generic listing damage endpoint or disclose withdrawn/deleted stock.
 * These are current seller-reported records, not an immutable auction-time snapshot. */
export async function readAuctionDamageRecords(prisma: PrismaService, id: string, viewerId?: string) {
    const auction = await prisma.auction.findUnique({
        where: { id },
        select: { status: true, deletedAt: true, startTime: true, listing: { select: {
            id: true, status: true, sellerId: true, deletedAt: true,
        } } },
    });
    const listing = auction?.listing;
    if (!auction || auction.deletedAt || !listing || listing.deletedAt || auction.status === "CANCELLED") {
        throw new NotFoundException("Auction damage information unavailable");
    }
    await assertTradeAuctionAccess(prisma, viewerId, listing.sellerId);
    const published = ["ACTIVE", "OFFER_ACCEPTED", "SOLD"].includes(listing.status);
    const endedUnsold = auction.status === "ENDED" && listing.status === "DRAFT" && auction.startTime.getTime() <= Date.now();
    if (!published && !endedUnsold) {
        // Unpublished scheduled drafts are not made readable to other dealers.
        if (viewerId !== listing.sellerId) throw new NotFoundException("Auction damage information unavailable");
    }
    if (["WITHDRAWN", "REJECTED"].includes(listing.status)) throw new NotFoundException("Auction damage information unavailable");
    // Recheck the lot identity/status in the read itself. Do not mistake
    // a concurrent withdrawal or relist for a successful empty report.
    const current = await prisma.listing.findFirst({
        where: { id: listing.id, deletedAt: null, sellerId: listing.sellerId, status: listing.status,
            auction: { is: { id, status: auction.status, deletedAt: null, startTime: auction.startTime } } },
        select: { damageRecords: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    if (!current) throw new NotFoundException("Auction damage information unavailable");
    return current.damageRecords;
}
